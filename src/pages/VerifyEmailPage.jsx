import { useAuth } from '../context/AuthContext'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../api'

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const loc = useLocation()
  
  // Try to get email from state OR from URL query params (?email=...)
  const getInitialEmail = () => {
    if (loc.state?.email) return loc.state.email
    const params = new URLSearchParams(loc.search)
    return params.get('email') || ''
  }

  const [email, setEmail] = useState(getInitialEmail())
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
    <div className="auth-page-wrapper auth-atelier">
      <div className="auth-container auth-atelier-container">
        <div className="auth-forms-container auth-atelier-forms">
          <div className="auth-form-section auth-login-form">
            <div className="auth-form-stack">
              <div className="auth-logo-link">
                <span className="auth-logo-dot" />
                <span>GawaHelper</span>
              </div>

              <div className="auth-header">
                <h1>Verify Your Identity</h1>
                <p>We've sent a 6-character secure code to <br /><strong>{email || 'your email'}</strong></p>
              </div>

              {error && (
                <div className="auth-error-box" style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span className="error-icon" style={{ background: '#ef4444', color: 'white', width: '20px', height: '20px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0 }}>!</span>
                  <span className="error-message" style={{ color: '#991b1b', fontSize: '0.875rem', fontWeight: '500' }}>{error}</span>
                </div>
              )}

              {message && (
                <div className="auth-success-box" style={{ background: '#f0fdf4', border: '1px solid #dcfce7', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span className="success-icon" style={{ background: '#22c55e', color: 'white', width: '20px', height: '20px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0 }}>✓</span>
                  <span className="success-message" style={{ color: '#166534', fontSize: '0.875rem', fontWeight: '500' }}>{message}</span>
                </div>
              )}

              <form onSubmit={handleVerify} className="auth-form">
                {!loc.search.includes('email=') && !loc.state?.email && (
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Verification Code</label>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="E N T E R - C O D E"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    className="form-input"
                    style={{ textAlign: 'center', letterSpacing: '4px', fontWeight: '800', fontSize: '1.2rem' }}
                    maxLength={6}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={loading || !code || !email}
                  style={{ marginTop: '1rem' }}
                >
                  {loading ? 'Verifying Account...' : 'Verify & Continue'}
                </button>
              </form>

              <div className="auth-footer" style={{ marginTop: '2rem' }}>
                <p>Didn't receive the code?</p>
                <button
                  onClick={handleResend}
                  disabled={resending || cooldown > 0}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem', padding: '10px', textDecoration: 'underline' }}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? 'Sending...' : 'Resend Code Now'}
                </button>
              </div>

              <div className="auth-footer" style={{ marginTop: '1rem' }}>
                <button
                  onClick={() => navigate('/login')}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  ← Back to Login
                </button>
              </div>
            </div>
          </div>
        </div>

        <aside className="auth-visual-section auth-atelier-visual" aria-hidden="true" style={{ background: 'linear-gradient(135deg, #0f6b3a 0%, #1a9956 100%)' }}>
          <div className="atelier-grid" />
          <div className="atelier-content">
            <span className="atelier-kicker" style={{ color: 'rgba(255,255,255,0.7)' }}>SECURE ACCESS</span>
            <h2 style={{ color: 'white' }}>One step away from your community</h2>
            <p style={{ color: 'rgba(255,255,255,0.9)' }}>Verify your email to ensure account safety and start connecting with local helpers.</p>

            <div className="atelier-metrics">
              <div className="atelier-metric-card" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
                <strong style={{ color: 'white' }}>Safe</strong>
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>2FA Enabled</span>
              </div>
              <div className="atelier-metric-card" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
                <strong style={{ color: 'white' }}>Fast</strong>
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>Instant Approval</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
