import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import nodemailer from 'nodemailer'
import dns from 'node:dns'

dotenv.config()

export const rpName = 'GawaHelper'
export const rpID = process.env.RP_ID || 'localhost'
export const origin = process.env.CLIENT_ORIGIN || `http://${rpID}:5173`

const authRateLimitMax = Number(
  process.env.AUTH_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? 50 : 1000)
)

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many auth requests. Please wait a moment and try again.',
  },
})

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many file uploads. Please wait a moment and try again.',
  },
})

let _emailTransporter = null
let _transporterReady = false

export async function getEmailTransporter() {
  if (_emailTransporter && _transporterReady) return _emailTransporter

  const user = process.env.SMTP_USER || process.env.GMAIL_USER || ''
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || ''

  if (!user || !pass) {
    console.error('[EMAIL] Missing credentials — set GMAIL_USER + GMAIL_APP_PASSWORD')
    return null
  }

  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = Number(process.env.SMTP_PORT || 587)
  const secure = port === 465

  // Pre-resolve to IPv4 — Railway has no IPv6 connectivity
  let resolvedHost = smtpHost
  try {
    const addresses = await new Promise((resolve, reject) => {
      dns.resolve4(smtpHost, (err, addrs) => {
        if (err) reject(err)
        else resolve(addrs)
      })
    })
    if (addresses && addresses.length > 0) {
      resolvedHost = addresses[0]
      console.log(`[EMAIL] Resolved ${smtpHost} → ${resolvedHost} (IPv4)`)
    }
  } catch (dnsErr) {
    console.error('[EMAIL] IPv4 DNS resolve failed:', dnsErr.message)
    // Fall back to hostname and hope for the best
  }

  _emailTransporter = nodemailer.createTransport({
    host: resolvedHost,
    port,
    secure,
    requireTLS: !secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false,
      servername: smtpHost // Must use original hostname for TLS certificate validation
    },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 25000,
  })

  // Verify
  try {
    await _emailTransporter.verify()
    console.log('[EMAIL] Transporter verified — ready to send from:', user)
    _transporterReady = true
  } catch (verifyErr) {
    console.error('[EMAIL] Transporter verify failed:', verifyErr.message)
    // Still return the transporter — sendMail might work even if verify fails
  }

  return _emailTransporter
}
