import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'

function RegisterPage({onRegister, loading, error}) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [localError, setLocalError] = useState('')

  const passwordChecks = [
    { key: 'length', label: 'At least 8 characters', pass: form.password.length >= 8 },
    { key: 'mix', label: 'Uppercase and lowercase letters', pass: /[a-z]/.test(form.password) && /[A-Z]/.test(form.password) },
    { key: 'number', label: 'At least one number', pass: /\d/.test(form.password) },
  ]
  const passwordScore = passwordChecks.filter((item) => item.pass).length
  const passwordStrengthText = passwordScore === 3 ? 'Strong' : passwordScore === 2 ? 'Good' : passwordScore === 1 ? 'Weak' : 'Very weak'
  const passwordStrengthClass = passwordScore >= 3 ? 'strong' : passwordScore === 2 ? 'good' : 'weak'

  const cleanName = form.name.trim()
  const cleanEmail = form.email.trim()
  const passwordsMatch = form.password && form.password === form.confirmPassword
  const meetsPasswordMinimum = passwordScore >= 2
  const canSubmit = Boolean(cleanName && cleanEmail && passwordsMatch && meetsPasswordMinimum && acceptedTerms && !loading)
  const displayError = localError || error

  function onChange(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setLocalError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    setLocalError('')

    if (!cleanName || !cleanEmail || !form.password || !form.confirmPassword) {
      setLocalError('Please complete all required fields.')
      return
    }

    if (!passwordsMatch) {
      setLocalError('Passwords do not match.')
      return
    }

    if (!meetsPasswordMinimum) {
      setLocalError('Use a stronger password before continuing.')
      return
    }

    if (!acceptedTerms) {
      setLocalError('Please accept the Terms and Privacy Policy to continue.')
      return
    }

    if (typeof onRegister !== 'function') {
      setLocalError('Registration service is currently unavailable. Please refresh.')
      console.error('RegisterPage: onRegister prop is not a function', onRegister)
      return
    }

    const success = await onRegister({
      name: cleanName,
      fullName: cleanName,
      email: cleanEmail,
      password: form.password,
    })

    if (!success) return

    // Remove any previous face-login enrollment from this device on new registrations.
    localStorage.removeItem('gh_face_login_opt_in')
    localStorage.removeItem('gh_face_login_email')
    localStorage.removeItem('gh_face_login_secret')
    localStorage.removeItem('gh_face_login_verified')
    localStorage.removeItem('gh_face_signature')
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
                <h1>Create Account</h1>
                <p>Build your profile and start collaborating in minutes.</p>
              </div>

              {displayError && (
                <div className="auth-error-box">
                  <span className="error-icon">!</span>
                  <span className="error-message">{displayError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="auth-form">
                <div className="form-group">
                  <label htmlFor="register-name" className="form-label">Full Name</label>
                  <input
                    id="register-name"
                    type="text"
                    name="name"
                    placeholder="Full Name"
                    value={form.name}
                    onChange={onChange}
                    autoComplete="name"
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="register-email" className="form-label">Email Address</label>
                  <input
                    id="register-email"
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={onChange}
                    autoComplete="email"
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="register-password" className="form-label">Password</label>
                  <div className="password-input-wrapper">
                    <input
                      id="register-password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder="Create a strong password"
                      value={form.password}
                      onChange={onChange}
                      autoComplete="new-password"
                      required
                      className="form-input"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg className="password-eye-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path d="M3 3L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M9.9 4.24C10.58 4.08 11.28 4 12 4C17 4 21 8 22 12C21.56 13.74 20.55 15.31 19.13 16.45" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M14.12 14.12C13.56 14.68 12.8 15 12 15C10.34 15 9 13.66 9 12C9 11.2 9.32 10.44 9.88 9.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M6.61 6.61C4.91 7.86 3.65 9.75 2.99 12C3.99 16 7.99 20 12.99 20C14.8 20 16.48 19.47 17.88 18.56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg className="password-eye-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path d="M2 12C3 8 7 4 12 4C17 4 21 8 22 12C21 16 17 20 12 20C7 20 3 16 2 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                        </svg>
                      )}
                    </button>
                  </div>

                  <div className="password-strength" role="status" aria-live="polite">
                    <div className="password-strength-head">
                      <span>Password strength</span>
                      <strong className={`password-strength-label ${passwordStrengthClass}`}>{passwordStrengthText}</strong>
                    </div>
                    <div className="password-strength-bar" aria-hidden="true">
                      <span className={`password-strength-fill ${passwordStrengthClass}`} style={{ width: `${(passwordScore / 3) * 100}%` }} />
                    </div>
                    <div className="password-checklist">
                      {passwordChecks.map((item) => (
                        <p key={item.key} className={`password-check-item ${item.pass ? 'pass' : 'fail'}`}>
                          {item.pass ? 'OK' : '•'} {item.label}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="register-confirm-password" className="form-label">Confirm Password</label>
                  <div className="password-input-wrapper">
                    <input
                      id="register-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      placeholder="Re-enter your password"
                      value={form.confirmPassword}
                      onChange={onChange}
                      autoComplete="new-password"
                      required
                      className="form-input"
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

                <div className="terms-box">
                  <input
                    id="register-terms"
                    className="terms-checkbox"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                  />
                  <label htmlFor="register-terms">
                    I agree to the <Link to="/" className="terms-link">Terms</Link> and <Link to="/" className="terms-link">Privacy Policy</Link>.
                  </label>
                </div>

                <button className="auth-submit-btn" type="submit" disabled={!canSubmit}>
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
              </form>

              <div className="auth-trust-row" aria-hidden="true">
                <span className="auth-trust-chip">Fast onboarding</span>
                <span className="auth-trust-chip">Private by default</span>
              </div>

              <div className="auth-footer">
                <p>Already have an account? <Link to="/login" className="auth-link">Sign in</Link></p>
              </div>
            </div>
          </div>
        </div>

        <aside className="auth-visual-section auth-atelier-visual" aria-hidden="true">
          <div className="atelier-grid" />
          <div className="atelier-content">
            <span className="atelier-kicker">CREATOR READY</span>
            <h2>Launch your task network in minutes</h2>
            <p>From quick errands to specialty work, find trusted people and keep everything organized.</p>

            <div className="atelier-metrics">
              <div className="atelier-metric-card">
                <strong>24/7</strong>
                <span>Realtime Messaging</span>
              </div>
              <div className="atelier-metric-card">
                <strong>5-Step</strong>
                <span>Simple Onboarding</span>
              </div>
            </div>

            <div className="atelier-line" />
          </div>
        </aside>
      </div>
    </div>
  )
}

export default RegisterPage
