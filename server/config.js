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
    const host = process.env.SMTP_HOST || 'smtp.gmail.com'
    const port = Number(process.env.SMTP_PORT || 587)
    const secure = process.env.SMTP_SECURE === 'true' // For port 587, secure should usually be false
    const user = process.env.SMTP_USER || process.env.GMAIL_USER || ''
    const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || ''

    _emailTransporter = nodemailer.createTransport({
      host,
      port,
      secure, // false for 587, true for 465
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 15000,
      // Force IPv4 DNS lookup — Railway cannot reach Gmail via IPv6
      dnsLookup: (hostname, options, callback) => {
        dns.resolve4(hostname, (err, addresses) => {
          if (err) return callback(err)
          callback(null, addresses[0], 4)
        })
      }
    })
  }
  return _emailTransporter
}
