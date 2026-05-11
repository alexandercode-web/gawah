import React, { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

function HomePage({user, summary, myTasks = [], loading, error, hasUnreadNotifications = false, onLogout}) {
  const navigate = useNavigate()
  const [activeCategory, setActiveCategory] = useState('All')
  const [showStatusGuide, setShowStatusGuide] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [statusFilter, setStatusFilter] = useState('All')

  const statusGuideItems = [
    {
      title: 'Waiting for helper',
      description: 'Task is available for helpers to accept',
      dotClass: 'orange',
    },
    {
      title: 'In Progress',
      description: 'Helper is currently working on the task',
      dotClass: 'blue',
    },
    {
      title: 'Waiting for Review',
      description: 'Helper submitted proof, waiting for approval',
      dotClass: 'orange',
    },
    {
      title: 'Completed',
      description: 'Task is done and payment has been released',
      dotClass: 'green',
    },
    {
      title: 'Cancelled',
      description: 'Task was cancelled by poster or helper',
      dotClass: 'red',
    },
  ]

  const categories = [
    { id: 'All', label: 'All' },
    { id: 'Errands', label: 'Errands' },
    { id: 'Tutoring', label: 'Tutoring' },
    { id: 'Delivery', label: 'Delivery' },
    { id: 'Tech Help', label: 'Tech Help' },
  ]

  const normalizedTasks = useMemo(() => {
    const source = Array.isArray(summary?.recentTasks) && summary.recentTasks.length > 0
      ? summary.recentTasks
      : []

    return source.map((task, index) => ({
      id: task.TaskID || task.id || `task-${index}`,
      title: task.Title || task.title || 'Untitled Task',
      rating: task.PosterRating != null ? Number(task.PosterRating) : (task.AvgRating != null ? Number(task.AvgRating) : null),
      reviewCount: task.PosterReviewCount || task.ReviewCount || 0,
      requester: task.PosterName || task.requester || user?.FullName || 'User',
      location: task.Location || task.location || 'No location',
      schedule: task.ScheduledTime || task.schedule || 'Today',
      category: task.CategoryName || task.category || 'General',
      budget: Number(task.Budget ?? task.budget ?? 0),
      status: task.Status || task.status || 'Waiting for helper',
    }))
  }, [summary, user])

  function parseTaskStatus(status) {
    const normalized = String(status || '').trim().toLowerCase()

    if (normalized.includes('complete') || normalized.includes('done') || normalized.includes('finished')) {
      return { label: 'Completed', className: 'completed' }
    }

    if (normalized.includes('proofapproved') || normalized.includes('review')) {
      return { label: 'Waiting for Review', className: 'review' }
    }

    if (normalized.includes('assign') || normalized.includes('progress')) {
      return { label: 'In Progress', className: 'progress' }
    }

    if (normalized.includes('cancel')) {
      return { label: 'Cancelled', className: 'cancelled' }
    }

    return { label: 'Waiting for helper', className: 'waiting' }
  }

  function normalizedStatus(status) {
    return parseTaskStatus(status).label
  }

  const statusFilters = ['All', 'Waiting for helper', 'In Progress', 'Completed', 'Cancelled']

  const filteredTasks = useMemo(() => {
    return normalizedTasks.filter((task) => {
      const matchesCategory =
        activeCategory === 'All' || task.category.toLowerCase() === activeCategory.toLowerCase()

      const matchesStatus =
        statusFilter === 'All' || normalizedStatus(task.status) === statusFilter

      const q = searchText.trim().toLowerCase()
      const matchesSearch =
        !q ||
        task.title.toLowerCase().includes(q) ||
        task.requester.toLowerCase().includes(q) ||
        task.location.toLowerCase().includes(q) ||
        task.category.toLowerCase().includes(q)

      return matchesCategory && matchesStatus && matchesSearch
    })
  }, [activeCategory, normalizedTasks, searchText, statusFilter])

  const showNoTasks = !loading && filteredTasks.length === 0
  const metrics = summary?.metrics || {}
  const helperCompletedTasksFromMyTasks = Array.isArray(myTasks)
    ? myTasks.filter((task) => {
      const type = String(task?.TaskType || '').toLowerCase()
      const status = String(task?.Status || '').toLowerCase()
      return type === 'applied' && status.includes('complete')
    })
    : []
  const fallbackCompletedTaskCount = helperCompletedTasksFromMyTasks.length
  const fallbackCompletedBalance = helperCompletedTasksFromMyTasks.reduce(
    (sum, task) => sum + Number(task?.Budget || 0),
    0
  )
  const totalVisibleBudget = filteredTasks.reduce((sum, task) => sum + Number(task.budget || 0), 0)
  const completedBalance = Number(metrics.HelperCompletedValue ?? fallbackCompletedBalance)
  const completedTaskCount = Number(metrics.HelperCompletedTasks ?? fallbackCompletedTaskCount)
  const completionRate = (() => {
    const open = Number(metrics.OpenTasks || 0)
    const done = completedTaskCount
    const total = open + done
    if (!total) return 0
    return Math.round((done / total) * 100)
  })()

  const totalCompleted = Number(metrics.AllCompletedTasks || metrics.CompletedTasks || 0)

  const homeInsights = [
    { label: 'Open tasks', value: Number(metrics.OpenTasks || 0) },
    { label: 'Completed', value: totalCompleted },
    { label: 'My posts', value: Number(metrics.MyPostedTasks || 0) },
  ]

  const homeHighlights = [
    { label: 'Open', value: Number(metrics.OpenTasks || 0), tone: 'blue' },
    { label: 'Completed', value: totalCompleted, tone: 'green' },
    { label: 'Completion', value: `${completionRate}%`, tone: 'orange' },
  ]

  const priorityItems = [
    { label: 'Project Goal Documents', done: true },

  ]

  function clearAllFilters() {
    setActiveCategory('All')
    setStatusFilter('All')
    setSearchText('')
  }

  function openTask(taskId) {
    navigate(`/task/${taskId}`)
  }

  function statusBadgeLabel(status) {
    return parseTaskStatus(status).label
  }

  function statusBadgeClass(status) {
    return parseTaskStatus(status).className
  }

  return (
    <section className="page home-page">
      <header className="home-header">
        <div className="home-header-content">
          <div className="home-brand-block">
            <div className="home-brand-icon" aria-hidden="true">
              <img src="/small-logo.png?v=2" alt="" className="home-brand-icon-image" />
            </div>
            <div>
              <h1>GawaHelper</h1>
              <p>{`Welcome back${user?.FullName ? `, ${user.FullName.split(' ')[0]}` : ''}. Find tasks or get help.`}</p>
            </div>
          </div>
        </div>

        <div className="home-action-row">
          <button
            type="button"
            className="icon-btn help-btn"
            aria-label="Task status guide"
            onClick={() => setShowStatusGuide(true)}
          >
            ?
          </button>
          <button
            type="button"
            className="icon-btn add-btn"
            aria-label="Post task"
            onClick={() => navigate('/tasks/new')}
          >
            +
          </button>
        </div>
      </header>

      {error && <div className="feedback error">{error}</div>}

      <section className="home-dashboard-shell" aria-label="Overview dashboard">
        <div className="home-dashboard-head">
          <div>
            <h2>Overview</h2>
            <p>Grow your business faster today</p>
          </div>
          <div className="home-dashboard-actions">
            <button type="button" className="home-pill-btn">This Year 2026</button>
            <button type="button" className="home-export-btn" onClick={() => navigate('/tasks/new')}>
              Post Task
            </button>
          </div>
        </div>

        <div className="home-overview-grid">
          <article className="home-hero-panel">
            <p className="home-hero-kicker">Completed Balance</p>
            <h3>₱{completedBalance.toLocaleString()}</h3>
            <span>{completedTaskCount} completed task{completedTaskCount === 1 ? '' : 's'}</span>

            <div className="home-hero-actions">
              <button type="button" className="home-secondary-btn" onClick={() => navigate('/tasks')}>
                View Details
              </button>
              <button type="button" className="home-primary-btn" onClick={() => navigate('/tasks/new')}>
                Create New
              </button>
            </div>
          </article>

          <article className="home-side-panel">
            <div className="home-side-head">
              <p>Task Completed</p>
              <strong>{totalCompleted}</strong>
            </div>

            <div className="home-side-list">
              {priorityItems.map((item) => (
                <div key={item.label} className="home-side-item">
                  <span>{item.label}</span>
                  <span className={`home-side-check ${item.done ? 'done' : ''}`} aria-hidden="true">
                    {item.done ? '✓' : '•'}
                  </span>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="home-summary-row">
          {homeHighlights.map((item) => (
            <article key={item.label} className={`home-summary-card ${item.tone}`}>
              <p>{item.label}</p>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>

        <div className="home-insights-row" aria-label="Task insights">
          {homeInsights.map((item) => (
            <article key={item.label} className="home-insight-card">
              <p>{item.label}</p>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="category-filters">
        {categories.map((category) => (
          <button
            key={category.id}
            className={`category-filter ${activeCategory === category.id ? 'active' : ''}`}
            type="button"
            onClick={() => setActiveCategory(category.id)}
          >
            {category.label}
          </button>
        ))}
      </section>

      <div className="home-dashboard-head" style={{ marginTop: '32px' }}>
        <div>
          <h2>Tasks near you</h2>
          <p>Find tasks posted by fellow students</p>
        </div>

      </div>

      <section className="task-cards">
        {loading && <p className="loading">Loading tasks...</p>}

        {!loading && filteredTasks.length > 0 && (
          <div className="card-grid">
            {filteredTasks.map((task) => (
              <article
                key={task.id}
                className="task-card"
                role="button"
                tabIndex={0}
                onClick={() => openTask(task.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openTask(task.id)
                  }
                }}
              >
                <div className="task-header">
                  <h3>{task.title}</h3>
                  <span className={`task-status-pill ${statusBadgeClass(task.status)}`}>{statusBadgeLabel(task.status)}</span>
                </div>

                <div className="task-rating">
                  {task.rating != null ? (
                    <>
                      <span className="star">★</span>
                      <span className="rating">{task.rating.toFixed(1)}</span>
                      <span className="review-count" style={{color: '#9ca3af', fontSize: '12px', marginLeft: '2px'}}>({task.reviewCount})</span>
                    </>
                  ) : (
                    <>
                      <span className="star">★</span>
                      <span className="rating">5.0</span>
                      <span className="review-count" style={{color: '#9ca3af', fontSize: '12px', marginLeft: '2px'}}>(0)</span>
                    </>
                  )}
                  <span className="requester">• {task.requester}</span>
                </div>

                <div className="task-details">
                  <div className="detail-item">
                    <span className="icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                        <path d="M12 22s7-5.4 7-12a7 7 0 1 0-14 0c0 6.6 7 12 7 12z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="10" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    </span>
                    <span>{task.location}</span>
                  </div>
                  <div className="detail-item">
                    <span className="icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
                        <path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span>{task.schedule}</span>
                  </div>
                </div>

                <div className="task-footer">
                  <span className="category-badge">{task.category}</span>
                  <span className="budget">₱{task.budget}</span>
                </div>
              </article>
            ))}
          </div>
        )}

        {showNoTasks && (
          <div className="empty-state">
            <div className="empty-icon">⌕</div>
            <h3>No tasks found</h3>
            <p>Try adjusting your search or filters</p>
            <div className="empty-state-actions">
              <button type="button" className="home-secondary-btn" onClick={clearAllFilters}>
                Clear filters
              </button>
              <button type="button" className="home-primary-btn" onClick={() => navigate('/tasks/new')}>
                Post a task
              </button>
            </div>
          </div>
        )}
      </section>

      {showStatusGuide && (
        <div
          className="status-guide-overlay"
          role="presentation"
          onClick={() => setShowStatusGuide(false)}
        >
          <section
            className="status-guide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-guide-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="status-guide-header">
              <h2 id="status-guide-title">Task Status Guide</h2>
              <button
                type="button"
                className="status-guide-close"
                aria-label="Close status guide"
                onClick={() => setShowStatusGuide(false)}
              >
                ×
              </button>
            </header>

            <div className="status-guide-content">
              <p className="status-guide-intro">
                Understand what each task status means and what actions you can take.
              </p>

              <div className="status-guide-list">
                {statusGuideItems.map((item) => (
                  <article key={item.title} className="status-guide-item">
                    <p className={`status-guide-item-title ${item.dotClass}`}>
                      <span className={`status-dot ${item.dotClass}`} aria-hidden="true" />
                      {item.title}
                    </p>
                    <p className="status-guide-item-description">{item.description}</p>
                  </article>
                ))}
              </div>

              <aside className="status-guide-tip">
                <strong>Tip:</strong> Your rating is affected by completing tasks on time and avoiding cancellations.
              </aside>
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
        <button type="button" className="nav-item active" aria-current="page" onClick={() => navigate('/home')}>
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

export default HomePage
