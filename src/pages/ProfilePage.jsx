import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

function getProfileImageSrc(profileImage) {
  const raw = String(profileImage || '').trim()
  if (!raw) return ''

  if (raw.startsWith('data:image')) return raw
  if (/^https?:\/\//i.test(raw)) return raw

  const normalized = raw.replace(/\\+/g, '/')
  const apiUrl = import.meta.env.VITE_API_URL || '/api'
  let origin = ''

  if (/^https?:\/\//i.test(apiUrl)) {
    origin = new URL(apiUrl).origin
  } else if (typeof window !== 'undefined') {
    origin = window.location.origin
  }

  if (normalized.startsWith('/')) {
    return `${origin}${encodeURI(normalized)}`
  }

  return `${origin}/${encodeURI(normalized.replace(/^\.\/?/, ''))}`
}

function ProfilePage({user, summary, myTasks, onUserUpdate, onLogout, hasUnreadNotifications = false}) {
  const navigate = useNavigate()
  const [ratingSummary, setRatingSummary] = useState({ rating: 0, reviewCount: 0 })
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [showCameraModal, setShowCameraModal] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraStream, setCameraStream] = useState(null)
  const fileInputRef = useRef(null)
  const videoRef = useRef(null)
  const captureCanvasRef = useRef(null)

  const profileName = user?.FullName || 'Alexander Ducay'
  const profileImageSrc = useMemo(() => getProfileImageSrc(user?.ProfileImage), [user?.ProfileImage])

  const stats = useMemo(() => {
    const taskList = Array.isArray(myTasks) ? myTasks : []
    const metrics = summary?.metrics || {}
    const hasHelperMetrics = [
      metrics.HelperCompletedTasks,
      metrics.HelperCompletedValue,
      metrics.HelperAcceptedTasks,
    ].some((value) => value !== undefined && value !== null)

    const doneAsHelper = taskList.filter((task) => {
      const type = String(task.TaskType || '').toLowerCase()
      const status = String(task.Status || '').toLowerCase()
      return type === 'applied' && status.includes('complete')
    })

    const fallbackCompletedTasks = doneAsHelper.length
    const fallbackEarnings = doneAsHelper.reduce((sum, task) => sum + Number(task.Budget || 0), 0)
    const fallbackAcceptedAsHelper = taskList.filter(
      (task) => String(task.TaskType || '').toLowerCase() === 'applied'
    ).length
    const completedTasks = hasHelperMetrics
      ? Number(metrics.HelperCompletedTasks ?? 0)
      : fallbackCompletedTasks
    const earnings = hasHelperMetrics
      ? Number(metrics.HelperCompletedValue ?? 0)
      : fallbackEarnings
    const acceptedAsHelper = hasHelperMetrics
      ? Number(metrics.HelperAcceptedTasks ?? fallbackAcceptedAsHelper)
      : Math.max(Number(metrics.CompletedTasks ?? 0), fallbackAcceptedAsHelper)
    const successRate = acceptedAsHelper > 0
      ? Math.round((completedTasks / acceptedAsHelper) * 100)
      : 0
    return {
      completedTasks,
      acceptedTasks: acceptedAsHelper,
      earnings,
      successRate,
    }
  }, [myTasks, summary])

  useEffect(() => {
    let active = true

    async function loadRatingSummary() {
      try {
        const data = await api.myRatingSummary()
        if (active) {
          setRatingSummary({
            rating: Number(data?.rating || 0),
            reviewCount: Number(data?.reviewCount || 0),
          })
        }
      } catch {
        if (active) {
          setRatingSummary({ rating: 0, reviewCount: 0 })
        }
      }
    }

    loadRatingSummary()

    return () => {
      active = false
    }
  }, [])

  const hasRating = (ratingSummary.rating > 0) || (user?.Rating != null && Number(user.Rating) > 0)
  const displayedRating = (Number.isFinite(ratingSummary.rating) && ratingSummary.rating > 0)
    ? ratingSummary.rating
    : (user?.Rating != null ? Number(user.Rating) : null)

  useEffect(() => {
    if (!showCameraModal || !cameraStream || !videoRef.current) return
    videoRef.current.srcObject = cameraStream
  }, [showCameraModal, cameraStream])

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [cameraStream])

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop())
      setCameraStream(null)
    }
    setCameraReady(false)
  }

  function closeCameraModal() {
    stopCamera()
    setShowCameraModal(false)
  }

  async function saveProfileImage(imageDataUrl, fileName = '') {
    if (!imageDataUrl || !user?.UserID) return

    setAvatarBusy(true)
    setAvatarError('')

    try {
      const result = await api.updateMyProfileImage(imageDataUrl, fileName)
      const nextUser = {
        ...(user || {}),
        ProfileImage: String(result?.profileImage || ''),
      }

      if (typeof onUserUpdate === 'function') {
        onUserUpdate(nextUser)
      }
    } catch (err) {
      setAvatarError(err.message || 'Unable to update profile image right now.')
    } finally {
      setAvatarBusy(false)
    }
  }

  function openFilePicker() {
    if (avatarBusy) return
    fileInputRef.current?.click()
  }

  function onPickAvatarFile(event) {
    const picked = event.target.files?.[0]
    if (!picked) return

    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
    const maxBytes = 10 * 1024 * 1024

    if (!allowedTypes.has(picked.type)) {
      setAvatarError('Please upload JPG, PNG, or WEBP image.')
      event.target.value = ''
      return
    }

    if (picked.size > maxBytes) {
      setAvatarError('Image must be 10MB or smaller.')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (result) {
        saveProfileImage(result, picked.name)
      }
    }
    reader.onerror = () => {
      setAvatarError('Unable to read image file. Please try again.')
    }
    reader.readAsDataURL(picked)
    event.target.value = ''
  }

  async function openCameraModal() {
    setAvatarError('')

    if (!navigator?.mediaDevices?.getUserMedia) {
      setAvatarError('Camera is not available on this device/browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
      })

      setCameraStream(stream)
      setShowCameraModal(true)
      setCameraReady(true)
    } catch {
      setAvatarError('Unable to access camera. Please allow permission or upload a photo.')
    }
  }

  async function captureFromCamera() {
    if (!videoRef.current || !captureCanvasRef.current || !cameraReady) return

    const video = videoRef.current
    const canvas = captureCanvasRef.current
    const side = Math.min(video.videoWidth || 0, video.videoHeight || 0)

    if (!side) {
      setAvatarError('Camera is still preparing. Please try again.')
      return
    }

    const sx = Math.max(0, Math.floor((video.videoWidth - side) / 2))
    const sy = Math.max(0, Math.floor((video.videoHeight - side) / 2))

    canvas.width = 512
    canvas.height = 512

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setAvatarError('Unable to capture image from camera.')
      return
    }

    ctx.drawImage(video, sx, sy, side, side, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    await saveProfileImage(dataUrl, `camera-avatar-${Date.now()}.jpg`)
    closeCameraModal()
  }

  const isAdmin = Number(user?.IsAdmin) === 1 || user?.IsAdmin === true || String(user?.IsAdmin) === '1'

  const reasons = [
    {
      icon: '🛡️',
      title: 'Platform Shield',
      text: 'Ensuring a safe environment for all campus users',
      tone: 'blue',
    },
    {
      icon: '📊',
      title: 'Data Insights',
      text: 'Monitoring growth and performance metrics',
      tone: 'warm',
    },
    {
      icon: '⚖️',
      title: 'Fair Moderation',
      text: 'Reviewing tasks and resolving disputes fairly',
      tone: 'green',
    },
    {
      icon: '🚀',
      title: 'Active Growth',
      text: 'Scaling the marketplace for better accessibility',
      tone: 'violet',
    },
  ]

  const menuItems = isAdmin ? [
    { id: 'admin', label: 'Admin Dashboard', icon: '▦' },
    { id: 'reports', label: 'System Reports', icon: '📊' },
    { id: 'settings', label: 'Settings', icon: '⚙' },
    { id: 'support', label: 'Help & Support', icon: '?' },
  ] : [
    { id: 'reviews', label: 'Reviews & Ratings', icon: '☆' },
    { id: 'history', label: 'Task History', icon: '◌' },
    { id: 'settings', label: 'Settings', icon: '⚙' },
    { id: 'support', label: 'Help & Support', icon: '?' },
  ]

  return (
    <section className="page profile-page">
      <header className="profile-header">
        <div className="profile-header-top">
          <div>
            <p className="profile-header-kicker">{isAdmin ? 'Administrator account' : 'Account overview'}</p>
            <h1>Profile</h1>
          </div>
          <button type="button" className="profile-header-action" onClick={() => navigate('/settings')}>
            Edit settings
          </button>
        </div>
      </header>

      <section className="profile-card" aria-label="Profile summary">
        <div className="profile-top-row">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar" aria-hidden={profileImageSrc ? 'false' : 'true'}>
              {profileImageSrc ? (
                <img src={profileImageSrc} alt={`${profileName} profile`} className="profile-avatar-image" />
              ) : (
                <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                  <circle cx="12" cy="8" r="4.1" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M5 20a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onPickAvatarFile}
              className="profile-avatar-file-input"
            />
          </div>
          <div className="profile-main-info">
            <h2>
              {profileName}
              <span className="profile-verified" aria-label="Verified account">✓</span>
            </h2>
            {isAdmin ? (
              <p className="admin-badge">Platform Administrator</p>
            ) : (
              <p>
                {hasRating && displayedRating != null
                  ? <><span className="star-icon full" style={{ fontSize: '1rem' }}>★</span> {displayedRating.toFixed(1)} ({ratingSummary.reviewCount} reviews) • {stats.completedTasks} tasks completed</>
                  : <><span style={{ fontStyle: 'italic', color: '#9ca3af' }}>New user</span> • {stats.completedTasks} tasks completed</>}
              </p>
            )}
            <p className="profile-email-line">{user?.Email || 'No email available'}</p>
            <div className="profile-avatar-actions" aria-label="Profile photo actions">
              <button type="button" className="profile-quick-btn" onClick={openFilePicker} disabled={avatarBusy}>
                {avatarBusy ? 'Saving...' : 'Upload Photo'}
              </button>
              <button type="button" className="profile-quick-btn secondary" onClick={openCameraModal} disabled={avatarBusy}>
                Use Camera
              </button>
            </div>
            {avatarError && <p className="profile-avatar-error">{avatarError}</p>}
          </div>
        </div>

        {!isAdmin && (
          <div className="profile-stat-grid">
            <article className="profile-stat-card earnings">
              <p>Total Earnings</p>
              <strong>P{stats.earnings.toLocaleString()}</strong>
            </article>
            <article className="profile-stat-card success">
              <p>Success Rate</p>
              <strong>{stats.successRate}%</strong>
            </article>
            <article className="profile-stat-card accepted">
              <p>Accepted Tasks</p>
              <strong>{stats.acceptedTasks}</strong>
            </article>
          </div>
        )}

        <div className="profile-quick-actions" aria-label="Profile quick actions">
          {isAdmin ? (
            <button type="button" className="profile-quick-btn" onClick={() => navigate('/admin')}>
              Go to admin panels
            </button>
          ) : (
            <button type="button" className="profile-quick-btn" onClick={() => navigate('/tasks')}>
              View my tasks
            </button>
          )}
          <button type="button" className="profile-quick-btn secondary" onClick={() => navigate('/settings')}>
            Account settings
          </button>
        </div>
      </section>

      <section className="why-card" aria-label={isAdmin ? 'Admin Responsibilities' : 'Why GawaHelper'}>
        <h3>{isAdmin ? 'Admin Overview' : 'Why GawaHelper?'}</h3>
        <div className="why-grid">
          {reasons.map((item) => (
            <article key={item.title} className="why-item">
              <div className={`why-icon ${item.tone}`} aria-hidden="true">{item.icon}</div>
              <h4>{item.title}</h4>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>



      <footer className="profile-footer-note">
        <p>GawaHelper v1.0.0</p>
        <p>{isAdmin ? 'Administrator Portal' : 'Campus Task Marketplace'}</p>
      </footer>

      {showCameraModal && (
        <div className="profile-camera-overlay" role="presentation" onClick={closeCameraModal}>
          <section className="profile-camera-modal" role="dialog" aria-modal="true" aria-label="Capture profile photo" onClick={(event) => event.stopPropagation()}>
            <header className="profile-camera-header">
              <h3>Use Camera</h3>
              <button type="button" className="profile-camera-close" aria-label="Close camera" onClick={closeCameraModal}>
                ×
              </button>
            </header>
            <div className="profile-camera-preview-wrap">
              <video ref={videoRef} className="profile-camera-video" autoPlay playsInline muted />
              <canvas ref={captureCanvasRef} className="profile-camera-canvas" />
            </div>
            <p className="profile-camera-note">Center your face, then tap capture.</p>
            <div className="profile-camera-actions">
              <button type="button" className="profile-quick-btn secondary" onClick={closeCameraModal}>
                Cancel
              </button>
              <button type="button" className="profile-quick-btn" onClick={captureFromCamera} disabled={!cameraReady || avatarBusy}>
                {avatarBusy ? 'Saving...' : 'Capture & Save'}
              </button>
            </div>
          </section>
        </div>
      )}

      <nav className="nav-hint" aria-label="Bottom navigation">
        <div className="sidebar-header">
          <span className="sidebar-brand-icon" aria-hidden="true">
            <img src="/gawalogo.png" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
          </span>
          <span className="sidebar-brand">GawaHelper</span>
        </div>
        {!(Number(user?.IsAdmin) === 1 || user?.IsAdmin === true || String(user?.IsAdmin) === '1') && (
          <>
            <button type="button" className="nav-item" onClick={() => navigate('/home')}>
              <span className="nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                  <path d="M4 11.5 12 4l8 7.5V20H4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </span>
              <span>Home</span>
            </button>
            <button type="button" className="nav-item" onClick={() => navigate('/tasks')}>
              <span className="nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                  <path d="M5 6h6v6H5z" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M14 7h5M14 12h5M5 17h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <span>My Tasks</span>
            </button>
          </>
        )}
        {(Number(user?.IsAdmin) === 1 || user?.IsAdmin === true || String(user?.IsAdmin) === '1') && (
          <button type="button" className="nav-item" onClick={() => navigate('/admin')}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                <path d="M5 6h6v6H5z" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M14 7h5M14 12h5M5 17h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <span>Admin Panels</span>
          </button>
        )}
        {(Number(user?.IsAdmin) === 1 || user?.IsAdmin === true || String(user?.IsAdmin) === '1') && (
          <button type="button" className="nav-item" onClick={() => navigate('/reports')}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                <path d="M3 3v18h18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M7 16l4-8 4 4 4-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span>Reports</span>
          </button>
        )}
        {!(Number(user?.IsAdmin) === 1 || user?.IsAdmin === true || String(user?.IsAdmin) === '1') && (
          <button type="button" className="nav-item" onClick={() => navigate('/notifications')}>
            <span className={`nav-icon ${hasUnreadNotifications ? 'has-alert' : ''}`} aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                <path d="M18 8a6 6 0 0 0-12 0v5l-2 3h16l-2-3z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 19a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {hasUnreadNotifications && <span className="nav-alert-dot" />}
            </span>
            <span>Notifications</span>
          </button>
        )}
        <button type="button" className="nav-item active" aria-current="page" onClick={() => navigate('/profile')}>
          <span className="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation" focusable="false">
              <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M5 20a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span>Profile</span>
        </button>

        <button type="button" className="nav-item" onClick={onLogout}>
          <span className="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation" focusable="false">
              <path d="M10 7V5a2 2 0 0 1 2-2h6v18h-6a2 2 0 0 1-2-2v-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 12h11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="m6 9 3 3-3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>Log out</span>
        </button>
      </nav>
    </section>
  )
}

export default ProfilePage
