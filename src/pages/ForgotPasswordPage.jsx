import React, { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'

function ForgotPasswordPage() {
  const [searchParams] = useSearchParams()
  const initialEmail = useMemo(() => (searchParams.get('email') || '').trim(), [searchParams])

  const [step, setStep] = useState(1) // 1: email, 2: code, 3: password
  const [form, setForm] = useState({
    email: initialEmail,
    code: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [localError, setLocalError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  const trimmedEmail = form.email.trim().toLowerCase()
  const passwordsMatch = Boolean(form.newPassword && form.newPassword === form.confirmPassword)
  const displayError = localError

  function onChange(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setLocalError('')
  }

  async function handleRequestCode(event) {
    event.preventDefault()
    setLocalError('')
    setSuccess('')

    if (!trimmedEmail) {
      setLocalError('Please enter your email address.')
      return
    }

    try {
      setLoading(true)
      await api.requestPasswordResetCode(trimmedEmail)
      setSuccess('Reset code sent to your email!')
      setStep(2)
    } catch (err) {
      setLocalError(err.message || 'Failed to send reset code.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode(event) {
    event.preventDefault()
    setLocalError('')
    setSuccess('')

    if (!form.code.trim()) {
      setLocalError('Please enter the code.')
      return
    }

    try {
      setLoading(true)
      await api.verifyPasswordResetCode(trimmedEmail, form.code)
      setSuccess('Code verified! Now set your new password.')
      setStep(3)
    } catch (err) {
      setLocalError(err.message || 'Invalid or expired code.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault()
    setLocalError('')
    setSuccess('')

    if (!form.newPassword || !form.confirmPassword) {
      setLocalError('Please complete all fields.')
      return
    }

    if (form.newPassword.length < 8) {
      setLocalError('New password must be at least 8 characters.')
      return
    }

    if (!passwordsMatch) {
      setLocalError('Passwords do not match.')
      return
    }

    try {
      setLoading(true)
      await api.resetPasswordWithCode(trimmedEmail, form.code, form.newPassword)
      setSuccess('Password reset successfully!')
      setTimeout(() => {
        window.location.href = '/login'
      }, 2000)
    } catch (err) {
      setLocalError(err.message || 'Failed to reset password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page-wrapper auth-atelier">
      <div className="auth-container auth-atelier-container">
        <div className="auth-forms-container auth-atelier-forms">
          <div className="auth-form-section auth-login-form">
            <div className="auth-form-stack">
              <Link to="/" className="auth-logo-link">
                <span className="auth-logo-dot" />
                <span>GawaHelper</span>
              </Link>

              <div className="auth-header">
                <h1>Reset Password</h1>
                <p>
                  {step === 1 && 'Enter your email to get started.'}
                  {step === 2 && 'Enter the code sent to your email.'}
                  {step === 3 && 'Set your new password.'}
                </p>
              </div>

              {displayError && (
                <div className="auth-error-box">
                  <span className="error-icon">!</span>
                  <span className="error-message">{displayError}</span>
                </div>
              )}

              {success && (
                <div className="auth-success-box">
                  <span className="success-icon">✓</span>
                  <span className="success-message">{success}</span>
                </div>
              )}

              {step === 1 && (
                <form onSubmit={handleRequestCode} className="auth-form">
                  <div className="form-group">
                    <label htmlFor="reset-email" className="form-label">Email Address</label>
                    <input
                      id="reset-email"
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={onChange}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="form-input"
                      required
                    />
                  </div>

                  <button className="auth-submit-btn" type="submit" disabled={loading || !trimmedEmail}>
                    {loading ? 'Sending...' : 'Send Reset Code'}
                  </button>
                </form>
              )}

              {step === 2 && (
                <form onSubmit={handleVerifyCode} className="auth-form">
                  <div className="form-group">
                    <label htmlFor="reset-code" className="form-label">Verification Code</label>
                    <input
                      id="reset-code"
                      type="text"
                      name="code"
                      value={form.code}
                      onChange={onChange}
                      placeholder="Enter 6-digit code"
                      className="form-input"
                      maxLength="6"
                      autoComplete="off"
                      required
                    />
                    <p className="auth-input-meta">Check your email for the code (valid for 15 minutes)</p>
                  </div>

                  <button className="auth-submit-btn" type="submit" disabled={loading || !form.code.trim()}>
                    {loading ? 'Verifying...' : 'Verify Code'}
                  </button>

                  <button
                    type="button"
                    className="auth-secondary-btn"
                    onClick={() => {
                      setStep(1)
                      setForm((prev) => ({ ...prev, code: '' }))
                      setLocalError('')
                    }}
                    disabled={loading}
                  >
                    Back to Email
                  </button>
                </form>
              )}

              {step === 3 && (
                <form onSubmit={handleResetPassword} className="auth-form">
                  <div className="form-group">
                    <label htmlFor="reset-password" className="form-label">New Password</label>
                    <div className="password-input-wrapper">
                      <input
                        id="reset-password"
                        type={showPassword ? 'text' : 'password'}
                        name="newPassword"
                        value={form.newPassword}
                        onChange={onChange}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        className="form-input"
                        required
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="reset-confirm-password" className="form-label">Confirm New Password</label>
                    <div className="password-input-wrapper">
                      <input
                        id="reset-confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={form.confirmPassword}
                        onChange={onChange}
                        placeholder="Re-enter new password"
                        autoComplete="new-password"
                        className="form-input"
                        required
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                      >
                        {showConfirmPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {form.confirmPassword && !passwordsMatch && (
                      <p className="auth-input-meta auth-input-meta-error">Passwords must match.</p>
                    )}
                  </div>

                  <button className="auth-submit-btn" type="submit" disabled={loading || !passwordsMatch || form.newPassword.length < 8}>
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>

                  <button
                    type="button"
                    className="auth-secondary-btn"
                    onClick={() => {
                      setStep(2)
                      setForm((prev) => ({ ...prev, newPassword: '', confirmPassword: '' }))
                      setLocalError('')
                    }}
                    disabled={loading}
                  >
                    Back
                  </button>
                </form>
              )}

              <div className="auth-footer">
                <p>Remembered it? <Link to="/login" className="auth-link">Back to sign in</Link></p>
              </div>
            </div>
          </div>
        </div>

        <aside className="auth-visual-section auth-atelier-visual" aria-hidden="true">
          <div className="atelier-grid" />
          <div className="atelier-content">
            <span className="atelier-kicker">SECURE ACCESS</span>
            <h2>Get back into your account quickly</h2>
            <p>Create a new password and continue managing tasks with confidence.</p>

            <div className="atelier-metrics">
              <div className="atelier-metric-card">
                <strong>1 Min</strong>
                <span>Reset Flow</span>
              </div>
              <div className="atelier-metric-card">
                <strong>24/7</strong>
                <span>Account Access</span>
              </div>
            </div>

            <div className="atelier-line" />
          </div>
        </aside>
      </div>
    </div>
  )
}

export default ForgotPasswordPage
