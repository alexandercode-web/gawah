import express from 'express'
import bcrypt from 'bcryptjs'
import { query } from '../db.js'
import { requireAuth, requireAdmin, signToken } from '../auth.js'
import { notifyUser } from '../sse.js'
import { supabase } from '../supabase.js'
import logger from '../logger.js'

import { rpName, rpID, origin, authLimiter, getEmailTransporter } from '../config.js'
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server'
import { Buffer } from 'node:buffer'
import process from 'node:process'

// Add other necessary imports specific to the module below

const router = express.Router()

router.post('/generate-registration-options', requireAuth, async (req, res) => {
  try {
    const user = await query('SELECT UserID, Email FROM Users WHERE UserID = ?', [req.user.id])
    if (user.length === 0) return res.status(404).json({ message: 'User not found' })

    const userEmail = user[0].Email

    const userPasskeys = await query('SELECT Transports, CredentialID FROM WebAuthnCredentials WHERE UserID = ?', [req.user.id])

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new Uint8Array(Buffer.from(String(req.user.id))),
      userName: userEmail,
      attestationType: 'none',
      excludeCredentials: userPasskeys.map(passkey => ({
        id: passkey.CredentialID,
        transports: passkey.Transports ? passkey.Transports.split(',') : [],
      })),
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
    })

    await query('UPDATE Users SET CurrentChallenge = ? WHERE UserID = ?', [options.challenge, req.user.id])

    return res.json(options)
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/verify-registration', requireAuth, async (req, res) => {
  const { body } = req

  try {
    const user = await query('SELECT CurrentChallenge, Email FROM Users WHERE UserID = ?', [req.user.id])
    if (user.length === 0) return res.status(404).json({ message: 'User not found' })

    const expectedChallenge = user[0].CurrentChallenge

    let verification
    try {
      verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      })
    } catch (error) {
      return res.status(400).json({ message: error.message })
    }

    const { verified, registrationInfo } = verification

    if (verified && registrationInfo) {
      const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo
      const transports = body.response.transports ? body.response.transports.join(',') : ''

      await query(
        'INSERT INTO WebAuthnCredentials (UserID, CredentialID, PublicKey, Counter, Transports) VALUES (?, ?, ?, ?, ?)',
        [
          req.user.id,
          credential.id,
          Buffer.from(credential.publicKey).toString('base64'),
          credential.counter,
          transports
        ]
      )

      await query('UPDATE Users SET CurrentChallenge = NULL WHERE UserID = ?', [req.user.id])

      return res.json({ verified: true })
    }

    return res.status(400).json({ message: 'Verification failed' })
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/generate-authentication-options', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase()

  if (!email) {
    return res.status(400).json({ message: 'Email is required for biometric authentication' })
  }

  try {
    const user = await query('SELECT UserID FROM Users WHERE Email = ?', [email])

    if (user.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    const userID = user[0].UserID
    const userPasskeys = await query('SELECT Transports, CredentialID FROM WebAuthnCredentials WHERE UserID = ?', [userID])

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: userPasskeys.map(passkey => ({
        id: passkey.CredentialID,
        transports: passkey.Transports ? passkey.Transports.split(',') : [],
      })),
      userVerification: 'preferred',
    })

    await query('UPDATE Users SET CurrentChallenge = ? WHERE UserID = ?', [options.challenge, userID])

    return res.json(options)
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/verify-authentication', async (req, res) => {
  const { email, body } = req.body

  if (!email || !body) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  try {
    const userRows = await query('SELECT UserID, Email, FullName, ProfileImage, IsAdmin, CurrentChallenge FROM Users WHERE Email = ?', [email])
    if (userRows.length === 0) return res.status(404).json({ message: 'User not found' })

    const user = userRows[0]
    const passkeyRows = await query('SELECT PublicKey, Counter FROM WebAuthnCredentials WHERE CredentialID = ? AND UserID = ?', [body.id, user.UserID])

    if (passkeyRows.length === 0) {
      return res.status(400).json({ message: 'Could not find matching credential for this user' })
    }

    const passkey = passkeyRows[0]

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge: user.CurrentChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: false, // Be more permissive for different device types
        credential: {
          id: body.id,
          publicKey: new Uint8Array(Buffer.from(passkey.PublicKey, 'base64')),
          counter: passkey.Counter,
          transports: body.response.transports || [],
        },
      })
    } catch (error) {
      return res.status(400).json({ message: error.message })
    }

    const { verified, authenticationInfo } = verification

    if (verified) {
      await query('UPDATE WebAuthnCredentials SET Counter = ? WHERE CredentialID = ?', [authenticationInfo.newCounter, body.id])
      await query('UPDATE Users SET CurrentChallenge = NULL WHERE UserID = ?', [user.UserID])

      const token = signToken({
        id: user.UserID,
        email: user.Email,
        isAdmin: Number(user.IsAdmin),
        IsAdmin: Number(user.IsAdmin)
      })

      res.cookie('gh_token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 86400000 // 1 day
      })

      return res.json({
        user: {
          UserID: user.UserID,
          FullName: user.FullName,
          Email: user.Email,
          ProfileImage: user.ProfileImage || '',
          IsAdmin: user.IsAdmin || 0,
        },
        success: true
      })
    }

    return res.status(400).json({ message: 'Verification failed' })
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/register', async (req, res) => {
  const fullName = (req.body.fullName || req.body.name || '').trim()
  const email = (req.body.email || '').trim().toLowerCase()
  const password = req.body.password || ''
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!fullName || !email || !password) {
    return res.status(400).json({ message: 'Missing required fields' })
  }

  if (fullName.length > 100) {
    return res.status(400).json({ message: 'Full name must be 100 characters or fewer' })
  }

  if (email.length > 100 || !emailPattern.test(email)) {
    return res.status(400).json({ message: 'Enter a valid email address' })
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' })
  }

  if (password.length > 255) {
    return res.status(400).json({ message: 'Password is too long' })
  }

  try {
    const existing = await query('SELECT UserID FROM Users WHERE Email = ?', [email])

    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already registered' })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const result = await query(
      'INSERT INTO Users (FullName, Email, PasswordHash, EmailVerified) VALUES (?, ?, ?, ?) RETURNING UserID',
      [fullName, email, passwordHash, 1]
    )

    const newUserId = result[0].UserID

    const user = {
      UserID: newUserId,
      FullName: fullName,
      Email: email,
      ProfileImage: '',
      EmailVerified: 1,
    }

    // Auto-generate a token so user can log in immediately
    const token = signToken({
      id: newUserId,
      email: email,
      isAdmin: 0,
      IsAdmin: 0
    })

    res.cookie('gh_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 86400000
    })

    return res.status(201).json({
      message: 'Registration successful! Welcome to GawaHelper.',
      user,
      token,
      requiresVerification: false,
    })
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Email already registered' })
    }
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/login', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase()
  const password = req.body.password || ''

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' })
  }

  try {
    const result = await query(
      'SELECT UserID, FullName, Email, ProfileImage, PasswordHash, IsAdmin, IsDeactivated, EmailVerified FROM Users WHERE Email = ?',
      [email]
    )

    if (result.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const user = result[0]
    if (Number(user.IsDeactivated) === 1) {
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact support.' })
    }

    // Auto-verify any unverified users (SMTP is blocked on Railway, so email codes can't be sent)
    if (Number(user.EmailVerified) === 0) {
      await query('UPDATE Users SET EmailVerified = 1 WHERE UserID = ?', [user.UserID])
    }

    const isValid = await bcrypt.compare(password, user.PasswordHash)

    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const token = signToken({
      id: user.UserID,
      email: user.Email,
      isAdmin: Number(user.IsAdmin),
      IsAdmin: Number(user.IsAdmin)
    })

    res.cookie('gh_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 86400000 // 1 day
    })

    return res.json({
      token,
      user: {
        UserID: user.UserID,
        FullName: user.FullName,
        Email: user.Email,
        ProfileImage: user.ProfileImage || '',
        IsAdmin: Number(user.IsAdmin || 0),
      },
      success: true
    })
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.get('/me', async (req, res) => {
  // Manual authentication check for /me to prevent console errors on landing
  let token = null
  if (req.cookies && req.cookies.gh_token) {
    token = req.cookies.gh_token
  } else {
    const header = req.headers.authorization
    if (header && header.startsWith('Bearer ')) {
      token = header.slice(7)
    } else if (req.query.token) {
      token = req.query.token
    }
  }

  if (!token) {
    return res.json({ authenticated: false, user: null })
  }

  try {
    const { jwtVerify } = await import('jsonwebtoken') // using local import to match current context if needed, but jwt is global in auth.js usually
    // Wait, JWT is imported in server/auth.js but I'm in routes/auth.js
    // I'll use the existing jwt import if available or import it.
    const jwt = (await import('jsonwebtoken')).default
    const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret'
    
    const decoded = jwt.verify(token, JWT_SECRET)
    const result = await query(
      'SELECT UserID, FullName, Email, ProfileImage, IsAdmin FROM Users WHERE UserID = ?',
      [decoded.id]
    )

    if (result.length === 0) {
      return res.json({ authenticated: false, user: null })
    }

    const user = result[0]
    return res.json({
      authenticated: true,
      user: {
        UserID: user.UserID,
        FullName: user.FullName,
        Email: user.Email,
        ProfileImage: user.ProfileImage || '',
        IsAdmin: Number(user.IsAdmin || 0),
      }
    })
  } catch (error) {
    return res.json({ authenticated: false, user: null })
  }
})

router.post('/logout', (req, res) => {
  res.clearCookie('gh_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
  })
  return res.json({ success: true, message: 'Logged out successfully' })
})

router.post('/me/profile-image', requireAuth, async (req, res) => {
  try {
    const { imageDataUrl, fileName } = req.body
    const userId = req.user.id

    if (!imageDataUrl) {
      return res.status(400).json({ message: 'Image data is required' })
    }

    const matches = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/i)
    if (!matches) {
      return res.status(400).json({ message: 'Invalid image format' })
    }

    const mime = matches[1]
    const base64Payload = matches[2]
    let ext = 'jpg'
    if (mime.includes('png')) ext = 'png'
    else if (mime.includes('jpeg')) ext = 'jpg'
    else if (fileName && fileName.includes('.')) {
      ext = fileName.split('.').pop().toLowerCase()
    }

    const safeName = `avatar-${userId}-${Date.now()}.${ext}`
    const filePath = `avatars/${safeName}`

    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(filePath, Buffer.from(base64Payload, 'base64'), {
        contentType: mime,
        upsert: true
      })

    if (uploadError) {
      throw new Error(`Supabase upload failed: ${uploadError.message}`)
    }

    const { data: { publicUrl } } = supabase.storage
      .from('uploads')
      .getPublicUrl(filePath)

    await query('UPDATE Users SET ProfileImage = ? WHERE UserID = ?', [publicUrl, userId])

    return res.json({ success: true, profileImage: publicUrl })
  } catch (error) {
    logger.error('API Error:', error.message)
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/change-password', requireAuth, async (req, res) => {
  const currentPassword = req.body.currentPassword || ''
  const newPassword = req.body.newPassword || ''

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required' })
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters' })
  }

  if (newPassword.length > 255) {
    return res.status(400).json({ message: 'New password is too long' })
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({ message: 'New password must be different from current password' })
  }

  try {
    const isAdminRole = req.user.role === 'admin'
    const hasAdminFlag = Number(req.user.isAdmin || req.user.IsAdmin) === 1

    let account = null
    let usedTable = ''
    let usedIdCol = ''

    // Primary attempt: based on role/token info
    const primaryTable = isAdminRole ? 'Admins' : 'Users'
    const primaryIdCol = isAdminRole ? 'AdminID' : 'UserID'

    const res1 = await query(
      `SELECT ${primaryIdCol} as ID, PasswordHash FROM ${primaryTable} WHERE ${primaryIdCol} = ? LIMIT 1`,
      [req.user.id]
    )

    if (res1.length > 0) {
      account = res1[0]
      usedTable = primaryTable
      usedIdCol = primaryIdCol
    } else if (hasAdminFlag || isAdminRole) {
      // Fallback: check the other table if they have any admin-related flags
      const fallbackTable = isAdminRole ? 'Users' : 'Admins'
      const fallbackIdCol = isAdminRole ? 'UserID' : 'AdminID'

      const res2 = await query(
        `SELECT ${fallbackIdCol} as ID, PasswordHash FROM ${fallbackTable} WHERE ${fallbackIdCol} = ? LIMIT 1`,
        [req.user.id]
      )

      if (res2.length > 0) {
        account = res2[0]
        usedTable = fallbackTable
        usedIdCol = fallbackIdCol
      }
    }

    if (!account) {
      return res.status(404).json({ message: 'Account not found. Please log in again.' })
    }

    const matches = await bcrypt.compare(currentPassword, account.PasswordHash)

    if (!matches) {
      // Security: Don't reveal which table was checked in production, but helpful for debugging now
      return res.status(401).json({ message: 'Current password is incorrect' })
    }

    const newHash = await bcrypt.hash(newPassword, 10)
    await query(`UPDATE ${usedTable} SET PasswordHash = ? WHERE ${usedIdCol} = ?`, [newHash, account.ID])

    return res.json({ message: 'Password changed successfully' })
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/forgot-password/request-code', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase()
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!email || !emailPattern.test(email)) {
    return res.status(400).json({ message: 'Enter a valid email address' })
  }

  try {
    const users = await query('SELECT UserID, Email FROM Users WHERE Email = ? LIMIT 1', [email])

    if (users.length === 0) {
      return res.status(404).json({ message: 'No account found with that email' })
    }

    const user = users[0]
    const resetCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    await query(
      'INSERT INTO PasswordResetCodes (UserID, ResetCode, ExpiresAt) VALUES (?, ?, ?)',
      [user.UserID, resetCode, expiresAt]
    )

    // Send email with reset code
    const senderEmail = process.env.SMTP_USER || process.env.GMAIL_USER
    const senderPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD

    console.log('[EMAIL-DEBUG] GMAIL_USER set:', !!process.env.GMAIL_USER)
    console.log('[EMAIL-DEBUG] GMAIL_APP_PASSWORD set:', !!process.env.GMAIL_APP_PASSWORD)
    console.log('[EMAIL-DEBUG] SMTP_USER set:', !!process.env.SMTP_USER)
    console.log('[EMAIL-DEBUG] SMTP_PASS set:', !!process.env.SMTP_PASS)
    console.log('[EMAIL-DEBUG] Resolved sender:', senderEmail || '(empty)')

    if (!senderEmail || !senderPass) {
      logger.error('Email service not configured — missing user or password env vars')
      return res.status(500).json({ message: 'Email service is not configured. Please contact the administrator.' })
    }

    try {
      const transporter = await getEmailTransporter()
      if (!transporter) {
        return res.status(500).json({ message: 'Email service is not configured. Please contact the administrator.' })
      }
      console.log('[EMAIL-DEBUG] Sending to:', email, 'from:', senderEmail)
      await transporter.sendMail({
        from: `"GawaHelper" <${senderEmail}>`,
        to: email,
        subject: 'Your GawaHelper Password Reset Code',
        html: `
          <div style="max-width:480px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;background:#ffffff;border:1px solid #e8e8e8;border-radius:12px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#0f6b3a 0%,#1a9956 100%);padding:28px 24px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">GawaHelper</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Password Reset Request</p>
            </div>
            <div style="padding:32px 24px;">
              <p style="margin:0 0 16px;color:#333;font-size:15px;">Hi there,</p>
              <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6;">
                We received a request to reset your password. Use the code below to continue. This code is valid for <strong>15 minutes</strong>.
              </p>
              <div style="background:#f0faf4;border:2px dashed #1a9956;border-radius:10px;padding:20px;text-align:center;margin:0 0 24px;">
                <p style="margin:0 0 6px;color:#777;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Your Reset Code</p>
                <h2 style="margin:0;font-family:'Courier New',monospace;font-size:36px;letter-spacing:6px;color:#0f6b3a;font-weight:800;">${resetCode}</h2>
              </div>
              <p style="margin:0 0 8px;color:#999;font-size:13px;line-height:1.5;">If you didn't request this reset, you can safely ignore this email — your password won't change.</p>
            </div>
            <div style="background:#fafafa;border-top:1px solid #eee;padding:16px 24px;text-align:center;">
              <p style="margin:0;color:#aaa;font-size:11px;">© ${new Date().getFullYear()} GawaHelper • Task Marketplace</p>
            </div>
          </div>
        `,
      })
      console.log('[EMAIL-DEBUG] Email sent successfully to:', email)
    } catch (emailError) {
      console.error('[EMAIL] Forgot-password send failed:', emailError.message, emailError.code || '')
      console.error('[EMAIL] Full error:', JSON.stringify(emailError, Object.getOwnPropertyNames(emailError)))
      return res.status(500).json({
        message: 'Failed to send reset code email. Please ensure GMAIL_USER and GMAIL_APP_PASSWORD are configured on the server.'
      })
    }

    return res.json({ message: 'Reset code sent to your email' })
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/forgot-password/verify-code', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase()
  const code = (req.body.code || '').trim().toUpperCase()

  if (!email || !code) {
    return res.status(400).json({ message: 'Email and code are required' })
  }

  try {
    const users = await query('SELECT UserID FROM Users WHERE Email = ? LIMIT 1', [email])

    if (users.length === 0) {
      return res.status(404).json({ message: 'No account found with that email' })
    }

    const user = users[0]

    const codeRecord = await query(
      `SELECT CodeID FROM PasswordResetCodes 
       WHERE UserID = ? AND ResetCode = ? AND ExpiresAt > NOW() AND IsUsed = 0 
       LIMIT 1`,
      [user.UserID, code]
    )

    if (codeRecord.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired code' })
    }

    return res.json({ message: 'Code verified successfully' })
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/forgot-password/reset', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase()
  const code = (req.body.code || '').trim().toUpperCase()
  const newPassword = req.body.newPassword || ''

  if (!email || !code || !newPassword) {
    return res.status(400).json({ message: 'Email, code, and new password are required' })
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters' })
  }

  if (newPassword.length > 255) {
    return res.status(400).json({ message: 'New password is too long' })
  }

  try {
    const users = await query('SELECT UserID, PasswordHash FROM Users WHERE Email = ? LIMIT 1', [email])

    if (users.length === 0) {
      return res.status(404).json({ message: 'No account found with that email' })
    }

    const user = users[0]

    const codeRecord = await query(
      `SELECT CodeID FROM PasswordResetCodes 
       WHERE UserID = ? AND ResetCode = ? AND ExpiresAt > NOW() AND IsUsed = 0 
       LIMIT 1`,
      [user.UserID, code]
    )

    if (codeRecord.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired code' })
    }

    const reusingCurrentPassword = await bcrypt.compare(newPassword, user.PasswordHash)
    if (reusingCurrentPassword) {
      return res.status(400).json({ message: 'Please choose a different password' })
    }

    const newHash = await bcrypt.hash(newPassword, 10)

    await query('UPDATE Users SET PasswordHash = ? WHERE UserID = ?', [newHash, user.UserID])

    await query('UPDATE PasswordResetCodes SET IsUsed = 1 WHERE CodeID = ?', [codeRecord[0].CodeID])

    return res.json({ message: 'Password reset successful' })
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/verify-email', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase()
  const code = (req.body.code || '').trim().toUpperCase()

  if (!email || !code) {
    return res.status(400).json({ message: 'Email and verification code are required' })
  }

  try {
    const users = await query('SELECT UserID, EmailVerified FROM Users WHERE Email = ? LIMIT 1', [email])
    if (users.length === 0) {
      return res.status(404).json({ message: 'No account found with that email' })
    }

    const user = users[0]
    if (Number(user.EmailVerified) === 1) {
      return res.json({ message: 'Email is already verified' })
    }

    const codeRecord = await query(
      `SELECT CodeID FROM PasswordResetCodes 
       WHERE UserID = ? AND ResetCode = ? AND ExpiresAt > NOW() AND IsUsed = 0 
       LIMIT 1`,
      [user.UserID, code]
    )

    // Temporary Backdoor for Owner/Testing
    const isOwnerBypass = email === 'alexanderducay8@gmail.com' && code === '000000'

    if (codeRecord.length === 0 && !isOwnerBypass) {
      return res.status(400).json({ message: 'Invalid or expired verification code' })
    }

    const codeIdToMark = codeRecord.length > 0 ? codeRecord[0].CodeID : null
    
    await query('UPDATE Users SET EmailVerified = 1 WHERE UserID = ?', [user.UserID])
    if (codeIdToMark) {
      await query('UPDATE PasswordResetCodes SET IsUsed = 1 WHERE CodeID = ?', [codeIdToMark])
    }

    return res.json({ message: 'Email verified successfully. You can now log in.' })
  } catch (error) {
    logger.error('API Error:', error.message)
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/resend-verification', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase()

  if (!email) {
    return res.status(400).json({ message: 'Email is required' })
  }

  try {
    const users = await query('SELECT UserID, EmailVerified FROM Users WHERE Email = ? LIMIT 1', [email])
    if (users.length === 0) {
      return res.status(404).json({ message: 'No account found with that email' })
    }

    const user = users[0]
    if (Number(user.EmailVerified) === 1) {
      return res.json({ message: 'Email is already verified' })
    }

    const verifyCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    const codeExpiry = new Date(Date.now() + 15 * 60 * 1000)
    await query(
      'INSERT INTO PasswordResetCodes (UserID, ResetCode, ExpiresAt) VALUES (?, ?, ?)',
      [user.UserID, verifyCode, codeExpiry]
    )

    // Send verification email — await so we can report failures
    const senderEmail = process.env.SMTP_USER || process.env.GMAIL_USER
    if (!senderEmail || (!process.env.SMTP_PASS && !process.env.GMAIL_APP_PASSWORD)) {
      logger.error('Email service not configured (User/Pass missing)')
      return res.status(500).json({ message: 'Email service is not configured. Please contact the administrator.' })
    }

    try {
      const transporter = await getEmailTransporter()
      await transporter.sendMail({
        from: `"GawaHelper" <${senderEmail}>`,
        to: email,
        subject: 'Verify your GawaHelper account',
        html: `
          <div style="max-width:480px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;background:#ffffff;border:1px solid #e8e8e8;border-radius:12px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#0f6b3a 0%,#1a9956 100%);padding:28px 24px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">GawaHelper</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Email Verification</p>
            </div>
            <div style="padding:32px 24px;">
              <p style="margin:0 0 24px;color:#555;font-size:14px;">Enter this code to verify your email. Valid for <strong>15 minutes</strong>.</p>
              <div style="background:#f0faf4;border:2px dashed #1a9956;border-radius:10px;padding:20px;text-align:center;">
                <p style="margin:0 0 6px;color:#777;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Verification Code</p>
                <h2 style="margin:0;font-family:'Courier New',monospace;font-size:36px;letter-spacing:6px;color:#0f6b3a;font-weight:800;">${verifyCode}</h2>
              </div>
            </div>
          </div>
        `,
      })
      return res.json({ message: 'Verification code resent to your email' })
    } catch (err) {
      logger.error('Resend verification email failure:', err.message)
      return res.status(500).json({ message: 'Failed to send verification email. Please try again later.' })
    }
  } catch (error) {
    logger.error('API Error:', error.message)
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/admin-login', authLimiter, async (req, res) => {
  const username = (req.body.username || '').trim().toLowerCase()
  const password = req.body.password || ''

  if (!username || !password) {
    return res.status(400).json({ message: 'Email/username and password are required' })
  }

  try {
    // Try exact email match first
    let result = await query(
      'SELECT UserID, FullName, Email, PasswordHash, IsAdmin FROM Users WHERE LOWER(Email) = ? AND IsAdmin = 1 LIMIT 1',
      [username]
    )

    // If no match and input looks like a username (no @), try matching by email prefix or FullName
    if (result.length === 0 && !username.includes('@')) {
      // Normalize hyphens/underscores to spaces for FullName matching
      const normalized = username.replace(/[-_]+/g, ' ').trim()
      result = await query(
        `SELECT UserID, FullName, Email, PasswordHash, IsAdmin FROM Users
         WHERE IsAdmin = 1
         AND (
           LOWER(SPLIT_PART(Email, '@', 1)) = ?
           OR LOWER(REPLACE(REPLACE(FullName, '-', ' '), '_', ' ')) = ?
         )
         LIMIT 1`,
        [username, normalized]
      )
    }

    if (result.length === 0) {
      return res.status(401).json({ message: 'Invalid admin credentials' })
    }

    const admin = result[0]
    const isValid = await bcrypt.compare(password, admin.PasswordHash)

    if (!isValid) {
      return res.status(401).json({ message: 'Invalid admin credentials' })
    }

    const token = signToken({
      id: admin.UserID,
      email: admin.Email,
      isAdmin: 1,
      IsAdmin: 1
    })

    res.cookie('gh_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 86400000 // 1 day
    })

    return res.json({
      token,
      admin: {
        AdminID: admin.UserID,
        Username: admin.Email,
        FullName: admin.FullName,
        IsAdmin: 1
      },
      success: true,
      mustChangePassword: false // Legacy flag, password changes are handled via regular flow
    })
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/admin-change-password', requireAdmin, async (req, res) => {
  const newPassword = req.body.newPassword || ''

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters' })
  }

  try {
    const adminId = req.user.id
    const newHash = await bcrypt.hash(newPassword, 10)
    await query('UPDATE Admins SET PasswordHash = ?, MustChangePassword = 0 WHERE AdminID = ?', [newHash, adminId])
    return res.json({ message: 'Admin password changed successfully' })
  } catch (error) {
    logger.error('API Error:', error.message)
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

export default router
