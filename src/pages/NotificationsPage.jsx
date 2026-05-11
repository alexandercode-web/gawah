import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import Sidebar from '../components/Sidebar'

function NotificationGlyph({type}) {
  if (type === 'success') {
    return (
      <svg viewBox="0 0 24 24" role="presentation" focusable="false">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M8 12.5 10.8 15.2 16 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (type === 'upload') {
    return (
      <svg viewBox="0 0 24 24" role="presentation" focusable="false">
        <path d="M12 16V7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="m8.5 10.5 3.5-3.5 3.5 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 17v2h14v-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (type === 'money') {
    return (
      <svg viewBox="0 0 24 24" role="presentation" focusable="false">
        <path d="M12 4v16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M16.5 8.5A3.5 3.5 0 0 0 13 6h-2a3 3 0 0 0 0 6h2a3 3 0 1 1 0 6h-2a3.5 3.5 0 0 1-3.5-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (type === 'cancel') {
    return (
      <svg viewBox="0 0 24 24" role="presentation" focusable="false">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M8 8l8 8M16 8l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (type === 'warn') {
    return (
      <svg viewBox="0 0 24 24" role="presentation" focusable="false">
        <path d="M12 2l10 18H2z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 9v4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1" fill="currentColor" />
      </svg>
    )
  }

  if (type === 'error') {
    return (
      <svg viewBox="0 0 24 24" role="presentation" focusable="false">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M8 8l8 8M16 8l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" role="presentation" focusable="false">
      <path d="M18 8a6 6 0 0 0-12 0v5l-2 3h16l-2-3z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 19a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function NotificationsPage({ summary, myTasks, user, onNotificationsRead, onLogout }) {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshToast, setRefreshToast] = useState('')
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [ratingDetails, setRatingDetails] = useState(null)
  const [ratingModalLoading, setRatingModalLoading] = useState(false)

  async function loadNotifications() {
    setLoading(true)
    try {
      const data = await api.listNotifications()
      if (Array.isArray(data)) {
        setItems(data)
      }
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    setRefreshToast('')
    try {
      const data = await api.listNotifications()
      if (Array.isArray(data)) {
        const oldCount = items.length
        setItems(data)
        const newCount = data.length - oldCount
        if (newCount > 0) {
          setRefreshToast(`${newCount} new notification${newCount > 1 ? 's' : ''}`)
        } else {
          setRefreshToast('All caught up!')
        }
      }
    } catch (error) {
      console.error('Failed to refresh notifications:', error)
      setRefreshToast('Refresh failed')
    } finally {
      setRefreshing(false)
      setTimeout(() => setRefreshToast(''), 2500)
    }
  }

  async function markAllAsRead() {
    const unreadItems = items.filter((item) => Number(item?.IsRead || 0) === 0)
    if (unreadItems.length === 0) return

    try {
      await Promise.all(
        unreadItems.map((item) => api.markNotificationAsRead(item.NotificationID).catch(() => null))
      )
      setItems((prev) => prev.map((item) => ({ ...item, IsRead: 1 })))
      if (typeof onNotificationsRead === 'function') {
        onNotificationsRead()
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  useEffect(() => {
    if (typeof onNotificationsRead === 'function') {
      onNotificationsRead()
    }
  }, [onNotificationsRead])

  useEffect(() => {
    if (!Array.isArray(items) || items.length === 0) return

    const unreadItems = items.filter((item) => Number(item?.IsRead || 0) === 0)
    if (unreadItems.length === 0) return

    Promise.all(
      unreadItems.map((item) => api.markNotificationAsRead(item.NotificationID).catch(() => null))
    ).then(() => {
      setItems((prevItems) => prevItems.map((item) => ({ ...item, IsRead: 1 })))
      if (typeof onNotificationsRead === 'function') {
        onNotificationsRead()
      }
    })
  }, [items, onNotificationsRead])

  useEffect(() => {
    let active = true

    async function initialLoad() {
      setLoading(true)
      try {
        const data = await api.listNotifications()
        if (active) {
          setItems(Array.isArray(data) ? data : [])
        }
      } catch {
        if (active) {
          setItems([])
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    initialLoad()

    return () => {
      active = false
    }
  }, [])

  // Auto-refresh notifications every minute and update timestamps
  useEffect(() => {
    const interval = setInterval(() => {
      api.listNotifications()
        .then(data => {
          if (Array.isArray(data)) {
            // Merge new notifications with existing ones, avoiding duplicates
            setItems(prevItems => {
              const existingIds = new Set(prevItems.map(item => item.NotificationID))
              const newItems = data.filter(item => !existingIds.has(item.NotificationID))
              // Combine and sort by creation date (newest first)
              return [...data, ...prevItems.filter(item => !data.some(d => d.NotificationID === item.NotificationID))]
                .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt))
            })
          }
        })
        .catch(error => {
          console.error('Auto-refresh failed:', error)
        })
    }, 60000) // 60 seconds

    return () => clearInterval(interval)
  }, [])

  // Update timestamps every 30 seconds for real-time relative times
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render to update timestamps
      setItems(prevItems => [...prevItems])
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [])

  function formatRelativeTime(value) {
    const date = value ? new Date(value) : null
    if (!date || Number.isNaN(date.getTime())) return 'just now'

    const diffMs = Date.now() - date.getTime()
    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour

    if (diffMs < minute) return 'just now'
    if (diffMs < hour) {
      const minutes = Math.max(1, Math.floor(diffMs / minute))
      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
    }
    if (diffMs < day) {
      const hours = Math.max(1, Math.floor(diffMs / hour))
      return `${hours} hour${hours === 1 ? '' : 's'} ago`
    }

    const days = Math.max(1, Math.floor(diffMs / day))
    return `${days} day${days === 1 ? '' : 's'} ago`
  }

  function deriveTitle(message) {
    const lower = String(message || '').toLowerCase()

    if (lower.includes('accepted')) return 'Task Accepted!'
    if (lower.includes('proof')) return 'Proof Submitted'
    if (lower.includes('message') || lower.includes('sent you')) return 'New Message'
    if (lower.includes('rating') || lower.includes('star')) return 'Rating Received'
    if (lower.includes('payment') || lower.includes('released') || lower.includes('earnings')) {
      return 'Payment Released'
    }
    if (lower.includes('cancelled')) return 'Task Cancelled'
    if (lower.includes('reminder') || lower.includes('upcoming')) return 'Upcoming Task'
    if (lower.includes('review')) return 'Task Review'
    return 'Task Update'
  }

  async function handleNotificationClick(notificationId, senderId, taskId, message) {
    
    // Extract the actual notification ID from the format "n-123"
    const actualNotificationId = notificationId.replace('n-', '')
    
    try {
      // Mark notification as read on backend
      await api.markNotificationAsRead(actualNotificationId)

      // Update local state immediately to remove the "new" badge
      setItems(prevItems =>
        prevItems.map(item =>
          item.NotificationID === Number(actualNotificationId)
            ? { ...item, IsRead: 1 }
            : item
        )
      )
          } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }

    // Check if this is a message notification
    const isMessage = String(message || '').toLowerCase().includes('message') || String(message || '').toLowerCase().includes('sent you')

    // Check if this is a rating notification
    const isRating = String(message || '').toLowerCase().includes('rating') || String(message || '').toLowerCase().includes('star')

    if (isRating && taskId) {
      // Load task details to get review comment
      setRatingModalLoading(true)
      try {
        const taskData = await api.getTask(taskId)
        setRatingDetails({
          taskTitle: taskData.Title,
          posterName: taskData.PosterName,
          rating: taskData.PosterReviewRating,
          comment: taskData.PosterReviewComment,
          taskId: taskId,
        })
        setShowRatingModal(true)
      } catch (error) {
        console.error('Failed to load task details:', error)
        // Fall back to navigating to task
        navigate(`/task/${taskId}`)
      } finally {
        setRatingModalLoading(false)
      }
    } else if (isMessage && senderId && taskId) {
            navigate(`/messages/${senderId}/${taskId}`)
    } else if (taskId) {
            navigate(`/task/${taskId}`)
    } else {
      console.warn('No destination available, navigating to tasks list')
      navigate('/tasks')
    }
  }

  const notifications = useMemo(() => {
    // Only show real notifications from database
    if (items.length > 0) {
      return items.map((item) => ({
        ...(() => {
          const message = String(item.Message || '').toLowerCase()
          if (message.includes('accepted')) return { iconType: 'success', iconClass: 'success' }
          if (message.includes('message') || message.includes('sent you')) return { iconType: 'info', iconClass: 'info' }
          if (message.includes('rating') || message.includes('star')) return { iconType: 'success', iconClass: 'success' }
          if (message.includes('proof')) return { iconType: 'upload', iconClass: 'info' }
          if (message.includes('payment') || message.includes('earnings') || message.includes('released')) {
            return { iconType: 'money', iconClass: 'money' }
          }
          if (message.includes('cancelled')) return { iconType: 'cancel', iconClass: 'error' }
          if (message.includes('reminder') || message.includes('upcoming')) return { iconType: 'warn', iconClass: 'warn' }
          return { iconType: 'info', iconClass: 'info' }
        })(),
        id: `n-${item.NotificationID}`,
        taskId: item.TaskID,
        senderId: item.SenderID,
        title: deriveTitle(item.Message),
        message: item.Message,
        time: formatRelativeTime(item.CreatedAt),
        isNew: Number(item.IsRead || 0) === 0,
      }))
    }

    // No demo notifications - show empty list if no real notifications
    return []
  }, [items])

  const unreadCount = notifications.filter((item) => item.isNew).length
  const notificationOverview = [
    { label: 'Total', value: notifications.length },
    { label: 'Unread', value: unreadCount },
    { label: 'Task updates', value: notifications.filter((item) => item.taskId).length },
  ]

  return (
    <section className="page notifications-page">
      <header className="notifications-header">
        <div className="notifications-header-top">
          <div>
            <h1>Notifications</h1>
            <p>Stay updated with your tasks</p>
          </div>
          <div className="notifications-actions">
            <button
              className={`refresh-btn ${refreshing ? 'is-refreshing' : ''}`}
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh notifications"
            >
              <svg viewBox="0 0 24 24" role="presentation" focusable="false" className={refreshing ? 'spinning' : ''}>
                <path d="M1 4v6h6M23 20v-6h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22-4l-4.64 4.36A9 9 0 0 1 3.51 19L1 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button className="mark-read-btn" type="button" onClick={markAllAsRead} disabled={unreadCount === 0}>
              Mark all read
            </button>
          </div>
        </div>
        {refreshing && <div className="notif-refresh-bar" />}
        {refreshToast && <div className="notif-refresh-toast">{refreshToast}</div>}
      </header>

      <section className="notifications-overview" aria-label="Notification overview">
        {notificationOverview.map((item) => (
          <article key={item.label} className="notifications-overview-card">
            <p>{item.label}</p>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="notifications-list" aria-label="Notifications">
        {loading && <p className="loading">Loading notifications...</p>}
        {notifications.length === 0 && !loading && (
          <div className="no-notifications-wrap">
            <p className="no-notifications">No notifications yet. Stay tuned!</p>
            <div className="empty-state-actions">
              <button type="button" className="home-secondary-btn" onClick={() => navigate('/home')}>
                Back to Home
              </button>
              <button type="button" className="home-primary-btn" onClick={() => navigate('/tasks')}>
                View Tasks
              </button>
            </div>
          </div>
        )}
        {notifications.map((item) => (
          <article
            key={item.id}
            className={`notification-card ${item.isNew ? 'is-new' : ''}`}
            onClick={() => handleNotificationClick(item.id, item.senderId, item.taskId, item.message)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleNotificationClick(item.id, item.senderId, item.taskId, item.message)
              }
            }}
          >
            <div className={`notification-icon ${item.iconClass}`} aria-hidden="true">
              <NotificationGlyph type={item.iconType} />
            </div>

            <div className="notification-content">
              <div className="notification-top">
                <h3>{item.title}</h3>
                <time>{item.time}</time>
              </div>
              <p>{item.message}</p>

              {item.isNew && (
                <span className="notification-badge">
                  <span className="notification-dot" aria-hidden="true" />
                  New
                </span>
              )}
            </div>
          </article>
        ))}
      </section>

      <Sidebar 
        user={user} 
        onLogout={onLogout} 
        hasUnreadNotifications={false} 
      />

      {showRatingModal && ratingDetails && (
        <div className="rating-modal-overlay" role="presentation" onClick={() => setShowRatingModal(false)}>
          <section
            className="rating-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rating-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="rating-modal-header">
              <h3 id="rating-modal-title">Rating Received</h3>
              <button
                type="button"
                className="rating-modal-close"
                aria-label="Close rating modal"
                onClick={() => setShowRatingModal(false)}
              >
                ×
              </button>
            </header>

            <div className="rating-modal-content">
              <p className="rating-task-title">{ratingDetails.taskTitle}</p>
              <p className="rating-from">From: <strong>{ratingDetails.posterName}</strong></p>

              <div className="rating-stars-display">
                {[1, 2, 3, 4, 5].map((star) => {
                  const ratingVal = Number(ratingDetails.rating || 0)
                  const isFull = ratingVal >= star
                  const isHalf = !isFull && ratingVal >= star - 0.5
                  return (
                    <span key={star} className={`star-icon ${isFull ? 'full' : isHalf ? 'half' : 'empty'}`}>
                      ★
                    </span>
                  )
                })}
                <span className="rating-value">{Number(ratingDetails.rating || 0).toFixed(1)}</span>
              </div>

              {ratingDetails.comment && (
                <div className="rating-comment-box">
                  <p className="rating-comment-label">Feedback:</p>
                  <p className="rating-comment-text">{ratingDetails.comment}</p>
                </div>
              )}

              <div className="rating-modal-actions">
                <button
                  type="button"
                  className="rating-modal-close-btn"
                  onClick={() => setShowRatingModal(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="rating-modal-view-task-btn"
                  onClick={() => {
                    setShowRatingModal(false)
                    navigate(`/task/${ratingDetails.taskId}`)
                  }}
                >
                  View Task
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

export default NotificationsPage
