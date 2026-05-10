import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

function formatDisplayTime(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return 'Today'

  return date.toLocaleString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  })
}

function toStatusMeta(status, taskType) {
  const normalized = String(status || '').toLowerCase()
  const type = String(taskType || '').toLowerCase()

  if (type === 'applied' && (normalized === 'open' || normalized.includes('assign') || normalized.includes('progress'))) {
    return { label: 'In Progress', className: 'progress' }
  }

  if (normalized.includes('complete')) {
    return { label: 'Completed', className: 'done' }
  }

  if (normalized.includes('assign') || normalized.includes('progress')) {
    return { label: 'In Progress', className: 'progress' }
  }

  if (normalized.includes('review')) {
    return { label: 'Waiting for Review', className: 'review' }
  }

  if (normalized.includes('cancel')) {
    return { label: 'Cancelled', className: 'cancelled' }
  }

  return { label: 'Waiting for helper', className: 'waiting' }
}

function MyTasksPage({user, myTasks, loading, error, hasUnreadNotifications = false, onLogout}) {
  const navigate = useNavigate()
  const { taskId } = useParams()
  const location = useLocation()
  const initialTab = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const tab = params.get('tab')
    return tab === 'Accepted' || tab === 'Completed' ? tab : 'Posted'
  }, [location.search])
  const [activeTab, setActiveTab] = useState(initialTab)
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const tasks = useMemo(() => {
    const source = Array.isArray(myTasks) ? myTasks : []

    return source.map((task, index) => {
      const status = String(task.Status || '').toLowerCase()
      const type = String(task.TaskType || '').toLowerCase()
      let bucket = type === 'posted' ? 'Posted' : 'Accepted'

      if (status.includes('complete') || status.includes('done')) {
        bucket = 'Completed'
      }

      return {
        id: task.TaskID || `task-${index}`,
        title: task.Title || 'Untitled Task',
        category: task.CategoryName || 'General',
        budget: Number(task.Budget ?? 0),
        location: task.Location || 'No location',
        schedule: formatDisplayTime(task.TaskTime),
        displayName: task.DisplayName || user?.FullName || 'User',
        displayRating: task.DisplayRating != null ? Number(task.DisplayRating) : null,
        displayReviewCount: task.DisplayReviewCount || 0,
        status: task.Status || 'Open',
        taskType: task.TaskType || 'Posted',
        tab: bucket,
      }
    })
  }, [myTasks, user])

  const postedTasks = tasks.filter((task) => task.tab === 'Posted')
  const acceptedTasks = tasks.filter((task) => task.tab === 'Accepted')
  const completedTasks = tasks.filter((task) => task.tab === 'Completed')

  const stats = {
    Posted: postedTasks.length,
    Ongoing: acceptedTasks.length,
    Done: completedTasks.length,
  }

  const activeTasks =
    activeTab === 'Posted'
      ? postedTasks
      : activeTab === 'Accepted'
        ? acceptedTasks
        : completedTasks

  const visibleTasks = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    if (!query) return activeTasks

    return activeTasks.filter((task) =>
      task.title.toLowerCase().includes(query)
      || task.category.toLowerCase().includes(query)
      || task.location.toLowerCase().includes(query)
      || task.displayName.toLowerCase().includes(query)
    )
  }, [activeTasks, searchText])

  const selectedTask = taskId
    ? tasks.find((task) => String(task.id) === String(taskId))
    : null
  const visibleCount = visibleTasks.length
  const totalCount = activeTasks.length

  function openTask(task) {
    navigate(`/task/${task.id}`)
  }

  function closeTaskDetails() {
    navigate('/tasks')
  }

  return (
    <section className="page home-page">
      <header className="tasks-header">
        <h1>My Tasks</h1>
        <p>Manage your tasks and earnings</p>
      </header>

      {error && <div className="feedback error">{error}</div>}

      <section className="tasks-stats-grid">
        <article className="tasks-stat-card posted">
          <span className="tasks-stat-icon">↗</span>
          <h3>{loading ? '...' : stats.Posted}</h3>
          <p>Posted</p>
        </article>
        <article className="tasks-stat-card ongoing">
          <span className="tasks-stat-icon">◷</span>
          <h3>{loading ? '...' : stats.Ongoing}</h3>
          <p>Ongoing</p>
        </article>
        <article className="tasks-stat-card done">
          <span className="tasks-stat-icon">✓</span>
          <h3>{loading ? '...' : stats.Done}</h3>
          <p>Done</p>
        </article>
      </section>

      <section className="tasks-tabs" aria-label="Task tabs">
        <button
          type="button"
          className={`tasks-tab ${activeTab === 'Posted' ? 'active' : ''}`}
          onClick={() => setActiveTab('Posted')}
        >
          Posted ({postedTasks.length})
        </button>
        <button
          type="button"
          className={`tasks-tab ${activeTab === 'Accepted' ? 'active' : ''}`}
          onClick={() => setActiveTab('Accepted')}
        >
          Accepted ({acceptedTasks.length})
        </button>
        <button
          type="button"
          className={`tasks-tab ${activeTab === 'Completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('Completed')}
        >
          Completed ({completedTasks.length})
        </button>
      </section>

      <section className="tasks-toolbar" aria-label="Task search">
        <input
          type="search"
          className="tasks-search-input"
          placeholder="Search by title, category, location, or person"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
        <button type="button" className="tasks-new-btn" onClick={() => navigate('/tasks/new')}>
          Post task
        </button>
      </section>

      <section className="tasks-context-row" aria-label="Task results summary">
        <p>{visibleCount} of {totalCount} tasks shown</p>
        <span>{activeTab} tasks</span>
      </section>

      <section className="tasks-panel">
        {selectedTask && (
          <article className="tasks-selected" aria-live="polite">
            <div>
              <h3>{selectedTask.title}</h3>
              <p>{selectedTask.category}</p>
              <p>Budget: ₱{selectedTask.budget}</p>
            </div>
            <button type="button" className="tasks-tab" onClick={closeTaskDetails}>
              Back to list
            </button>
          </article>
        )}

        {loading && <p className="loading">Loading tasks...</p>}

        {!loading && visibleTasks.length === 0 && (
          <div className="tasks-empty-state">
            <div className="tasks-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                <path d="M4 11.5 12 4l8 7.5V20H4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <h3>
              {activeTab === 'Posted'
                ? 'No posted tasks'
                : activeTab === 'Accepted'
                  ? 'No accepted tasks'
                  : 'No completed tasks'}
            </h3>
            <p>
              {searchText.trim()
                ? 'No tasks match your search. Try another keyword.'
                : activeTab === 'Posted'
                  ? 'Post a task to get started'
                  : 'Try adjusting your filters'}
            </p>
            {activeTab === 'Posted' && !searchText.trim() && (
              <button type="button" className="home-primary-btn" onClick={() => navigate('/tasks/new')}>
                Post your first task
              </button>
            )}
          </div>
        )}

        {!loading && visibleTasks.length > 0 && (
          <ul className="tasks-list">
            {visibleTasks.map((task) => (
              <li key={task.id} className="tasks-list-item">
                <button type="button" className="tasks-list-button" onClick={() => openTask(task)}>
                  <div className="mytask-card-header">
                    <strong>{task.title}</strong>
                    <span className={`mytask-status ${toStatusMeta(task.status, task.taskType).className}`}>
                      {toStatusMeta(task.status, task.taskType).label}
                    </span>
                  </div>

                  <p className="mytask-meta-line">
                    <span className="mytask-rating-inline">
                      {task.displayRating != null 
                        ? `★ ${task.displayRating.toFixed(1)} (${task.displayReviewCount})`
                        : <span style={{fontStyle: 'italic', color: '#9ca3af'}}>New user</span>}
                    </span>
                    <span className="mytask-meta-separator" aria-hidden="true">•</span>
                    <span className="mytask-owner-name">{task.displayName}</span>
                  </p>

                  <div className="mytask-detail-line">⌖ {task.location}</div>
                  <div className="mytask-detail-line">◷ {task.schedule}</div>

                  <div className="mytask-footer">
                    <span className="mytask-category-chip">{task.category}</span>
                    <span className="mytask-budget">₱{task.budget}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav className="nav-hint" aria-label="Bottom navigation">
        <div className="sidebar-header">
          <span className="sidebar-brand-icon" aria-hidden="true">
            <img src="/gawalogo.png" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
          </span>
          <span className="sidebar-brand">GawaHelper</span>
        </div>
        <button type="button" className="nav-item" onClick={() => navigate('/home')}>
          <span className="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation" focusable="false">
              <path d="M4 11.5 12 4l8 7.5V20H4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </span>
          <span>Home</span>
        </button>
        <button type="button" className="nav-item active" aria-current="page" onClick={() => navigate('/tasks')}>
          <span className="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation" focusable="false">
              <path d="M5 6h6v6H5z" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M14 7h5M14 12h5M5 17h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span>My Tasks</span>
        </button>
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
        <button type="button" className="nav-item" onClick={() => navigate('/profile')}>
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

export default MyTasksPage
