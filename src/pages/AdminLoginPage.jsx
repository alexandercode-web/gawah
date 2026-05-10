import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api'

function AdminLoginPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [tempUser, setTempUser] = useState(null)

  const { login } = useAuth()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await login(form, true)
      
      if (res.mustChangePassword) {
        setMustChangePassword(true)
        setTempUser({ ...res.admin, IsAdmin: 1 })
        return
      }

      // Navigate to admin page — AuthContext already has the user set
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    setError('')
    try {
      await api.adminChangePassword(newPassword)
      localStorage.setItem('gh_user', JSON.stringify(tempUser))
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err.message || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page-wrapper auth-atelier admin-login-portal">
      <div className="auth-container auth-atelier-container">
        <div className="auth-forms-container auth-atelier-forms">
          <div className="auth-form-section auth-login-form">
            <div className="auth-form-stack">
              {/* Optional "Logged out" or "Admin" Badge as seen in user's image */}
              <div className="admin-status-badge">
                <span>Admin Portal</span>
              </div>

              <Link to="/" className="auth-logo-link">
                <span className="auth-logo-dot" />
                <span>GawaHelper</span>
              </Link>

              <div className="auth-header">
                <h1>{mustChangePassword ? 'Change Required' : 'Welcome Back'}</h1>
                <p>{mustChangePassword ? 'You must change your default password before continuing.' : 'Sign in to manage the GawaHelper platform.'}</p>
              </div>

              {error && (
                <div className="auth-error-box">
                  <span className="error-icon">!</span>
                  <span className="error-message">{error}</span>
                </div>
              )}

              {mustChangePassword ? (
                <form onSubmit={handleChangePassword} className="auth-form">
                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <input
                      type="password"
                      placeholder="Enter new password (min. 8 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Confirm Password</label>
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>
                  <button className="auth-submit-btn admin-theme-btn" type="submit" disabled={loading}>
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="auth-form">
                  <div className="form-group">
                    <label htmlFor="admin-username" className="form-label">Admin Email or Username</label>
                    <input
                      id="admin-username"
                      type="text"
                      name="username"
                      placeholder="e.g. admin@gawahelper.com or admin"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      className="form-input"
                      required
                      autoComplete="username"
                    />
                  </div>

                  <div className="form-group">
                    <div className="password-label">
                      <label htmlFor="admin-password" className="form-label">Password</label>
                    </div>
                    <div className="password-input-wrapper">
                      <input
                        id="admin-password"
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        placeholder="Enter your password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className="form-input"
                        required
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <svg className="password-eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                          </svg>
                        ) : (
                          <svg className="password-eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        )}
                      </button>
                    </div>

                    <div className="auth-options-row">
                      <label className="remember-option">
                        <input type="checkbox" />
                        <span>Keep me signed in on this device</span>
                      </label>
                      <span className="forgot-password-placeholder">Secure Portal</span>
                    </div>
                  </div>

                  <button className="auth-submit-btn admin-theme-btn" type="submit" disabled={loading}>
                    {loading ? 'Authenticating...' : 'Sign In'}
                  </button>
                </form>
              )}



              <div className="auth-footer">
                <p>Not an administrator? <Link to="/login" className="auth-link">Return to User Login</Link></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .admin-login-portal .admin-status-badge {
          display: flex;
          justify-content: center;
          margin-bottom: 1.5rem;
        }
        .admin-login-portal .admin-status-badge span {
          background: #eef2ff;
          color: #4f46e5;
          padding: 0.4rem 1.2rem;
          border-radius: 999px;
          font-size: 0.85rem;
          font-weight: 700;
          border: 1px solid #c7d2fe;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.1);
        }
        .admin-login-portal .admin-theme-btn {
          background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
          box-shadow: 0 10px 25px rgba(37, 99, 235, 0.25);
        }

        .admin-login-portal .forgot-password-placeholder {
          font-size: 0.85rem;
          color: #94a3b8;
          font-weight: 600;
        }
        .admin-login-portal .password-eye-icon {
          width: 20px;
          height: 20px;
        }
      `}</style>
    </div>
  )
}

export default AdminLoginPage
