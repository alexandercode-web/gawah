import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { startRegistration } from '@simplewebauthn/browser'
import { api } from '../api'
import Sidebar from '../components/Sidebar'

function SettingsPage({user, onLogout, hasUnreadNotifications = false}) {
  const navigate = useNavigate()
  const [pushNotifications, setPushNotifications] = useState(true)
  const [emailUpdates, setEmailUpdates] = useState(true)
  const [taskReminders, setTaskReminders] = useState(true)
  const [faceEnabled, setFaceEnabled] = useState(false)
  const [faceSetupBusy, setFaceSetupBusy] = useState(false)
  const [faceSetupStatus, setFaceSetupStatus] = useState('')
  const [faceSetupError, setFaceSetupError] = useState(false)
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  const userName = user?.FullName || 'GawaHelper User'
  const userEmail = String(user?.Email || '').trim()
  const displayEmail = userEmail || 'No email available'
  const isAdmin = Number(user?.IsAdmin) === 1 || user?.IsAdmin === true || String(user?.IsAdmin) === '1'

  useEffect(() => {
    const savedPush = localStorage.getItem('gh_pref_push_notifications')
    const savedEmail = localStorage.getItem('gh_pref_email_updates')
    const savedReminder = localStorage.getItem('gh_pref_task_reminders')
    const savedFaceVerified = localStorage.getItem('gh_face_login_verified') === '1'

    if (savedPush !== null) setPushNotifications(savedPush === '1')
    if (savedEmail !== null) setEmailUpdates(savedEmail === '1')
    if (savedReminder !== null) setTaskReminders(savedReminder === '1')
    if (savedFaceVerified) setFaceEnabled(true)
  }, [])

  useEffect(() => {
    localStorage.setItem('gh_pref_push_notifications', pushNotifications ? '1' : '0')
  }, [pushNotifications])

  useEffect(() => {
    localStorage.setItem('gh_pref_email_updates', emailUpdates ? '1' : '0')
  }, [emailUpdates])

  useEffect(() => {
    localStorage.setItem('gh_pref_task_reminders', taskReminders ? '1' : '0')
  }, [taskReminders])

  async function enableBiometrics() {
    setFaceSetupStatus('')
    setFaceSetupError(false)
    setFaceSetupBusy(true)

    try {
      setFaceSetupStatus('Requesting registration options...')
      const optionsJSON = await api.generateWebAuthnRegOptions()
      
      setFaceSetupStatus('Please interact with your device biometrics prompt...')
      const attResp = await startRegistration({ optionsJSON })
      
      setFaceSetupStatus('Verifying registration...')
      await api.verifyWebAuthnReg(attResp)

      localStorage.setItem('gh_face_login_verified', '1')
      localStorage.setItem('gh_face_login_email', userEmail)
      setFaceEnabled(true)
      setFaceSetupStatus('Success: Biometric login enabled for this device.')
    } catch (err) {
      setFaceSetupError(true)
      if (err.name === 'NotAllowedError') {
        setFaceSetupStatus('Registration was cancelled or timed out.')
      } else {
        setFaceSetupStatus(err.message || 'Biometric setup failed.')
      }
    } finally {
      setFaceSetupBusy(false)
    }
  }

  function disableBiometrics() {
    localStorage.removeItem('gh_face_login_verified')
    localStorage.removeItem('gh_face_login_email')
    setFaceEnabled(false)
    setFaceSetupStatus('Biometric login disabled on this device.')
    setFaceSetupError(false)
  }

  function onPasswordChange(event) {
    const { name, value } = event.target
    setPasswordForm((prev) => ({ ...prev, [name]: value }))
  }

  async function submitPasswordChange(event) {
    event.preventDefault()
    setPasswordMessage('')
    setPasswordError('')

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('Please fill in all password fields.')
      return
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setPasswordError('New password must be different from current password.')
      return
    }

    try {
      setPasswordLoading(true)
      await api.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })

      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordMessage('Password updated successfully.')
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password.')
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <section className="page settings-page">
      <header className="settings-header">
        <h1>Settings</h1>
        <p>Manage account, notifications, and privacy preferences.</p>
      </header>

      <p className="settings-section-title">Account</p>
      <section className="settings-card" aria-label="Account settings">
        <button type="button" className="settings-row">
          <span className="settings-row-left">
            <span className="settings-row-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                <circle cx="12" cy="8" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="M5.5 19a6.5 6.5 0 0 1 13 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="settings-row-copy">
              <strong>Account Details</strong>
              <small>{userName}</small>
            </span>
          </span>
          <span className="settings-row-arrow" aria-hidden="true">›</span>
        </button>

        <button type="button" className="settings-row">
          <span className="settings-row-left">
            <span className="settings-row-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="m4.5 7 7.5 6 7.5-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="settings-row-copy">
              <strong>Email</strong>
              <small className="settings-email-value">{displayEmail}</small>
            </span>
          </span>
          <span className="settings-row-arrow" aria-hidden="true">›</span>
        </button>
      </section>

      <p className="settings-section-title">Biometric Login</p>
      <section className="settings-card" aria-label="Face login settings">
        <div className="settings-bio-row">
          <div className="settings-row-left">
            <span className="settings-row-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                <circle cx="12" cy="9" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="M6 20a6 6 0 0 1 12 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="settings-row-copy">
              <strong>Device Biometric Login</strong>
              <small>{faceEnabled ? 'Enabled on this device' : 'Not enabled on this device'}</small>
            </span>
          </div>
          {faceEnabled ? (
            <button type="button" className="settings-inline-btn danger" onClick={disableBiometrics}>
              Disable
            </button>
          ) : (
            <button
              type="button"
              className="settings-inline-btn"
              onClick={enableBiometrics}
              disabled={faceSetupBusy}
            >
              {faceSetupBusy ? 'Starting...' : 'Enable'}
            </button>
          )}
        </div>

        {faceSetupStatus && (
          <p className={`${faceSetupError ? 'settings-form-error' : 'settings-form-success'} settings-face-status`} style={{ marginTop: '1rem', marginLeft: '1rem' }}>
            {faceSetupStatus}
          </p>
        )}
      </section>

      <p className="settings-section-title">Notifications</p>
      <section className="settings-card" aria-label="Notification preferences">
        <label className="settings-switch-row">
          <span className="settings-row-left">
            <span className="settings-row-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                <path d="M18 8a6 6 0 0 0-12 0v5l-2 3h16l-2-3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 19a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="settings-row-copy">
              <strong>Push Notifications</strong>
              <small>Receive instant updates on task activity.</small>
            </span>
          </span>
          <span className="settings-toggle">
            <input
              type="checkbox"
              className="settings-toggle-input"
              checked={pushNotifications}
              onChange={(event) => setPushNotifications(event.target.checked)}
            />
            <span className="settings-toggle-slider" />
          </span>
        </label>

        <label className="settings-switch-row">
          <span className="settings-row-left">
            <span className="settings-row-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="m4.5 7 7.5 6 7.5-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="settings-row-copy">
              <strong>Email Updates</strong>
              <small>Get summaries and updates by email.</small>
            </span>
          </span>
          <span className="settings-toggle">
            <input
              type="checkbox"
              className="settings-toggle-input"
              checked={emailUpdates}
              onChange={(event) => setEmailUpdates(event.target.checked)}
            />
            <span className="settings-toggle-slider" />
          </span>
        </label>

        <label className="settings-switch-row">
          <span className="settings-row-left">
            <span className="settings-row-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 8v4l2.8 1.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="settings-row-copy">
              <strong>Task Reminders</strong>
              <small>Be reminded about upcoming deadlines.</small>
            </span>
          </span>
          <span className="settings-toggle">
            <input
              type="checkbox"
              className="settings-toggle-input"
              checked={taskReminders}
              onChange={(event) => setTaskReminders(event.target.checked)}
            />
            <span className="settings-toggle-slider" />
          </span>
        </label>
      </section>

      {!isAdmin && (
        <>
          <p className="settings-section-title">Security</p>
          <section className="settings-card" aria-label="Security settings">
            <form className="settings-password-form" onSubmit={submitPasswordChange}>
              <div className="settings-password-head">
                <span className="settings-row-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                    <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M8 11V8a4 4 0 1 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </span>
                <div className="settings-row-copy">
                  <strong>Change Password</strong>
                  <small>Use a strong password with at least 6 characters.</small>
                </div>
              </div>

              <div className="settings-password-grid">
                <label className="settings-password-field">
                  Current Password
                  <div className="password-input-wrapper">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      name="currentPassword"
                      value={passwordForm.currentPassword}
                      onChange={onPasswordChange}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                    >
                      <svg className="password-eye-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        {showCurrentPassword ? (
                          <>
                            <path d="M12 5C7 5 2.73 8.11 1 12.46c1.73 4.35 6 7.54 11 7.54s9.27-3.19 11-7.54C21.27 8.11 17 5 12 5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                          </>
                        ) : (
                          <>
                            <path d="M3 3l18 18M9.88 9.88a3 3 0 0 0 4.24 4.24M12 5C7 5 2.73 8.11 1 12.46c1.73 4.35 6 7.54 11 7.54s9.27-3.19 11-7.54C21.27 8.11 17 5 12 5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                </label>

                <label className="settings-password-field">
                  New Password
                  <div className="password-input-wrapper">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      name="newPassword"
                      value={passwordForm.newPassword}
                      onChange={onPasswordChange}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      <svg className="password-eye-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        {showNewPassword ? (
                          <>
                            <path d="M12 5C7 5 2.73 8.11 1 12.46c1.73 4.35 6 7.54 11 7.54s9.27-3.19 11-7.54C21.27 8.11 17 5 12 5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                          </>
                        ) : (
                          <>
                            <path d="M3 3l18 18M9.88 9.88a3 3 0 0 0 4.24 4.24M12 5C7 5 2.73 8.11 1 12.46c1.73 4.35 6 7.54 11 7.54s9.27-3.19 11-7.54C21.27 8.11 17 5 12 5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                </label>

                <label className="settings-password-field">
                  Confirm New Password
                  <div className="password-input-wrapper">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={passwordForm.confirmPassword}
                      onChange={onPasswordChange}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      <svg className="password-eye-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        {showConfirmPassword ? (
                          <>
                            <path d="M12 5C7 5 2.73 8.11 1 12.46c1.73 4.35 6 7.54 11 7.54s9.27-3.19 11-7.54C21.27 8.11 17 5 12 5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                          </>
                        ) : (
                          <>
                            <path d="M3 3l18 18M9.88 9.88a3 3 0 0 0 4.24 4.24M12 5C7 5 2.73 8.11 1 12.46c1.73 4.35 6 7.54 11 7.54s9.27-3.19 11-7.54C21.27 8.11 17 5 12 5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                </label>
              </div>

              {passwordError && <p className="settings-form-error">{passwordError}</p>}
              {passwordMessage && <p className="settings-form-success">{passwordMessage}</p>}

              <button type="submit" className="settings-primary-btn" disabled={passwordLoading}>
                {passwordLoading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </section>
        </>
      )}

      <Sidebar 
        user={user} 
        onLogout={onLogout} 
        hasUnreadNotifications={hasUnreadNotifications} 
      />
    </section>
  )
}

export default SettingsPage
