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
export function getEmailTransporter() {
  if (!_emailTransporter) {
    const user = process.env.SMTP_USER || process.env.GMAIL_USER || ''
    const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || ''

    if (!user || !pass) {
      console.error('[EMAIL] Missing credentials — set SMTP_USER/SMTP_PASS or GMAIL_USER/GMAIL_APP_PASSWORD')
    }

    const customHost = process.env.SMTP_HOST
    const host = customHost || 'smtp.gmail.com'
    const port = Number(process.env.SMTP_PORT || 587)
    const secure = port === 465

    _emailTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS: !secure, // Force STARTTLS on port 587
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false,
        // Force IPv4 — Railway cannot reach Gmail via IPv6
        servername: host
      },
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 25000,
      // Force IPv4 DNS resolution — Railway's network has no IPv6 support
      dnsLookup: (hostname, options, callback) => {
        dns.resolve4(hostname, (err, addresses) => {
          if (err) return callback(err)
          callback(null, addresses[0], 4)
        })
      }
    })

    // Verify connection on first use
    _emailTransporter.verify((err) => {
      if (err) {
        console.error('[EMAIL] Transporter verification failed:', err.message)
      } else {
        console.log('[EMAIL] Transporter ready — emails will be sent from:', user)
      }
    })
  }
  return _emailTransporter
}
