import { useAuth } from '../context/AuthContext'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../api'

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const loc = useLocation()
  const [email, setEmail] = useState(loc.state?.email || '')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus()
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!email || !code) return

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const result = await api.verifyEmail(email, code)
      setMessage(result.message || 'Email verified! Redirecting to login...')
      setTimeout(() => navigate('/login', { replace: true }), 1500)
    } catch (err) {
      setError(err.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!email || cooldown > 0) return

    setResending(true)
    setError('')
    setMessage('')

    try {
      await api.resendVerification(email)
      setMessage('Verification code resent to your email')
      setCooldown(60)
    } catch (err) {
      setError(err.message || 'Failed to resend')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="verify-page">
      <div className="verify-card">
        <div className="verify-card__icon">✉️</div>
        <h1 className="verify-card__title">Verify your email</h1>
        <p className="verify-card__subtitle">
          We sent a 6-character code to <strong>{email || 'your email'}</strong>. Enter it below to activate your account.
        </p>

        <form onSubmit={handleVerify} className="verify-card__form">
          {!loc.state?.email && (
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="verify-card__input"
              required
            />
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder="Enter verification code"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            className="verify-card__input verify-card__input--code"
            maxLength={6}
            required
          />
          <button
            type="submit"
            className="verify-card__btn"
            disabled={loading || !code || !email}
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>

        {error && <p className="verify-card__error">{error}</p>}
        {message && <p className="verify-card__success">{message}</p>}

        <div className="verify-card__resend">
          <button
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="verify-card__resend-btn"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? 'Sending...' : 'Resend code'}
          </button>
        </div>

        <button
          onClick={() => navigate('/login')}
          className="verify-card__back"
        >
          ← Back to Login
        </button>
      </div>

      <style>{`
        .verify-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #f0faf4, #e8f5e9);
          padding: 20px;
        }
        .verify-card {
          background: #fff;
          border-radius: 16px;
          padding: 40px 32px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.08);
          max-width: 420px;
          width: 100%;
          text-align: center;
        }
        .verify-card__icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        .verify-card__title {
          font-size: 24px;
          font-weight: 700;
          color: #1a1a2e;
          margin: 0 0 8px;
        }
        .verify-card__subtitle {
          font-size: 14px;
          color: #6b7280;
          margin: 0 0 28px;
          line-height: 1.5;
        }
        .verify-card__form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .verify-card__input {
          padding: 12px 16px;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          font-size: 15px;
          outline: none;
          transition: border-color 0.2s;
        }
        .verify-card__input:focus {
          border-color: #0f6b3a;
          box-shadow: 0 0 0 3px rgba(15,107,58,0.1);
        }
        .verify-card__input--code {
          text-align: center;
          font-family: 'Courier New', monospace;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 6px;
        }
        .verify-card__btn {
          padding: 14px;
          background: linear-gradient(135deg, #0f6b3a, #1a9956);
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .verify-card__btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .verify-card__error {
          color: #dc2626;
          font-size: 14px;
          margin: 16px 0 0;
        }
        .verify-card__success {
          color: #0f6b3a;
          font-size: 14px;
          margin: 16px 0 0;
          font-weight: 600;
        }
        .verify-card__resend {
          margin-top: 20px;
        }
        .verify-card__resend-btn {
          background: none;
          border: none;
          color: #0f6b3a;
          font-size: 14px;
          cursor: pointer;
          text-decoration: underline;
        }
        .verify-card__resend-btn:disabled {
          color: #9ca3af;
          cursor: not-allowed;
          text-decoration: none;
        }
        .verify-card__back {
          background: none;
          border: none;
          color: #6b7280;
          font-size: 13px;
          margin-top: 16px;
          cursor: pointer;
        }
        .verify-card__back:hover {
          color: #374151;
        }
      `}</style>
    </div>
  )
}
