import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import { Resend } from 'resend'

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

// Email via Resend (HTTP API — works on Railway, unlike SMTP which is blocked)
let _resend = null

function getResend() {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.error('[EMAIL] RESEND_API_KEY not set')
      return null
    }
    _resend = new Resend(apiKey)
    console.log('[EMAIL] Resend client initialized')
  }
  return _resend
}

/**
 * Send an email using Resend (HTTP-based, no SMTP needed).
 * @param {object} options - { to, subject, html }
 */
export async function sendEmail({ to, subject, html }) {
  const resend = getResend()
  if (!resend) {
    throw new Error('Email service not configured. Set RESEND_API_KEY on the server.')
  }

  const fromAddress = process.env.EMAIL_FROM || 'GawaHelper <onboarding@resend.dev>'

  console.log('[EMAIL] Sending to:', to, 'from:', fromAddress)

  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to: [to],
    subject,
    html,
  })

  if (error) {
    console.error('[EMAIL] Resend error:', JSON.stringify(error))
    throw new Error(error.message || 'Failed to send email')
  }

  console.log('[EMAIL] Sent successfully, id:', data?.id)
  return data
}
