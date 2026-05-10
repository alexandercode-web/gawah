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
    _emailTransporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER || '',
        pass: process.env.GMAIL_APP_PASSWORD || '',
      },
      tls: {
        rejectUnauthorized: false
      },
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
