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

// Email via Nodemailer (as requested)
let _emailTransporter = null

/**
 * Get the email transporter instance.
 * @returns {object} The nodemailer transporter
 */
export function getEmailTransporter() {
  if (!_emailTransporter) {
    const user = process.env.SMTP_USER || process.env.GMAIL_USER || ''
    const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || ''

    if (!user || !pass) {
      console.error('[EMAIL] Missing credentials — set GMAIL_USER + GMAIL_APP_PASSWORD')
    }

    const host = process.env.SMTP_HOST || 'smtp.gmail.com'
    const port = Number(process.env.SMTP_PORT || 587)
    const secure = port === 465

    // If using default Gmail, we force a known good IPv4 address to bypass Railway's broken IPv6 DNS resolution
    const actualHost = (host === 'smtp.gmail.com') ? '142.251.12.109' : host 

    console.log('[EMAIL] Initializing transporter with host:', actualHost, 'port:', port)

    _emailTransporter = nodemailer.createTransport({
      host: actualHost,
      port,
      secure,
      requireTLS: !secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false,
        servername: 'smtp.gmail.com' // CRITICAL: This must stay as the hostname for TLS certificates to match
      },
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 25000,
      // Backup forcing IPv4 DNS lookup
      dnsLookup: (hostname, options, callback) => {
        dns.resolve4(hostname, (err, addresses) => {
          if (err) return callback(err)
          callback(null, addresses[0], 4)
        })
      }
    })

    // Log status but don't block
    _emailTransporter.verify((err) => {
      if (err) {
        console.error('[EMAIL] Nodemailer Transporter Error:', err.message)
      } else {
        console.log('[EMAIL] Nodemailer Transporter Ready (via IPv4:', actualHost, ')')
      }
    })
  }
  return _emailTransporter
}
