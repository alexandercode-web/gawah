import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDbPool, initDatabase, query } from './db.js'
import { requireAuth, signToken, requireAdmin } from './auth.js'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import rateLimit from 'express-rate-limit'
import nodemailer from 'nodemailer'

// Load environment variables FIRST before anything reads them
dotenv.config()

// Configure email transporter (using Gmail) — lazy-init so env vars are available
let _emailTransporter = null
function getEmailTransporter() {
  if (!_emailTransporter) {
    _emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER || '',
        pass: process.env.GMAIL_APP_PASSWORD || '',
      },
    })
  }
  return _emailTransporter
}

// Replace with your actual domain when deploying
const rpName = 'GawaHelper'
const rpID = 'localhost'
const origin = process.env.CLIENT_ORIGIN || `http://${rpID}:5173`

const app = express()
const port = Number(process.env.PORT || 4000)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsDir = path.resolve(__dirname, '../public/uploads/proofs')
const avatarUploadsDir = path.resolve(__dirname, '../public/uploads/avatars')

const apiRateLimitMax = Number(
  process.env.API_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? 300 : 2000)
)

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: apiRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many requests. Please wait a moment and try again.',
  },
})

const authRateLimitMax = Number(
  process.env.AUTH_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? 10 : 1000)
)

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many auth requests. Please wait a moment and try again.',
  },
})

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))
app.use('/uploads', express.static(path.resolve(__dirname, '../public/uploads')))
app.use('/api/', apiLimiter)
app.use('/api/auth/', authLimiter)
app.use('/api/webauthn/', authLimiter)

app.get('/api/health', (_, res) => {
  res.json({ ok: true, service: 'GawaHelper API' })
})

app.get('/api/public/stats', async (_, res) => {
  try {
    const result = await query(`
      SELECT
        (SELECT COUNT(*) FROM Users) AS TotalUsers,
        (SELECT COUNT(*) FROM Tasks WHERE Status = 'Completed') AS CompletedTasks,
        (SELECT COALESCE(SUM(Budget), 0) FROM Tasks WHERE Status = 'Completed') AS TotalValue
    `)

    return res.json(result[0])
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.get('/api/home/summary', requireAuth, async (req, res) => {
  try {
    const metricsResult = await query(`
      SELECT
        (SELECT COUNT(*) FROM Users) AS TotalUsers,
        (SELECT COUNT(*) FROM Tasks WHERE UserID = ? AND Status = 'Open') AS OpenTasks,
        (SELECT COUNT(*) FROM Tasks WHERE UserID = ? AND Status = 'Completed') AS CompletedTasks,
        (SELECT COALESCE(SUM(Budget), 0) FROM Tasks WHERE UserID = ? AND Status = 'Completed') AS CompletedValue,
        (SELECT COUNT(*)
         FROM TaskAssignments ta
         INNER JOIN Tasks t ON ta.TaskID = t.TaskID
         WHERE ta.HelperID = ? AND t.Status = 'Completed') AS HelperCompletedTasks,
        (SELECT COALESCE(SUM(t.Budget), 0)
         FROM TaskAssignments ta
         INNER JOIN Tasks t ON ta.TaskID = t.TaskID
         WHERE ta.HelperID = ? AND t.Status = 'Completed') AS HelperCompletedValue,
        (SELECT COUNT(*) FROM TaskAssignments WHERE HelperID = ?) AS HelperAcceptedTasks,
        (SELECT COUNT(*) FROM Categories) AS TotalCategories,
        (SELECT COUNT(*) FROM Tasks WHERE UserID = ?) AS MyPostedTasks,
        (SELECT COUNT(*) FROM Tasks WHERE UserID = ? AND Status = 'Completed') AS MyCompletedTasks
      `, [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id])

    // Home feed should show active tasks only (hide closed/completed tasks).
    const recentTasksResult = await query(`
      SELECT DISTINCT
        t.TaskID,
        t.Title,
        t.Location,
        t.Budget,
        t.Status,
        u.FullName AS PosterName,
        u.Rating AS PosterRating,
        c.CategoryName,
        t.CreatedAt
      FROM Tasks t
      INNER JOIN Users u ON t.UserID = u.UserID
      LEFT JOIN Categories c ON t.CategoryID = c.CategoryID
      LEFT JOIN TaskAssignments ta ON ta.TaskID = t.TaskID AND ta.HelperID = ?
      WHERE LOWER(t.Status) NOT IN ('completed', 'cancelled')
        AND (t.Status = 'Open' OR t.UserID = ? OR ta.HelperID = ?)
      ORDER BY t.CreatedAt DESC
      LIMIT 6
    `, [req.user.id, req.user.id, req.user.id])

    return res.json({
      metrics: metricsResult[0],
      recentTasks: recentTasksResult,
    })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.post('/api/webauthn/generate-registration-options', requireAuth, async (req, res) => {
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
    return res.status(500).json({ message: error.message })
  }
})

app.post('/api/webauthn/verify-registration', requireAuth, async (req, res) => {
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
    return res.status(500).json({ message: error.message })
  }
})

app.post('/api/webauthn/generate-authentication-options', async (req, res) => {
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
    return res.status(500).json({ message: error.message })
  }
})

app.post('/api/webauthn/verify-authentication', async (req, res) => {
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

      return res.json({
        user: {
          UserID: user.UserID,
          FullName: user.FullName,
          Email: user.Email,
          ProfileImage: user.ProfileImage || '',
          IsAdmin: user.IsAdmin || 0,
        },
        token,
      })
    }

    return res.status(400).json({ message: 'Verification failed' })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.post('/api/auth/register', async (req, res) => {
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
      'INSERT INTO Users (FullName, Email, PasswordHash, Rating) VALUES (?, ?, ?, ?) RETURNING UserID',
      [fullName, email, passwordHash, 5.0]
    )

    const user = {
      UserID: result[0].UserID,
      FullName: fullName,
      Email: email,
      ProfileImage: '',
    }

    return res.status(201).json({
      message: 'Registration successful. You can now log in.',
      user,
    })
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Email already registered' })
    }
    return res.status(500).json({ message: error.message })
  }
})

app.post('/api/auth/login', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase()
  const password = req.body.password || ''

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' })
  }

  try {
    const result = await query(
      'SELECT UserID, FullName, Email, ProfileImage, PasswordHash, IsAdmin, IsDeactivated FROM Users WHERE Email = ?',
      [email]
    )

    if (result.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const user = result[0]
    if (Number(user.IsDeactivated) === 1) {
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact support.' })
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

    return res.json({
      user: {
        UserID: user.UserID,
        FullName: user.FullName,
        Email: user.Email,
        ProfileImage: user.ProfileImage || '',
        IsAdmin: Number(user.IsAdmin || 0),
      },
      token,
    })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
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
    return res.status(500).json({ message: error.message })
  }
})

app.post('/api/auth/forgot-password/request-code', async (req, res) => {
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
    try {
      const transporter = getEmailTransporter()
      await transporter.sendMail({
        from: `"GawaHelper" <${process.env.GMAIL_USER}>`,
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
    } catch (emailError) {
      console.error('Email sending failed:', emailError.message)
      return res.status(500).json({ message: 'Failed to send reset code email. Please check your email configuration.' })
    }

    return res.json({ message: 'Reset code sent to your email' })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.post('/api/auth/forgot-password/verify-code', async (req, res) => {
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
    return res.status(500).json({ message: error.message })
  }
})

app.post('/api/auth/forgot-password/reset', async (req, res) => {
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
    return res.status(500).json({ message: error.message })
  }
})

app.get('/api/users', requireAuth, async (_req, res) => {
  try {
    const result = await query(`
      SELECT UserID, FullName, Email, CreatedAt
      FROM Users
      ORDER BY CreatedAt DESC
    `)

    return res.json(result)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.get('/api/categories', async (_, res) => {
  try {
    const result = await query('SELECT CategoryID, CategoryName FROM Categories ORDER BY CategoryName')
    return res.json(result)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.post('/api/categories', requireAuth, async (req, res) => {
  const { categoryName } = req.body

  if (!categoryName) {
    return res.status(400).json({ message: 'categoryName is required' })
  }

  try {
    const result = await query('INSERT INTO Categories (CategoryName) VALUES (?) RETURNING CategoryID', [
      categoryName,
    ])

    return res.status(201).json({
      CategoryID: result[0].CategoryID,
      CategoryName: categoryName,
    })
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Category already exists' })
    }
    return res.status(500).json({ message: error.message })
  }
})

app.patch('/api/categories/:categoryId', requireAuth, async (req, res) => {
  const categoryId = Number(req.params.categoryId)
  const categoryName = String(req.body.categoryName || '').trim()

  if (!Number.isFinite(categoryId) || categoryId <= 0) {
    return res.status(400).json({ message: 'Invalid category id' })
  }

  if (!categoryName) {
    return res.status(400).json({ message: 'categoryName is required' })
  }

  try {
    const exists = await query('SELECT CategoryID FROM Categories WHERE CategoryID = ? LIMIT 1', [categoryId])

    if (exists.length === 0) {
      return res.status(404).json({ message: 'Category not found' })
    }

    await query('UPDATE Categories SET CategoryName = ? WHERE CategoryID = ?', [categoryName, categoryId])

    const updated = await query('SELECT CategoryID, CategoryName FROM Categories WHERE CategoryID = ?', [categoryId])
    return res.json(updated[0])
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Category already exists' })
    }
    return res.status(500).json({ message: error.message })
  }
})

app.delete('/api/categories/:categoryId', requireAuth, async (req, res) => {
  const categoryId = Number(req.params.categoryId)

  if (!Number.isFinite(categoryId) || categoryId <= 0) {
    return res.status(400).json({ message: 'Invalid category id' })
  }

  try {
    const exists = await query('SELECT CategoryID FROM Categories WHERE CategoryID = ? LIMIT 1', [categoryId])

    if (exists.length === 0) {
      return res.status(404).json({ message: 'Category not found' })
    }

    const inUse = await query('SELECT COUNT(*) AS Total FROM Tasks WHERE CategoryID = ?', [categoryId])
    const total = Number(inUse[0]?.Total || 0)

    if (total > 0) {
      return res.status(409).json({ message: 'Cannot delete category with existing tasks' })
    }

    await query('DELETE FROM Categories WHERE CategoryID = ?', [categoryId])
    return res.json({ message: 'Category deleted', categoryId })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.get('/api/tasks', async (req, res) => {
  const { status, categoryId } = req.query

  try {
    const params = []

    let sqlQuery = `
      SELECT
        t.TaskID,
        t.Title,
        t.Description,
        t.Location,
        t.TaskTime,
        t.Budget,
        t.Status,
        t.CreatedAt,
        u.FullName AS PosterName,
        u.ProfileImage AS PosterProfileImage,
        c.CategoryName
      FROM Tasks t
      INNER JOIN Users u ON t.UserID = u.UserID
      LEFT JOIN Categories c ON t.CategoryID = c.CategoryID
      WHERE 1 = 1
    `

    if (status) {
      sqlQuery += ' AND t.Status = ?'
      params.push(status)
    }

    if (categoryId) {
      sqlQuery += ' AND t.CategoryID = ?'
      params.push(Number(categoryId))
    }

    sqlQuery += ' ORDER BY t.CreatedAt DESC'

    const result = await query(sqlQuery, params)
    return res.json(result)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.get('/api/tasks/:taskId', async (req, res) => {
  const taskId = Number(req.params.taskId)

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return res.status(400).json({ message: 'Invalid task id' })
  }

  try {
    const result = await query(
      `
        SELECT
          t.TaskID,
          t.UserID,
          t.Title,
          t.Description,
          t.Location,
          t.TaskTime,
          t.Budget,
          t.Status,
          t.CreatedAt,
          u.FullName AS PosterName,
          u.ProfileImage AS PosterProfileImage,
          u.Rating AS PosterRating,
          c.CategoryName,
          ta.HelperID,
          ta.AcceptedAt AS HelperAcceptedAt,
          ta.ProofImage,
          hu.FullName AS HelperName,
          hu.ProfileImage AS HelperProfileImage,
          hu.Rating AS HelperRating,
          rv.ReviewID AS PosterReviewID,
          rv.Rating AS PosterReviewRating,
          rv.Comment AS PosterReviewComment,
          p.PaymentMethod
        FROM Tasks t
        INNER JOIN Users u ON t.UserID = u.UserID
        LEFT JOIN Categories c ON t.CategoryID = c.CategoryID
        LEFT JOIN (
          SELECT ta1.TaskID, ta1.HelperID, ta1.AcceptedAt, ta1.ProofImage
          FROM TaskAssignments ta1
          INNER JOIN (
            SELECT TaskID, MAX(AcceptedAt) AS LatestAcceptedAt
            FROM TaskAssignments
            GROUP BY TaskID
          ) latest
            ON latest.TaskID = ta1.TaskID
           AND latest.LatestAcceptedAt = ta1.AcceptedAt
        ) ta ON ta.TaskID = t.TaskID
        LEFT JOIN Users hu ON hu.UserID = ta.HelperID
        LEFT JOIN Reviews rv
          ON rv.TaskID = t.TaskID
         AND rv.ReviewerID = t.UserID
         AND rv.ReviewedUserID = ta.HelperID
        LEFT JOIN Payments p ON p.TaskID = t.TaskID
        WHERE t.TaskID = ?
        LIMIT 1
      `,
      [taskId]
    )

    if (result.length === 0) {
      return res.status(404).json({ message: 'Task not found' })
    }

    return res.json(result[0])
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.post('/api/tasks', requireAuth, async (req, res) => {
  const { title, description, location, taskTime, budget, categoryId, paymentMethod } = req.body
  const parsedBudget = Math.round(Number(budget))

  if (!title || !description || !location || !taskTime || budget === undefined || !categoryId) {
    return res.status(400).json({ message: 'Missing required task fields' })
  }

  if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
    return res.status(400).json({ message: 'Budget must be greater than 0' })
  }

  const method = paymentMethod && ['Cash', 'GCash'].includes(paymentMethod) ? paymentMethod : 'Cash'

  try {
    const insert = await query(
      `INSERT INTO Tasks (UserID, Title, Description, Location, TaskTime, Budget, CategoryID)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING TaskID`,
      [
        req.user.id,
        title,
        description,
        location,
        new Date(taskTime),
        parsedBudget,
        Number(categoryId),
      ]
    )

    // Create a Payment record with the selected payment method
    await query(
      `INSERT INTO Payments (TaskID, Amount, PaymentMethod, Status, PayerUserID)
       VALUES (?, ?, ?, 'Pending', ?)`,
      [insert[0].TaskID, parsedBudget, method, req.user.id]
    )

    const created = await query('SELECT * FROM Tasks WHERE TaskID = ?', [insert[0].TaskID])
    return res.status(201).json(created[0])
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.patch('/api/tasks/:taskId', requireAuth, async (req, res) => {
  const taskId = Number(req.params.taskId)
  const { title, description, location, taskTime, budget, categoryId } = req.body || {}
  const parsedBudget = Math.round(Number(budget))

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return res.status(400).json({ message: 'Invalid task id' })
  }

  if (!title || !description || !location || !taskTime || budget === undefined || !categoryId) {
    return res.status(400).json({ message: 'Missing required task fields' })
  }

  if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
    return res.status(400).json({ message: 'Budget must be greater than 0' })
  }

  try {
    const taskRows = await query(
      'SELECT TaskID, UserID, Status FROM Tasks WHERE TaskID = ? LIMIT 1',
      [taskId]
    )

    if (taskRows.length === 0) {
      return res.status(404).json({ message: 'Task not found' })
    }

    const task = taskRows[0]

    if (Number(task.UserID) !== Number(req.user.id)) {
      return res.status(403).json({ message: 'Only the task poster can update this task' })
    }

    const currentStatus = String(task.Status || '').toLowerCase()
    if (currentStatus !== 'open') {
      return res.status(400).json({ message: 'Only open tasks can be edited' })
    }

    await query(
      `
        UPDATE Tasks
        SET Title = ?, Description = ?, Location = ?, TaskTime = ?, Budget = ?, CategoryID = ?
        WHERE TaskID = ?
      `,
      [
        String(title).trim(),
        String(description).trim(),
        String(location).trim(),
        new Date(taskTime),
        parsedBudget,
        Number(categoryId),
        taskId,
      ]
    )

    const updated = await query('SELECT * FROM Tasks WHERE TaskID = ?', [taskId])
    return res.json(updated[0])
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.delete('/api/tasks/:taskId', requireAuth, async (req, res) => {
  const taskId = Number(req.params.taskId)

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return res.status(400).json({ message: 'Invalid task id' })
  }

  try {
    const taskRows = await query(
      'SELECT TaskID, UserID, Status FROM Tasks WHERE TaskID = ? LIMIT 1',
      [taskId]
    )

    if (taskRows.length === 0) {
      return res.status(404).json({ message: 'Task not found' })
    }

    const task = taskRows[0]

    if (Number(task.UserID) !== Number(req.user.id)) {
      return res.status(403).json({ message: 'Only the task poster can delete this task' })
    }

    const currentStatus = String(task.Status || '').toLowerCase()
    if (currentStatus.includes('complete')) {
      return res.status(400).json({ message: 'Completed tasks cannot be deleted' })
    }

    await query('DELETE FROM Notifications WHERE TaskID = ?', [taskId])
    await query('DELETE FROM Messages WHERE TaskID = ?', [taskId])
    await query('DELETE FROM Reviews WHERE TaskID = ?', [taskId])
    await query('DELETE FROM Payments WHERE TaskID = ?', [taskId])
    await query('DELETE FROM TaskAssignments WHERE TaskID = ?', [taskId])
    await query('DELETE FROM Tasks WHERE TaskID = ?', [taskId])

    return res.json({ message: 'Task deleted', taskId })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.post('/api/tasks/:taskId/apply', requireAuth, async (req, res) => {
  const taskId = Number(req.params.taskId)
  const userId = Number(req.user.id)

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return res.status(400).json({ message: 'Invalid task id' })
  }

  const pool = await getDbPool()
  const conn = await pool.getConnection()

  try {
    const userCheck = await query('SELECT UserID FROM Users WHERE UserID = ?', [userId])
    if (userCheck.length === 0) {
      return res.status(401).json({ message: 'Your session is from an old database. Please Log Out and Log In again.' })
    }
    await conn.beginTransaction()

    const [taskResult] = await conn.query(
      'SELECT Status, UserID, Title FROM Tasks WHERE TaskID = ? FOR UPDATE',
      [taskId]
    )

    if (taskResult.length === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'Task not found' })
    }

    if (Number(taskResult[0].UserID) === userId) {
      await conn.rollback()
      return res.status(400).json({ message: 'You cannot apply to your own task' })
    }

    if (String(taskResult[0].Status || '') !== 'Open') {
      await conn.rollback()
      return res.status(400).json({ message: 'Task is not open' })
    }

    const [existingAssignments] = await conn.query(
      'SELECT AssignmentID, HelperID FROM TaskAssignments WHERE TaskID = ? LIMIT 1 FOR UPDATE',
      [taskId]
    )

    if (existingAssignments.length > 0) {
      await conn.rollback()
      const claimedBySameUser = Number(existingAssignments[0].HelperID) === userId
      return res.status(409).json({
        message: claimedBySameUser
          ? 'You already applied to this task'
          : 'Task is already assigned to another helper',
      })
    }

    const [inserted] = await conn.query(
      'INSERT INTO TaskAssignments (TaskID, HelperID) VALUES (?, ?)',
      [taskId, userId]
    )

    await conn.query('UPDATE Tasks SET Status = $1 WHERE TaskID = $2', ['Assigned', taskId])

    // Get helper name for notification
    const [helperUserRows] = await conn.query('SELECT FullName FROM Users WHERE UserID = $1', [userId])
    const helperName = helperUserRows[0]?.FullName || 'A helper'
    const taskTitle = taskResult[0].Title || 'your task'
    const posterUserId = taskResult[0].UserID

    // Create notification for task poster with SenderID and TaskID
    await conn.query(
      'INSERT INTO Notifications (UserID, SenderID, TaskID, Message, IsRead, CreatedAt) VALUES ($1, $2, $3, $4, $5, NOW())',
      [posterUserId, userId, taskId, `${helperName} accepted your task "${taskTitle}"`, 0]
    )

    await conn.commit()

    const assignment = await query('SELECT * FROM TaskAssignments WHERE AssignmentID = ?', [
      inserted.insertId,
    ])

    return res.status(201).json(assignment[0])
  } catch (error) {
    try {
      await conn.rollback()
    } catch {
      // Best effort rollback.
    }

    if (error?.code === '23505') {
      return res.status(409).json({ message: 'Task is already assigned to another helper' })
    }

    return res.status(500).json({ message: error.message })
  } finally {
    conn.release()
  }
})

app.post('/api/tasks/:taskId/cancel', requireAuth, async (req, res) => {
  const taskId = Number(req.params.taskId)
  const reason = (req.body.reason || '').trim()

  if (!reason) {
    return res.status(400).json({ message: 'Cancellation reason is required' })
  }

  try {
    const taskResult = await query('SELECT TaskID, UserID, Status FROM Tasks WHERE TaskID = ?', [taskId])

    if (taskResult.length === 0) {
      return res.status(404).json({ message: 'Task not found' })
    }

    const task = taskResult[0]
    const status = String(task.Status || '').toLowerCase()

    if (status === 'completed' || status === 'cancelled') {
      return res.status(400).json({ message: 'Task can no longer be cancelled' })
    }

    if (Number(task.UserID) === Number(req.user.id)) {
      await query('UPDATE Tasks SET Status = ? WHERE TaskID = ?', ['Cancelled', taskId])

      // Get the task details for notification
      const taskDetails = await query('SELECT Title FROM Tasks WHERE TaskID = ?', [taskId])
      const taskTitle = taskDetails[0]?.Title || 'Unknown Task'

      // Notify any helpers if the task was assigned
      const assignments = await query('SELECT HelperID FROM TaskAssignments WHERE TaskID = ?', [taskId])
      for (const assignment of assignments) {
        const notificationMessage = `Task "${taskTitle}" has been cancelled by the poster.`
        await query(
          'INSERT INTO Notifications (UserID, SenderID, TaskID, Message, IsRead, CreatedAt) VALUES (?, ?, ?, ?, ?, NOW())',
          [assignment.HelperID, req.user.id, taskId, notificationMessage.slice(0, 255), 0]
        )
      }

      return res.json({ message: 'Task cancelled by poster', taskId, reason })
    }

    const assignment = await query(
      'SELECT AssignmentID, AcceptedAt FROM TaskAssignments WHERE TaskID = ? AND HelperID = ? LIMIT 1',
      [taskId, req.user.id]
    )

    if (assignment.length === 0) {
      return res.status(403).json({ message: 'You can only cancel tasks you accepted' })
    }

    // Helper cancelling their acceptance
    await query('DELETE FROM TaskAssignments WHERE TaskID = ? AND HelperID = ?', [taskId, req.user.id])
    await query('UPDATE Tasks SET Status = ? WHERE TaskID = ?', ['Open', taskId])

    // Get the helper name and task title
    const helperUser = await query('SELECT FullName FROM Users WHERE UserID = ?', [req.user.id])
    const taskDetails = await query('SELECT Title FROM Tasks WHERE TaskID = ?', [taskId])
    const helperName = helperUser[0]?.FullName || 'A helper'
    const taskTitle = taskDetails[0]?.Title || 'Unknown Task'

    // Notify the task poster
    const notificationMessage = `${helperName} cancelled their acceptance of task "${taskTitle}".`
    await query(
      'INSERT INTO Notifications (UserID, SenderID, TaskID, Message, IsRead, CreatedAt) VALUES (?, ?, ?, ?, ?, NOW())',
      [task.UserID, req.user.id, taskId, notificationMessage.slice(0, 255), 0]
    )

    return res.json({ message: 'Task acceptance cancelled', taskId, reason })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.post('/api/tasks/:taskId/proof', requireAuth, async (req, res) => {
  const taskId = Number(req.params.taskId)
  const fileName = (req.body.fileName || '').trim()
  const proofDataUrl = (req.body.proofDataUrl || '').trim()
  let proofValue = ''

  if (!proofDataUrl) {
    return res.status(400).json({ message: 'Proof image upload is required' })
  }

  try {
    const matches = proofDataUrl.match(/^data:image\/(png|jpeg);base64,(.+)$/i)

    if (!matches) {
      return res.status(400).json({ message: 'Invalid proof image format' })
    }

    const extension = matches[1].toLowerCase() === 'jpeg' ? 'jpg' : 'png'
    const base64Payload = matches[2]
    const safeFileName = `proof-${taskId}-${Date.now()}-${Math.round(Math.random() * 1e9)}.${extension}`

    await mkdir(uploadsDir, { recursive: true })
    await writeFile(path.join(uploadsDir, safeFileName), Buffer.from(base64Payload, 'base64'))

    proofValue = `/uploads/proofs/${safeFileName}`

    const assignment = await query(
      `
        SELECT AssignmentID
        FROM TaskAssignments
        WHERE TaskID = ? AND HelperID = ?
        LIMIT 1
      `,
      [taskId, req.user.id]
    )

    if (assignment.length === 0) {
      return res.status(403).json({ message: 'Only the assigned helper can submit proof' })
    }

    const taskRows = await query(
      'SELECT UserID, Title, Budget FROM Tasks WHERE TaskID = ? LIMIT 1',
      [taskId]
    )

    if (taskRows.length === 0) {
      return res.status(404).json({ message: 'Task not found' })
    }

    const taskMeta = taskRows[0]

    await query(
      'UPDATE TaskAssignments SET ProofImage = ? WHERE AssignmentID = ?',
      [proofValue, assignment[0].AssignmentID]
    )

    await query('UPDATE Tasks SET Status = ? WHERE TaskID = ?', ['WaitingForReview', taskId])

    const completedHelperTasks = await query(
      `
        SELECT COUNT(*) AS CompletedCount
        FROM TaskAssignments ta
        INNER JOIN Tasks t ON ta.TaskID = t.TaskID
        WHERE ta.HelperID = ? AND t.Status = 'Completed'
      `,
      [req.user.id]
    )

    // Don't update rating yet - wait for approval
    // const completedCount = Number(completedHelperTasks[0]?.CompletedCount || 0)
    // const computedRating = Math.min(5, Math.max(0, 4 + completedCount * 0.1))
    // await query('UPDATE Users SET Rating = ? WHERE UserID = ?', [computedRating, req.user.id])

    const helperRows = await query('SELECT FullName FROM Users WHERE UserID = ? LIMIT 1', [req.user.id])
    const helperName = helperRows[0]?.FullName || 'Your helper'
    const notificationMessage = `${helperName} submitted proof for "${taskMeta.Title}". Please review and approve.`

    console.log(`Creating proof notification: posterID=${taskMeta.UserID}, helperID=${req.user.id}, taskID=${taskId}`)
    await query(
      'INSERT INTO Notifications (UserID, SenderID, TaskID, Message, IsRead, CreatedAt) VALUES (?, ?, ?, ?, ?, NOW())',
      [taskMeta.UserID, req.user.id, taskId, notificationMessage.slice(0, 255), 0]
    )
    console.log(`Proof notification created successfully for task ${taskId}`)

    return res.json({ message: 'Proof submitted successfully', taskId, fileName, status: 'WaitingForReview' })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.post('/api/tasks/:taskId/review', requireAuth, async (req, res) => {
  const taskId = Number(req.params.taskId)
  const rating = Number(req.body.rating)
  const comment = (req.body.comment || '').trim()

  if (!Number.isFinite(rating) || rating < 0.5 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be between 0.5 and 5' })
  }

  try {
    const taskRows = await query(
      `
        SELECT t.TaskID, t.UserID, t.Status, ta.HelperID, t.Title
        FROM Tasks t
        LEFT JOIN TaskAssignments ta ON ta.TaskID = t.TaskID
        WHERE t.TaskID = ?
        ORDER BY ta.AcceptedAt DESC
        LIMIT 1
      `,
      [taskId]
    )

    if (taskRows.length === 0) {
      return res.status(404).json({ message: 'Task not found' })
    }

    const task = taskRows[0]

    if (Number(task.UserID) !== Number(req.user.id)) {
      return res.status(403).json({ message: 'Only the task poster can rate the helper' })
    }

    if (!String(task.Status || '').toLowerCase().includes('complete')) {
      return res.status(400).json({ message: 'You can rate only after task completion' })
    }

    if (!task.HelperID) {
      return res.status(400).json({ message: 'No helper assigned for this task' })
    }

    const existingReview = await query(
      `
        SELECT ReviewID
        FROM Reviews
        WHERE TaskID = ? AND ReviewerID = ? AND ReviewedUserID = ?
        LIMIT 1
      `,
      [taskId, req.user.id, task.HelperID]
    )

    if (existingReview.length > 0) {
      await query('UPDATE Reviews SET Rating = ?, Comment = ? WHERE ReviewID = ?', [rating, comment, existingReview[0].ReviewID])
    } else {
      await query(
        'INSERT INTO Reviews (TaskID, ReviewerID, ReviewedUserID, Rating, Comment) VALUES (?, ?, ?, ?, ?)',
        [taskId, req.user.id, task.HelperID, rating, comment]
      )
    }

    const ratingRows = await query(
      'SELECT AVG(Rating) AS AvgRating FROM Reviews WHERE ReviewedUserID = ?',
      [task.HelperID]
    )

    const avgRating = Number(ratingRows[0]?.AvgRating || 5.0)
    const roundedRating = Math.round(avgRating * 10) / 10
    await query('UPDATE Users SET Rating = ? WHERE UserID = ?', [roundedRating, task.HelperID])

    const posterName = await query('SELECT FullName FROM Users WHERE UserID = ?', [req.user.id])
    const notificationMessage = `${posterName[0]?.FullName || 'Task poster'} gave you a ${rating}-star rating for "${task.Title}".`

    console.log(`Creating rating notification: helperID=${task.HelperID}, posterID=${req.user.id}, taskID=${taskId}`)
    await query(
      'INSERT INTO Notifications (UserID, SenderID, TaskID, Message, IsRead, CreatedAt) VALUES (?, ?, ?, ?, ?, NOW())',
      [task.HelperID, req.user.id, taskId, notificationMessage.slice(0, 255), 0]
    )

    return res.json({ message: 'Helper rated successfully', taskId, rating, helperRating: roundedRating })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const rows = await query(
      `
        SELECT NotificationID, Message, IsRead, SenderID, TaskID, CreatedAt
        FROM Notifications
        WHERE UserID = ?
        ORDER BY CreatedAt DESC
        LIMIT 50
      `,
      [req.user.id]
    )

    console.log('Notifications returned:', rows)
    return res.json(rows)
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return res.status(500).json({ message: error.message })
  }
})

app.patch('/api/notifications/:notificationId', requireAuth, async (req, res) => {
  try {
    const { notificationId } = req.params

    await query(
      `
        UPDATE Notifications
        SET IsRead = 1
        WHERE NotificationID = ? AND UserID = ?
      `,
      [notificationId, req.user.id]
    )

    return res.json({ message: 'Notification marked as read' })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.get('/api/messages/:otherUserId/:taskId', requireAuth, async (req, res) => {
  try {
    const { otherUserId, taskId } = req.params

    const taskRows = await query(
      `
        SELECT t.UserID AS PosterID, ta.HelperID
        FROM Tasks t
        LEFT JOIN TaskAssignments ta ON ta.TaskID = t.TaskID
        WHERE t.TaskID = ?
        LIMIT 1
      `,
      [taskId]
    )

    const taskRow = taskRows[0]
    const helperId = Number(taskRow?.HelperID || 0)
    const posterId = Number(taskRow?.PosterID || 0)
    const currentUserId = Number(req.user.id)
    const otherId = Number(otherUserId)

    if (!taskRow || !helperId) {
      return res.status(403).json({ message: 'Chat is available after a helper accepts this task.' })
    }

    const isAllowedParticipant =
      (currentUserId === posterId && otherId === helperId) ||
      (currentUserId === helperId && otherId === posterId)

    if (!isAllowedParticipant) {
      return res.status(403).json({ message: 'You can only chat with the assigned helper or poster for this task.' })
    }

    const rows = await query(
      `
        SELECT MessageID, TaskID, SenderID, RecipientID, Content, AttachmentType, AttachmentData, AttachmentName, AttachmentMime, IsRead, CreatedAt
        FROM Messages
        WHERE TaskID = ? AND (
          (SenderID = ? AND RecipientID = ?) OR
          (SenderID = ? AND RecipientID = ?)
        )
        ORDER BY CreatedAt ASC
      `,
      [taskId, req.user.id, otherUserId, otherUserId, req.user.id]
    )

    return res.json(rows)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.post('/api/messages', requireAuth, async (req, res) => {
  try {
    const { taskId, recipientId, attachmentType, attachmentData, attachmentName, attachmentMime } = req.body
    let { content } = req.body

    // Resilience: if content is an object (from old API calls), extract the string
    if (content && typeof content === 'object' && content.content) {
      content = content.content
    }

    const taskRows = await query(
      `
        SELECT t.UserID AS PosterID, ta.HelperID
        FROM Tasks t
        LEFT JOIN TaskAssignments ta ON ta.TaskID = t.TaskID
        WHERE t.TaskID = ?
        LIMIT 1
      `,
      [taskId]
    )

    const taskRow = taskRows[0]
    const helperId = Number(taskRow?.HelperID || 0)
    const posterId = Number(taskRow?.PosterID || 0)
    const currentUserId = Number(req.user.id)
    const recipientUserId = Number(recipientId)

    if (!taskId || !recipientId || (!content && !attachmentData)) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    if (!taskRow || !helperId) {
      return res.status(403).json({ message: 'Chat is available after a helper accepts this task.' })
    }

    const isAllowedParticipant =
      (currentUserId === posterId && recipientUserId === helperId) ||
      (currentUserId === helperId && recipientUserId === posterId)

    if (!isAllowedParticipant) {
      return res.status(403).json({ message: 'You can only message the assigned helper or poster for this task.' })
    }

    await query(
      `
        INSERT INTO Messages (TaskID, SenderID, RecipientID, Content, AttachmentType, AttachmentData, AttachmentName, AttachmentMime)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        taskId,
        req.user.id,
        recipientId,
        content || '',
        attachmentType || null,
        attachmentData || null,
        attachmentName || null,
        attachmentMime || null
      ]
    )

    // Get sender name for notification
    const senderRows = await query('SELECT FullName FROM Users WHERE UserID = ?', [req.user.id])
    const senderName = senderRows[0]?.FullName || 'Someone'

    // Notification message cleanup
    const displayContent = content || (attachmentType === 'image' ? 'an image' : attachmentName || 'a file')
    const safeContent = String(displayContent)
    const notificationMessage = `${senderName} sent you a message: "${safeContent.substring(0, 50)}${safeContent.length > 50 ? '...' : ''}"`

    // Create notification for recipient
    console.log(`Creating message notification: recipientID=${recipientId}, senderID=${req.user.id}, taskID=${taskId}`)
    await query(
      'INSERT INTO Notifications (UserID, SenderID, TaskID, Message, IsRead, CreatedAt) VALUES (?, ?, ?, ?, ?, NOW())',
      [recipientId, req.user.id, taskId, notificationMessage.slice(0, 255), 0]
    )

    return res.json({ message: 'Message sent' })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

// Batch mark as read for a specific task
app.patch('/api/messages/mark-as-read/:taskId', requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params

    await query(
      `
        UPDATE Messages
        SET IsRead = 1
        WHERE TaskID = ? AND RecipientID = ? AND IsRead = 0
      `,
      [taskId, req.user.id]
    )

    return res.json({ message: 'Messages marked as read' })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.patch('/api/messages/:messageId', requireAuth, async (req, res) => {
  try {
    const { messageId } = req.params

    await query(
      `
        UPDATE Messages
        SET IsRead = 1
        WHERE MessageID = ? AND RecipientID = ?
      `,
      [messageId, req.user.id]
    )

    return res.json({ message: 'Message marked as read' })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.get('/api/me/rating-summary', requireAuth, async (req, res) => {
  try {
    const userRows = await query('SELECT Rating FROM Users WHERE UserID = ? LIMIT 1', [req.user.id])
    const reviewRows = await query(
      'SELECT COUNT(*) AS ReviewCount FROM Reviews WHERE ReviewedUserID = ?',
      [req.user.id]
    )

    return res.json({
      rating: Number(userRows[0]?.Rating || 5.0),
      reviewCount: Number(reviewRows[0]?.ReviewCount || 0),
    })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.post('/api/me/profile-image', requireAuth, async (req, res) => {
  const imageDataUrl = String(req.body?.imageDataUrl || '').trim()
  const fileName = String(req.body?.fileName || '').trim()

  if (!imageDataUrl) {
    return res.status(400).json({ message: 'Profile image is required' })
  }

  try {
    const matches = imageDataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i)
    if (!matches) {
      return res.status(400).json({ message: 'Invalid image format. Use PNG, JPG, or WEBP.' })
    }

    const extension = matches[1].toLowerCase() === 'jpeg' ? 'jpg' : matches[1].toLowerCase()
    const base64Payload = matches[2]
    const bytes = Buffer.from(base64Payload, 'base64')

    if (bytes.length > 10 * 1024 * 1024) {
      return res.status(400).json({ message: 'Image must be 10MB or smaller' })
    }

    const safeFileName = `avatar-${req.user.id}-${Date.now()}-${Math.round(Math.random() * 1e9)}.${extension}`
    const storedPath = `/uploads/avatars/${safeFileName}`

    const existingRows = await query('SELECT ProfileImage FROM Users WHERE UserID = ? LIMIT 1', [req.user.id])
    const previousImage = String(existingRows[0]?.ProfileImage || '').trim()

    await mkdir(avatarUploadsDir, { recursive: true })
    await writeFile(path.join(avatarUploadsDir, safeFileName), bytes)
    await query('UPDATE Users SET ProfileImage = ? WHERE UserID = ?', [storedPath, req.user.id])

    const normalizedPrevious = previousImage.replace(/\\+/g, '/')
    if (normalizedPrevious.startsWith('/uploads/avatars/') || normalizedPrevious.startsWith('uploads/avatars/')) {
      const removableName = path.basename(normalizedPrevious)
      if (removableName && removableName !== safeFileName) {
        try {
          await unlink(path.join(avatarUploadsDir, removableName))
        } catch {
          // Ignore removal issues for old avatar files.
        }
      }
    }

    return res.json({
      message: 'Profile image updated successfully',
      profileImage: storedPath,
      fileName: fileName || safeFileName,
    })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.patch('/api/tasks/:taskId/approve-proof', requireAuth, async (req, res) => {
  const taskId = Number(req.params.taskId)

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return res.status(400).json({ message: 'Invalid task id' })
  }

  try {
    // Verify task exists and current user is the poster
    const taskRows = await query(
      'SELECT TaskID, UserID, Status, Title, Budget FROM Tasks WHERE TaskID = ? LIMIT 1',
      [taskId]
    )

    if (taskRows.length === 0) {
      return res.status(404).json({ message: 'Task not found' })
    }

    const task = taskRows[0]
    const isPoster = Number(task.UserID) === Number(req.user.id)

    if (!isPoster) {
      return res.status(403).json({ message: 'Only the task poster can approve proof' })
    }

    if (task.Status !== 'WaitingForReview') {
      return res.status(400).json({ message: 'Task is not waiting for review' })
    }

    // Resolve helper from the submitted proof to avoid mismatched payouts.
    const assignmentRows = await query(
      `
        SELECT ta.HelperID
        FROM TaskAssignments ta
        WHERE ta.TaskID = ?
          AND ta.ProofImage IS NOT NULL
        ORDER BY ta.AcceptedAt DESC, ta.AssignmentID DESC
        LIMIT 2
      `,
      [taskId]
    )

    if (assignmentRows.length === 0) {
      return res.status(404).json({ message: 'No submitted proof found for this task' })
    }

    if (assignmentRows.length > 1) {
      return res.status(409).json({ message: 'Multiple helper proofs detected. Resolve helper assignment before approval.' })
    }

    const helperID = assignmentRows[0].HelperID

    // Mark task as ProofApproved (waiting for helper to confirm payment)
    await query('UPDATE Tasks SET Status = ? WHERE TaskID = ?', ['ProofApproved', taskId])

    // Get helper and poster names for notifications
    const helperRows = await query('SELECT FullName FROM Users WHERE UserID = ? LIMIT 1', [helperID])
    const helperName = helperRows[0]?.FullName || 'Helper'

    const posterRows = await query('SELECT FullName FROM Users WHERE UserID = ? LIMIT 1', [req.user.id])
    const posterName = posterRows[0]?.FullName || 'Task poster'

    // Notify helper that proof was approved and payment is waiting
    const approvalNotifText = `${posterName} approved your proof for "${task.Title}". Your payment of P${Number(task.Budget || 0).toFixed(2)} is ready. Click "Payment Received" to confirm.`

    await query(
      'INSERT INTO Notifications (UserID, SenderID, TaskID, Message, IsRead, CreatedAt) VALUES (?, ?, ?, ?, ?, NOW())',
      [helperID, req.user.id, taskId, approvalNotifText.slice(0, 255), 0]
    )

    return res.json({ message: 'Task approved successfully. Waiting for helper to confirm payment.', taskId, status: 'ProofApproved' })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.post('/api/tasks/:taskId/payment-received', requireAuth, async (req, res) => {
  const taskId = Number(req.params.taskId)

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return res.status(400).json({ message: 'Invalid task id' })
  }

  const pool = await getDbPool()
  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    const [taskResult] = await conn.execute(
      'SELECT TaskID, UserID, Title, Budget, Status FROM Tasks WHERE TaskID = ? LIMIT 1 FOR UPDATE',
      [taskId]
    )

    if (taskResult.length === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'Task not found' })
    }

    const task = taskResult[0]
    const isAdmin = Number(req.user.isAdmin || req.user.IsAdmin) === 1 || req.user.role === 'admin'

    let assignmentRows;
    if (isAdmin) {
      // Admin can confirm for ANY helper assigned to this task
      assignmentRows = await conn.execute(
        `
          SELECT AssignmentID, HelperID
          FROM TaskAssignments
          WHERE TaskID = ?
            AND ProofImage IS NOT NULL
          ORDER BY AcceptedAt DESC, AssignmentID DESC
          LIMIT 1
        `,
        [taskId]
      )
    } else {
      // Regular user must be the assigned helper
      assignmentRows = await conn.execute(
        `
          SELECT AssignmentID, HelperID
          FROM TaskAssignments
          WHERE TaskID = ?
            AND HelperID = ?
            AND ProofImage IS NOT NULL
          ORDER BY AcceptedAt DESC, AssignmentID DESC
          LIMIT 1
        `,
        [taskId, req.user.id]
      )
    }

    if (assignmentRows[0].length === 0) {
      await conn.rollback()
      return res.status(403).json({
        message: isAdmin
          ? 'No helper assignment with proof found for this task'
          : 'Only the helper who submitted proof can confirm payment'
      })
    }

    const helperId = Number(assignmentRows[0][0].HelperID)
    const posterId = Number(task.UserID)

    if (helperId === posterId) {
      await conn.rollback()
      return res.status(400).json({ message: 'Poster and helper cannot be the same user for payout transfer' })
    }

    // Only allow confirmation after poster approval.
    if (String(task.Status || '').toLowerCase() !== 'proofapproved') {
      await conn.rollback()
      return res.status(400).json({ message: 'Task is not in ProofApproved status' })
    }

    const paymentRows = await conn.execute(
      'SELECT PaymentID, Amount, Status, PayerUserID, PayeeUserID FROM Payments WHERE TaskID = ? LIMIT 1 FOR UPDATE',
      [taskId]
    )

    if (paymentRows[0].length === 0) {
      console.log(`Missing payment record for task ${taskId}. Creating one...`);
      await conn.execute(
        'INSERT INTO Payments (TaskID, Amount, PaymentMethod, Status, PayerUserID) VALUES (?, ?, ?, ?, ?)',
        [taskId, task.Budget, 'Cash', 'Pending', posterId]
      );

      // Re-query to get the new payment record
      const [retryPaymentRows] = await conn.execute(
        'SELECT PaymentID, Amount, Status, PayerUserID, PayeeUserID FROM Payments WHERE TaskID = ? LIMIT 1 FOR UPDATE',
        [taskId]
      );
      paymentRows[0] = retryPaymentRows;
    }

    if (paymentRows[0].length === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'Payment record could not be created for this task' })
    }

    const payment = paymentRows[0][0]
    if (String(payment.Status || '').toLowerCase() === 'completed') {
      await conn.rollback()
      return res.status(409).json({ message: 'Payment for this task is already completed' })
    }

    const transferAmount = Number(payment.Amount || task.Budget || 0)
    if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
      await conn.rollback()
      return res.status(400).json({ message: 'Invalid payment amount for this task' })
    }

    // Transfer value from poster (payer) to helper (payee).
    await conn.execute(
      'UPDATE Users SET WalletBalance = WalletBalance - ? WHERE UserID = ?',
      [transferAmount, posterId]
    )
    await conn.execute(
      'UPDATE Users SET WalletBalance = WalletBalance + ? WHERE UserID = ?',
      [transferAmount, helperId]
    )

    // COMPLETE THE TASK - Set status to Completed
    await conn.execute('UPDATE Tasks SET Status = ? WHERE TaskID = ?', ['Completed', taskId])

    // Update TaskAssignments with CompletedAt timestamp
    await conn.execute(
      'UPDATE TaskAssignments SET CompletedAt = NOW() WHERE TaskID = ? AND HelperID = ?',
      [taskId, helperId]
    )

    // Update payment status and role ownership.
    await conn.execute(
      `
        UPDATE Payments
        SET Status = ?, PayerUserID = ?, PayeeUserID = ?, CompletedAt = NOW()
        WHERE PaymentID = ?
      `,
      ['Completed', posterId, helperId, payment.PaymentID]
    )

    await conn.commit()

    // Calculate and update helper rating
    const completedHelperTasks = await query(
      `
        SELECT COUNT(*) AS CompletedCount
        FROM TaskAssignments ta
        INNER JOIN Tasks t ON ta.TaskID = t.TaskID
        WHERE ta.HelperID = ? AND t.Status = 'Completed'
      `,
      [helperId]
    )

    const completedCount = Number(completedHelperTasks[0]?.CompletedCount || 0)
    const computedRating = Math.min(5, Math.max(0, 4 + completedCount * 0.1))
    await query('UPDATE Users SET Rating = ? WHERE UserID = ?', [computedRating, helperId])

    // Get helper and poster names for notifications
    const helperRows = await query('SELECT FullName FROM Users WHERE UserID = ? LIMIT 1', [req.user.id])
    const helperName = helperRows[0]?.FullName || 'Helper'

    const posterRows = await query('SELECT FullName FROM Users WHERE UserID = ? LIMIT 1', [posterId])
    const posterName = posterRows[0]?.FullName || 'Task poster'

    // Notify poster that helper received payment
    const posterNotifText = `${helperName} confirmed receiving payment of P${Number(task.Budget || 0).toFixed(2)} for "${task.Title}". Task is now complete! You can rate them.`

    await query(
      'INSERT INTO Notifications (UserID, SenderID, TaskID, Message, IsRead, CreatedAt) VALUES (?, ?, ?, ?, ?, NOW())',
      [posterId, req.user.id, taskId, posterNotifText.slice(0, 255), 0]
    )

    // Notify helper of successful completion
    const helperNotifText = `Payment confirmed! Your task "${task.Title}" is now complete. Earnings of P${Number(task.Budget || 0).toFixed(2)} have been processed.`

    await query(
      'INSERT INTO Notifications (UserID, SenderID, TaskID, Message, IsRead, CreatedAt) VALUES (?, ?, ?, ?, ?, NOW())',
      [req.user.id, task.UserID, taskId, helperNotifText.slice(0, 255), 0]
    )

    return res.json({
      message: 'Payment confirmed and task completed successfully',
      taskId,
      status: 'Completed',
      earnings: Number(task.Budget || 0),
      success: true
    })
  } catch (error) {
    try {
      await conn.rollback()
    } catch {
      // Best effort rollback.
    }
    console.error('Payment received error:', error)
    return res.status(500).json({ message: error.message || 'Server error' })
  } finally {
    conn.release()
  }
})

app.get('/api/me/reviews', requireAuth, async (req, res) => {
  try {
    const reviews = await query(
      `
      SELECT 
        rv.ReviewID, rv.Rating, rv.Comment, rv.CreatedAt,
        u.FullName AS ReviewerName, u.ProfileImage AS ReviewerProfileImage,
        t.Title AS TaskTitle
      FROM Reviews rv
      INNER JOIN Users u ON rv.ReviewerID = u.UserID
      INNER JOIN Tasks t ON rv.TaskID = t.TaskID
      WHERE rv.ReviewedUserID = ?
      ORDER BY rv.CreatedAt DESC
      `,
      [req.user.id]
    )
    return res.json(reviews)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.get('/api/me/history', requireAuth, async (req, res) => {
  try {
    const history = await query(
      `
      SELECT 
        t.TaskID, t.Title, t.Status, t.Budget, t.CreatedAt,
        c.CategoryName,
        CASE WHEN t.UserID = ? THEN 'Posted' ELSE 'Applied' END AS Role
      FROM Tasks t
      LEFT JOIN Categories c ON t.CategoryID = c.CategoryID
      LEFT JOIN TaskAssignments ta ON t.TaskID = ta.TaskID
      WHERE (t.UserID = ? OR ta.HelperID = ?)
        AND (t.Status IN ('Completed', 'Cancelled'))
      GROUP BY t.TaskID, c.CategoryName
      ORDER BY t.CreatedAt DESC
      `,
      [req.user.id, req.user.id, req.user.id]
    )
    return res.json(history)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.post('/api/tasks/:taskId/feedback', requireAuth, async (req, res) => {
  console.log('=== FEEDBACK API CALLED ===')
  console.log('TaskID:', req.params.taskId)
  console.log('UserID:', req.user?.id)
  console.log('Message:', req.body?.message)

  const taskId = Number(req.params.taskId)
  const feedbackMessage = (req.body?.message || '').trim()

  if (!feedbackMessage) {
    return res.status(400).json({ message: 'Feedback message is required' })
  }

  if (feedbackMessage.length > 500) {
    return res.status(400).json({ message: 'Message exceeds 500 character limit' })
  }

  try {
    // Get task and helper info from TaskAssignments
    const taskResult = await query(
      `SELECT t.TaskID, t.UserID, t.Status, t.Title, ta.HelperID 
       FROM Tasks t 
       LEFT JOIN TaskAssignments ta ON t.TaskID = ta.TaskID 
       WHERE t.TaskID = ?`,
      [taskId]
    )

    console.log('Task query result:', taskResult)

    if (taskResult.length === 0) {
      return res.status(404).json({ message: 'Task not found' })
    }

    const task = taskResult[0]
    const isPoster = Number(task.UserID) === Number(req.user.id)

    if (!isPoster) {
      return res.status(403).json({ message: 'Only the task poster can send feedback' })
    }

    if (!task.HelperID || Number(task.HelperID) === 0) {
      return res.status(400).json({ message: 'Task does not have an assigned helper' })
    }

    const helperID = Number(task.HelperID)

    // Verify helper exists
    const helperCheck = await query('SELECT UserID FROM Users WHERE UserID = ? LIMIT 1', [helperID])
    if (helperCheck.length === 0) {
      return res.status(400).json({ message: 'Helper user not found' })
    }

    // Save the feedback message to Messages table
    const messageResult = await query(
      'INSERT INTO Messages (TaskID, SenderID, RecipientID, Content, IsRead, CreatedAt) VALUES (?, ?, ?, ?, ?, NOW())',
      [taskId, req.user.id, helperID, feedbackMessage, 0]
    )

    // Get poster name for notification
    const posterName = await query('SELECT FullName FROM Users WHERE UserID = ? LIMIT 1', [req.user.id])
    const senderFullName = posterName[0]?.FullName || 'Task poster'

    // Create notification for the feedback message with more detail
    const truncatedMessage = feedbackMessage.length > 50 ? feedbackMessage.substring(0, 50) + '...' : feedbackMessage
    const messageNotifText = `${senderFullName} sent you feedback about the task: "${truncatedMessage}"`

    const notifResult = await query(
      'INSERT INTO Notifications (UserID, SenderID, TaskID, Message, IsRead, CreatedAt) VALUES (?, ?, ?, ?, ?, NOW())',
      [helperID, req.user.id, taskId, messageNotifText.slice(0, 255), 0]
    )

    if (!messageResult[0]?.messageid || !notifResult[0]?.notificationid) {
      throw new Error('Failed to save message or notification')
    }

    console.log('✓ Feedback sent successfully to helper:', helperID)

    return res.json({
      message: 'Feedback sent successfully',
      messageId: messageResult[0].messageid,
      notificationId: notifResult[0].notificationid,
      success: true
    })
  } catch (error) {
    console.error('Feedback API error:', error)
    return res.status(500).json({ message: error.message || 'Server error sending feedback' })
  }
})

app.delete('/api/tasks/:taskId/proof', requireAuth, async (req, res) => {
  const taskId = Number(req.params.taskId)

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return res.status(400).json({ message: 'Invalid task id' })
  }

  try {
    const assignmentRows = await query(
      `
        SELECT ta.AssignmentID, ta.HelperID, ta.ProofImage, t.UserID AS PosterID, t.Status
        FROM TaskAssignments ta
        INNER JOIN Tasks t ON t.TaskID = ta.TaskID
        WHERE ta.TaskID = ?
        ORDER BY ta.AcceptedAt DESC
        LIMIT 1
      `,
      [taskId]
    )

    if (assignmentRows.length === 0) {
      return res.status(404).json({ message: 'Task assignment not found' })
    }

    const assignment = assignmentRows[0]
    const isUploader = Number(assignment.HelperID) === Number(req.user.id)
    const taskStatus = String(assignment.Status || '').toLowerCase()
    const isApprovedOrCompleted = taskStatus.includes('proofapproved') || taskStatus.includes('complete')

    if (!isUploader) {
      return res.status(403).json({ message: 'Only the proof uploader can delete this image' })
    }

    if (isApprovedOrCompleted) {
      return res.status(403).json({ message: 'Approved proof cannot be deleted' })
    }

    const storedProof = String(assignment.ProofImage || '')

    if (!storedProof) {
      return res.status(400).json({ message: 'No proof image to delete' })
    }

    await query(
      'UPDATE TaskAssignments SET ProofImage = NULL, CompletedAt = NULL WHERE AssignmentID = ?',
      [assignment.AssignmentID]
    )

    await query('UPDATE Tasks SET Status = ? WHERE TaskID = ?', ['Assigned', taskId])

    const normalizedProof = storedProof.replace(/\\+/g, '/')
    if (!normalizedProof.startsWith('data:image')) {
      const prefix = '/uploads/proofs/'
      const relativePrefix = 'uploads/proofs/'
      const fileName = normalizedProof.startsWith(prefix)
        ? normalizedProof.slice(prefix.length)
        : normalizedProof.startsWith(relativePrefix)
          ? normalizedProof.slice(relativePrefix.length)
          : ''

      if (fileName) {
        const filePath = path.join(uploadsDir, path.basename(fileName))
        try {
          await unlink(filePath)
        } catch {
          // Ignore if already removed or unavailable.
        }
      }
    }

    return res.json({ message: 'Proof deleted successfully', taskId })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.get('/api/my/tasks', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `
        SELECT
          data.TaskID,
          data.Title,
          data.Status,
          data.Budget,
          data.TaskTime,
          data.Location,
          data.CategoryID,
          c.CategoryName,
          data.DisplayName,
          data.DisplayRating,
          data.TaskType,
          data.SortAt
        FROM (
          SELECT
            t.TaskID,
            t.Title,
            t.Status,
            t.Budget,
            t.TaskTime,
            t.Location,
            t.CategoryID,
            u.FullName AS DisplayName,
            u.Rating AS DisplayRating,
            'Posted' AS TaskType,
            t.CreatedAt AS SortAt
          FROM Tasks t
          INNER JOIN Users u ON t.UserID = u.UserID
          WHERE t.UserID = ?

          UNION ALL

          SELECT
            t.TaskID,
            t.Title,
            t.Status,
            t.Budget,
            t.TaskTime,
            t.Location,
            t.CategoryID,
            pu.FullName AS DisplayName,
            pu.Rating AS DisplayRating,
            'Applied' AS TaskType,
            ta.AcceptedAt AS SortAt
          FROM TaskAssignments ta
          INNER JOIN Tasks t ON ta.TaskID = t.TaskID
          INNER JOIN Users pu ON pu.UserID = t.UserID
          WHERE ta.HelperID = ?
        ) data
        LEFT JOIN Categories c ON data.CategoryID = c.CategoryID
        ORDER BY data.SortAt DESC
      `,
      [req.user.id, req.user.id]
    )

    return res.json(result)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.patch('/api/tasks/:taskId/status', requireAuth, async (req, res) => {
  const taskId = Number(req.params.taskId)
  const { status } = req.body

  if (!['Open', 'Assigned', 'Completed', 'Cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' })
  }

  try {
    const task = await query('SELECT UserID FROM Tasks WHERE TaskID = ?', [taskId])

    if (task.length === 0) {
      return res.status(404).json({ message: 'Task not found' })
    }

    const ownerId = task[0].UserID
    if (ownerId !== req.user.id) {
      return res.status(403).json({ message: 'You can only update your own tasks' })
    }

    await query('UPDATE Tasks SET Status = ? WHERE TaskID = ?', [status, taskId])

    return res.json({ TaskID: taskId, Status: status })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

// ─── Current User ────────────────────────────────────────────────────────────

app.get('/api/me', requireAuth, async (req, res) => {
  try {
    if (req.user?.role === 'admin') {
      const result = await query(
        'SELECT AdminID, Username, FullName FROM Admins WHERE AdminID = ? LIMIT 1',
        [req.user.id]
      )
      if (result.length === 0) return res.status(404).json({ message: 'Admin not found' })
      const a = result[0]
      return res.json({
        UserID: a.AdminID,
        FullName: a.FullName,
        Username: a.Username,
        IsAdmin: 1,
      })
    }

    const result = await query(
      'SELECT UserID, FullName, Email, Rating, ProfileImage, IsAdmin FROM Users WHERE UserID = ? LIMIT 1',
      [req.user.id]
    )
    if (result.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }
    const u = result[0]
    return res.json({
      UserID: u.UserID,
      FullName: u.FullName,
      Email: u.Email,
      Rating: u.Rating,
      ProfileImage: u.ProfileImage || '',
      IsAdmin: u.IsAdmin || 0,
    })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.get('/api/me/rating-summary', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT COALESCE(AVG(Rating), 0) AS rating, COUNT(*) AS reviewCount
       FROM Reviews WHERE ReviewedUserID = ?`,
      [req.user.id]
    )
    return res.json(result[0])
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.post('/api/auth/admin-login', async (req, res) => {
  const username = (req.body.username || '').trim()
  const password = req.body.password || ''

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' })
  }

  try {
    const result = await query(
      'SELECT AdminID, Username, FullName, PasswordHash FROM Admins WHERE Username = ?',
      [username]
    )

    if (result.length === 0) {
      return res.status(401).json({ message: 'Invalid admin credentials' })
    }

    const admin = result[0]
    const isValid = await bcrypt.compare(password, admin.PasswordHash)

    if (!isValid) {
      return res.status(401).json({ message: 'Invalid admin credentials' })
    }

    const token = signToken({
      id: admin.AdminID,
      username: admin.Username,
      role: 'admin'
    })

    return res.json({
      admin: {
        AdminID: admin.AdminID,
        Username: admin.Username,
        FullName: admin.FullName
      },
      token,
    })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

// ─── Admin API ───────────────────────────────────────────────────────────────

app.post('/api/admin/users', requireAdmin, async (req, res) => {
  const { fullName, email, password } = req.body

  if (!fullName || !email || !password) {
    return res.status(400).json({ message: 'Full name, email, and password are required' })
  }

  try {
    const existing = await query('SELECT UserID FROM Users WHERE Email = ?', [email])
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already registered' })
    }

    const hash = await bcrypt.hash(password, 10)
    const result = await query(
      'INSERT INTO Users (FullName, Email, PasswordHash, Rating) VALUES (?, ?, ?, ?)',
      [fullName, email, hash, 5.0]
    )

    return res.status(201).json({
      UserID: result.insertId,
      FullName: fullName,
      Email: email,
      Rating: 5.0
    })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.put('/api/admin/users/:userId', requireAdmin, async (req, res) => {
  const userId = Number(req.params.userId)
  const { fullName, email, rating } = req.body

  if (!Number.isFinite(userId)) return res.status(400).json({ message: 'Invalid user ID' })

  try {
    const fields = []
    const params = []

    if (fullName) { fields.push('FullName = ?'); params.push(fullName) }
    if (email) { fields.push('Email = ?'); params.push(email) }
    if (rating !== undefined) { fields.push('Rating = ?'); params.push(Number(rating)) }

    if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' })

    params.push(userId)
    await query(`UPDATE Users SET ${fields.join(', ')} WHERE UserID = ?`, params)

    return res.json({ message: 'User updated successfully' })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        (SELECT COUNT(*) FROM Users) AS totalUsers,
        (SELECT COUNT(*) FROM Tasks WHERE LOWER(Status) NOT IN ('completed','cancelled')) AS activeTasks,
        (SELECT COUNT(*) FROM Tasks WHERE Status = 'Completed') AS completedTasks,
        (SELECT COALESCE(SUM(Budget), 0) FROM Tasks) AS totalValue,
        (SELECT COUNT(*) FROM Messages) AS totalMessages,
        (SELECT COUNT(DISTINCT ta.HelperID) FROM TaskAssignments ta INNER JOIN Tasks t ON ta.TaskID = t.TaskID WHERE LOWER(t.Status) NOT IN ('cancelled')) AS activeHelpers
    `)
    return res.json(result[0])
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.get('/api/admin/users', requireAdmin, async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        u.UserID,
        u.FullName,
        u.Email,
        u.Rating,
        u.IsDeactivated,
        u.CreatedAt,
        (SELECT COUNT(*) FROM Tasks WHERE UserID = u.UserID) AS TasksPosted,
        (SELECT COUNT(*) FROM TaskAssignments ta INNER JOIN Tasks t ON ta.TaskID = t.TaskID WHERE ta.HelperID = u.UserID AND t.Status = 'Completed') AS TasksCompleted
      FROM Users u
      ORDER BY u.CreatedAt DESC
    `)
    return res.json(result)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.get('/api/admin/tasks', requireAdmin, async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        t.TaskID, t.Title, t.Status, t.Budget, t.CreatedAt,
        u.FullName AS PosterName,
        hu.FullName AS HelperName
      FROM Tasks t
      INNER JOIN Users u ON t.UserID = u.UserID
      LEFT JOIN TaskAssignments ta ON ta.TaskID = t.TaskID
      LEFT JOIN Users hu ON hu.UserID = ta.HelperID
      ORDER BY t.CreatedAt DESC
    `)
    return res.json(result)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.get('/api/admin/messages', requireAdmin, async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        m.MessageID, m.TaskID, m.Content, m.AttachmentType, m.AttachmentData, m.AttachmentName, m.CreatedAt,
        s.FullName AS SenderName,
        r.FullName AS RecipientName,
        t.Title AS TaskTitle
      FROM Messages m
      INNER JOIN Users s ON m.SenderID = s.UserID
      INNER JOIN Users r ON m.RecipientID = r.UserID
      INNER JOIN Tasks t ON m.TaskID = t.TaskID
      ORDER BY m.CreatedAt DESC
      LIMIT 100
    `)
    return res.json(result)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.post('/api/admin/users/:userId/suspend', requireAdmin, async (req, res) => {
  const userId = Number(req.params.userId)
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({ message: 'Invalid user id' })
  }
  try {
    const userRows = await query('SELECT UserID FROM Users WHERE UserID = ? LIMIT 1', [userId])
    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }
    // For now, delete the user (or you could add a Suspended column)
    // Instead of deleting, we toggle the deactivation flag to preserve platform history
    await query('UPDATE Users SET IsDeactivated = 1 WHERE UserID = ?', [userId])
    return res.json({ message: 'User deactivated successfully', userId })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.post('/api/admin/users/:userId/activate', requireAdmin, async (req, res) => {
  const userId = Number(req.params.userId)
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({ message: 'Invalid user id' })
  }
  try {
    const userRows = await query('SELECT UserID FROM Users WHERE UserID = ? LIMIT 1', [userId])
    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }
    await query('UPDATE Users SET IsDeactivated = 0 WHERE UserID = ?', [userId])
    return res.json({ message: 'User reactivated successfully', userId })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.delete('/api/admin/tasks/:taskId', requireAdmin, async (req, res) => {
  const taskId = Number(req.params.taskId)
  if (!Number.isFinite(taskId) || taskId <= 0) {
    return res.status(400).json({ message: 'Invalid task id' })
  }
  try {
    const taskRows = await query('SELECT TaskID FROM Tasks WHERE TaskID = ? LIMIT 1', [taskId])
    if (taskRows.length === 0) {
      return res.status(404).json({ message: 'Task not found' })
    }
    await query('DELETE FROM Notifications WHERE TaskID = ?', [taskId])
    await query('DELETE FROM Messages WHERE TaskID = ?', [taskId])
    await query('DELETE FROM Reviews WHERE TaskID = ?', [taskId])
    await query('DELETE FROM Payments WHERE TaskID = ?', [taskId])
    await query('DELETE FROM TaskAssignments WHERE TaskID = ?', [taskId])
    await query('DELETE FROM Tasks WHERE TaskID = ?', [taskId])
    return res.json({ message: 'Task deleted', taskId })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

// ─── Reports & Data Visualization ────────────────────────────────────────────


app.get('/api/reports/summary', requireAdmin, async (req, res) => {
  try {
    // Overall platform stats
    const [statsResult] = await Promise.all([
      query(`
        SELECT
          (SELECT COUNT(*) FROM Users) AS totalUsers,
          (SELECT COUNT(*) FROM Tasks) AS totalTasks,
          (SELECT COUNT(*) FROM Tasks WHERE Status = 'Open') AS openTasks,
          (SELECT COUNT(*) FROM Tasks WHERE Status = 'Assigned') AS assignedTasks,
          (SELECT COUNT(*) FROM Tasks WHERE Status = 'Completed') AS completedTasks,
          (SELECT COUNT(*) FROM Tasks WHERE Status = 'Cancelled') AS cancelledTasks,
          (SELECT COALESCE(SUM(Budget), 0) FROM Tasks) AS totalBudget,
          (SELECT COALESCE(SUM(Budget), 0) FROM Tasks WHERE Status = 'Completed') AS completedValue,
          (SELECT COALESCE(AVG(Budget), 0) FROM Tasks) AS avgBudget,
          (SELECT COUNT(*) FROM TaskAssignments) AS totalAssignments,
          (SELECT COUNT(*) FROM Messages) AS totalMessages,
          (SELECT COUNT(*) FROM Reviews) AS totalReviews,
          (SELECT COALESCE(AVG(Rating), 0) FROM Reviews) AS avgRating,
          (SELECT COUNT(*) FROM Payments) AS totalPayments,
          (SELECT COALESCE(SUM(Amount), 0) FROM Payments WHERE Status = 'Completed') AS completedPayments
      `)
    ])

    // Tasks created per month (last 12 months)
    const tasksByMonth = await query(`
      SELECT 
        TO_CHAR(CreatedAt, 'YYYY-MM') AS month,
        COUNT(*) AS count,
        COALESCE(SUM(Budget), 0) AS totalBudget
      FROM Tasks
      WHERE CreatedAt >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(CreatedAt, 'YYYY-MM')
      ORDER BY month ASC
    `)

    // Tasks by status
    const tasksByStatus = await query(`
      SELECT Status AS status, COUNT(*) AS count
      FROM Tasks
      GROUP BY Status
      ORDER BY count DESC
    `)

    // Tasks by category
    const tasksByCategory = await query(`
      SELECT
        COALESCE(c.CategoryName, 'Uncategorized') AS category,
        COUNT(*) AS count,
        COALESCE(SUM(t.Budget), 0) AS totalBudget
      FROM Tasks t
      LEFT JOIN Categories c ON t.CategoryID = c.CategoryID
      GROUP BY c.CategoryName
      ORDER BY count DESC
    `)

    // User registrations per month (last 12 months)
    const usersByMonth = await query(`
      SELECT 
        TO_CHAR(CreatedAt, 'YYYY-MM') AS month,
        COUNT(*) AS count
      FROM Users
      WHERE CreatedAt >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(CreatedAt, 'YYYY-MM')
      ORDER BY month ASC
    `)

    // Top helpers by completed tasks
    const topHelpers = await query(`
      SELECT
        u.FullName AS name,
        u.Rating AS rating,
        COUNT(ta.AssignmentID) AS completedTasks,
        COALESCE(SUM(t.Budget), 0) AS totalEarnings
      FROM TaskAssignments ta
      INNER JOIN Users u ON ta.HelperID = u.UserID
      INNER JOIN Tasks t ON ta.TaskID = t.TaskID
      WHERE t.Status = 'Completed'
      GROUP BY u.UserID, u.FullName, u.Rating
      ORDER BY totalEarnings DESC
      LIMIT 5
    `)

    // Recent completed tasks
    const recentCompleted = await query(`
      SELECT
        t.TaskID,
        t.Title,
        t.Budget,
        t.Status,
        t.CreatedAt,
        u.FullName AS posterName,
        hu.FullName AS helperName,
        c.CategoryName AS category
      FROM Tasks t
      INNER JOIN Users u ON t.UserID = u.UserID
      LEFT JOIN TaskAssignments ta ON ta.TaskID = t.TaskID
      LEFT JOIN Users hu ON hu.UserID = ta.HelperID
      LEFT JOIN Categories c ON t.CategoryID = c.CategoryID
      WHERE t.Status = 'Completed'
      ORDER BY t.CreatedAt DESC
      LIMIT 10
    `)

    // Revenue by payment method
    const revenueByMethod = await query(`
      SELECT
        PaymentMethod AS method,
        COUNT(*) AS count,
        COALESCE(SUM(Amount), 0) AS total
      FROM Payments
      GROUP BY PaymentMethod
      ORDER BY total DESC
    `)

    return res.json({
      stats: statsResult[0],
      tasksByMonth,
      tasksByStatus,
      tasksByCategory,
      usersByMonth,
      topHelpers,
      recentCompleted,
      revenueByMethod,
    })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.get('/api/reports/transactions', requireAdmin, async (req, res) => {
  try {
    const transactions = await query(`
      SELECT
        p.PaymentID,
        p.TaskID,
        t.Title AS taskTitle,
        p.Amount,
        p.PaymentMethod,
        p.Status,
        p.CreatedAt,
        p.CompletedAt,
        poster.FullName AS posterName,
        helper.FullName AS helperName,
        c.CategoryName AS category
      FROM Payments p
      INNER JOIN Tasks t ON p.TaskID = t.TaskID
      INNER JOIN Users poster ON t.UserID = poster.UserID
      LEFT JOIN TaskAssignments ta ON ta.TaskID = t.TaskID
      LEFT JOIN Users helper ON helper.UserID = ta.HelperID
      LEFT JOIN Categories c ON t.CategoryID = c.CategoryID
      ORDER BY p.CreatedAt DESC
      LIMIT 100
    `)

    return res.json(transactions)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.get('/api/reports/activity', requireAdmin, async (req, res) => {
  try {
    // Recent task-related activities
    const activities = await query(`
      (
        SELECT
          'task_created' AS type,
          t.TaskID AS referenceId,
          t.Title AS description,
          u.FullName AS userName,
          t.CreatedAt AS timestamp
        FROM Tasks t
        INNER JOIN Users u ON t.UserID = u.UserID
        ORDER BY t.CreatedAt DESC
        LIMIT 20
      )
      UNION ALL
      (
        SELECT
          'task_assigned' AS type,
          ta.TaskID AS referenceId,
          CONCAT('Accepted task: ', t.Title) AS description,
          u.FullName AS userName,
          ta.AcceptedAt AS timestamp
        FROM TaskAssignments ta
        INNER JOIN Tasks t ON ta.TaskID = t.TaskID
        INNER JOIN Users u ON ta.HelperID = u.UserID
        ORDER BY ta.AcceptedAt DESC
        LIMIT 20
      )
      UNION ALL
      (
        SELECT
          'review_submitted' AS type,
          r.TaskID AS referenceId,
          CONCAT('Rated ', r.Rating, ' stars') AS description,
          u.FullName AS userName,
          r.CreatedAt AS timestamp
        FROM Reviews r
        INNER JOIN Users u ON r.ReviewerID = u.UserID
        ORDER BY r.CreatedAt DESC
        LIMIT 20
      )
      UNION ALL
      (
        SELECT
          'user_registered' AS type,
          u.UserID AS referenceId,
          CONCAT('New user registered: ', u.FullName) AS description,
          u.FullName AS userName,
          u.CreatedAt AS timestamp
        FROM Users u
        ORDER BY u.CreatedAt DESC
        LIMIT 20
      )
      ORDER BY timestamp DESC
      LIMIT 50
    `)

    return res.json(activities)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

app.use((error, _req, res, _next) => {
  res.status(500).json({ message: error.message || 'Unexpected server error' })
})

async function startServer(retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Starting server (Attempt ${i + 1}/${retries})...`)
      await initDatabase()
      app.listen(port, '0.0.0.0', () => {
        console.log(`GawaHelper API running on port ${port}`)
        console.log(`PostgreSQL schema ensured for database: ${process.env.DB_NAME || 'gawahelperdb'}`)
      })
      return // Success!
    } catch (error) {
      console.error(`Attempt ${i + 1} failed: ${error.message}`)
      if (i === retries - 1) {
        console.error('All connection attempts failed. Exiting.')
        process.exit(1)
      }
      console.log('Retrying in 5 seconds...')
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }
}

startServer()
