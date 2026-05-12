import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import { startAuthentication } from '@simplewebauthn/browser'
import { api } from '../api'

function LoginPage({onLogin: parentOnLogin, loading: parentLoading, error: authError}) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [socialLoading, setSocialLoading] = useState(null)
  const { updateUser } = useAuth()
  const navigate = useNavigate()
  
  const [biometricReady, setBiometricReady] = useState(false)
  const [biometricEmail, setBiometricEmail] = useState('')
  const [biometricStatus, setBiometricStatus] = useState('')
  const [biometricLoading, setBiometricLoading] = useState(false)
  const [localError, setLocalError] = useState('')

  const error = localError || authError
  const trimmedEmail = form.email.trim()
  const canSubmit = Boolean(trimmedEmail && form.password)
  const suggestedBiometricEmail = biometricEmail && biometricEmail !== trimmedEmail ? biometricEmail : ''

  useEffect(() => {
    const isVerified = localStorage.getItem('gh_face_login_verified') === '1'
    const savedEmail = localStorage.getItem('gh_face_login_email')
    
    if (isVerified && savedEmail) {
      setBiometricReady(true)
      setBiometricEmail(savedEmail)
    }
  }, [])

  function onChange(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setLocalError('')
  }

  function handleSubmit(event) {
    event.preventDefault()
    setLocalError('')
    if (!trimmedEmail || !form.password) {
      setLocalError('Please fill in both fields.')
      return
    }
    
    // Pass raw credentials to parent App's login handler
    if (onLogin) {
      onLogin({ email: trimmedEmail, password: form.password })
    }
  }

  async function handleBiometricLogin() {
    setLocalError('')
    setBiometricStatus('')
    
    const emailToUse = form.email.trim() || biometricEmail
    
    if (!emailToUse) {
      setLocalError('Please enter your email to use biometric login.')
      return
    }

    setBiometricLoading(true)
    setBiometricStatus('Preparing biometric authentication...')

    try {
      const optionsJSON = await api.generateWebAuthnAuthOptions(emailToUse)
      
      setBiometricStatus('Awaiting biometric confirmation...')
      const attResp = await startAuthentication({ optionsJSON })
      
      setBiometricStatus('Verifying credentials...')
      const verificationResponse = await api.verifyWebAuthnAuth(emailToUse, attResp)

      // Emulate the typical onLogin response (token + user handled by App.jsx)
      // Usually onLogin(payload) hits standard auth, but let's pass token manually by mocking it
      // Actually `onLogin` in App.jsx expects a payload, but here `handleBiometricLogin` 
      // returns the final { token, user } which must be set in localstorage.
      // Looking at `App.jsx`, `handleLogin` calls `api.login` and sets user/token.
      // Wait, `onLogin` expects { email, password }? Let's check how App.jsx calls it.
      // It passes `onLogin={handleLogin}`.
      // If we do custom logic here, we must set tokens manually or pass it out.
      // Since `LoginPage` takes `onLogin`, but `onLogin` assumes it'll do the HTTP call, we'll need to adapt.
      // Usually the App expects a raw credential payload. Let's fire a specialized event or set LocalStorage since `api.login` does standard email/password.
      // I will save the storage and refresh to simulate the login.
      localStorage.setItem('gh_token', verificationResponse.token)
      localStorage.setItem('gh_user', JSON.stringify(verificationResponse.user))
      window.location.href = '/home'

    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setLocalError('Biometric authentication cancelled or failed.')
      } else {
        setLocalError(err.message || 'Biometric authentication failed.')
      }
    } finally {
      setBiometricLoading(false)
      setBiometricStatus('')
    }
  }

  async function handleSocialLogin(provider) {
    setLocalError('')
    setSocialLoading(provider)
    
    try {
      // Simulation delay for capstone presentation
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const mockProfiles = {
        google: { 
          email: 'google-demo@gawahelper.com', 
          fullName: 'Google User', 
          profileImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Google' 
        },
        facebook: { 
          email: 'fb-demo@gawahelper.com', 
          fullName: 'Facebook User', 
          profileImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Facebook' 
        }
      }
      
      const profile = mockProfiles[provider]
      const res = await api.socialLogin({ ...profile, provider })

      if (res.success && res.user) {
        updateUser(res.user)
        localStorage.setItem('gh_token', res.token)
        localStorage.setItem('gh_user', JSON.stringify(res.user))
        window.location.href = '/home'
      }
    } catch (err) {
      setLocalError(err.message || `Failed to sign in with ${provider}`)
    } finally {
      setSocialLoading(null)
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
                <span className="brand-gawa">Gawa</span><span className="brand-helper">Helper</span>
              </Link>

              <div className="auth-header">
                <h1>
                  <span className="brand-gawa">Welcome</span> <span className="brand-helper">Back</span>
                </h1>
                <p>Sign in and continue your active tasks.</p>
              </div>

              {error && (
                <div className="auth-error-box" style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span className="error-icon" style={{ background: '#ef4444', color: 'white', width: '20px', height: '20px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0 }}>!</span>
                  <span className="error-message" style={{ color: '#991b1b', fontSize: '0.875rem', fontWeight: '500' }}>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="auth-form">
                <div className="form-group">
                  <label htmlFor="login-email" className="form-label">Email Address</label>
                  <input
                    id="login-email"
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={onChange}
                    autoComplete="email"
                    className="form-input"
                  />
                
                </div>

                <div className="form-group">
                  <div className="password-label">
                    <label htmlFor="login-password" className="form-label">Password</label>
                  </div>
                  <div className="password-input-wrapper">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder="Enter your password"
                      value={form.password}
                      onChange={onChange}
                      autoComplete="current-password"
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

                  <div className="auth-options-row">
                    <label className="remember-option" htmlFor="remember-me">
                      <input
                        id="remember-me"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(event) => setRememberMe(event.target.checked)}
                      />
                      <span>Keep me signed in on this device</span>
                    </label>
                    <Link
                      to={trimmedEmail ? `/forgot-password?email=${encodeURIComponent(trimmedEmail)}` : '/forgot-password'}
                      className="forgot-password"
                    >
                      Forgot password
                    </Link>
                  </div>
                </div>

                <button className="auth-submit-btn" type="submit" disabled={!canSubmit || loading || biometricLoading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <div className="auth-trust-row" aria-hidden="true">
                <span className="auth-trust-chip">Encrypted session</span>
                <span className="auth-trust-chip">Biometric-ready</span>
              </div>

              <div className="auth-divider">
                <span>or continue with</span>
              </div>

              <div className="social-login login-social">
                {(biometricReady || form.email) && (
                  <button
                    className="social-btn face-btn"
                    type="button"
                    onClick={handleBiometricLogin}
                    disabled={loading || biometricLoading}
                  >
                    <svg className="social-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 16C12 16 15 14 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 14 12 16 12 16Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Biometric Login</span>
                  </button>
                )}
                <button 
                  className="social-btn gmail-btn" 
                  type="button" 
                  onClick={() => handleSocialLogin('google')}
                  disabled={loading || biometricLoading || socialLoading}
                >
                  {socialLoading === 'google' ? (
                    <div className="social-loader" />
                  ) : (
                    <svg className="social-icon" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                  )}
                  <span>{socialLoading === 'google' ? 'Connecting...' : 'Sign in with Google'}</span>
                </button>
                <button 
                  className="social-btn facebook-btn" 
                  type="button" 
                  onClick={() => handleSocialLogin('facebook')}
                  disabled={loading || biometricLoading || socialLoading}
                >
                  {socialLoading === 'facebook' ? (
                    <div className="social-loader" />
                  ) : (
                    <svg className="social-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" fill="#1877F2" />
                      <path d="M13.35 8.2H14.9V6H13.08C11.2 6 10 7.2 10 9.24V10.8H8.6V13H10V18H12.2V13H14.2L14.55 10.8H12.2V9.5C12.2 8.8 12.55 8.2 13.35 8.2Z" fill="#FFFFFF" />
                    </svg>
                  )}
                  <span>{socialLoading === 'facebook' ? 'Connecting...' : 'Sign in with Facebook'}</span>
                </button>
              </div>

              {biometricStatus && <p className="face-status-text" aria-live="polite">{biometricStatus}</p>}

              <div className="auth-footer">
                <p>Do not have an account yet? <Link to="/register" className="auth-link">Sign up</Link></p>
              </div>
            </div>
          </div>
        </div>

        <aside className="auth-visual-section auth-atelier-visual" aria-hidden="true">
          <div className="atelier-grid" />
          <div className="atelier-content">
            <span className="atelier-kicker">WORKSPACE FLOW</span>
            <h2>Move from post to payout with confidence</h2>
            <p>Track tasks, chat with helpers, and keep every update in one clean workspace.</p>

            <div className="atelier-metrics">
              <div className="atelier-metric-card">
                <strong>2.6k+</strong>
                <span>Tasks Closed</span>
              </div>
              <div className="atelier-metric-card">
                <strong>98%</strong>
                <span>On-time Completion</span>
              </div>
            </div>

            <div className="atelier-line" />
          </div>
        </aside>
      </div>
    </div>
  )
}

export default LoginPage
