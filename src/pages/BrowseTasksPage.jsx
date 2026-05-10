import { useAuth } from '../context/AuthContext'
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export default function BrowseTasksPage({user, hasUnreadNotifications = false, onLogout}) {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [categoryCounts, setCategoryCounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [location, setLocation] = useState('')
  const [sort, setSort] = useState('newest')
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const LIMIT = 20

  const fetchTasks = useCallback(async (reset = false) => {
    try {
      setLoading(true)
      const currentOffset = reset ? 0 : offset
      const result = await api.browseTasks({
        search: search.trim() || undefined,
        categoryId: selectedCategory || undefined,
        location: location.trim() || undefined,
        sort,
        limit: LIMIT,
        offset: currentOffset,
      })
      if (reset) {
        setTasks(result)
        setOffset(result.length)
      } else {
        setTasks(prev => [...prev, ...result])
        setOffset(currentOffset + result.length)
      }
      setHasMore(result.length === LIMIT)
    } catch (err) {
      console.error('Browse tasks error:', err)
    } finally {
      setLoading(false)
    }
  }, [search, selectedCategory, location, sort, offset])

  useEffect(() => {
    api.getTaskCountsByCategory().then(setCategoryCounts).catch(console.error)
  }, [])

  useEffect(() => {
    fetchTasks(true)
  }, [selectedCategory, sort])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchTasks(true)
  }

  const handleLocationSearch = (e) => {
    e.preventDefault()
    fetchTasks(true)
  }

  const formatTimeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  const renderRating = (rating, reviewCount) => {
    if (rating == null || rating === undefined) {
      return <span className="browse-rating browse-rating--new">New user</span>
    }
    return (
      <span className="browse-rating">
        ★ {Number(rating).toFixed(1)}
        <span className="browse-rating__count">({reviewCount || 0})</span>
      </span>
    )
  }

  const totalOpen = categoryCounts.reduce((sum, c) => sum + Number(c.TaskCount || 0), 0)

  return (
    <div className="browse-page">
      <div className="browse-page__header">
        <h1>Browse Tasks</h1>
        <p className="browse-page__subtitle">Find tasks that match your skills and earn money helping fellow students</p>
      </div>

      <div className="browse-page__filters">
        <form className="browse-page__search" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="browse-page__search-input"
          />
          <button type="submit" className="browse-page__search-btn">Search</button>
        </form>

        <form className="browse-page__location-filter" onSubmit={handleLocationSearch}>
          <input
            type="text"
            placeholder="Filter by location..."
            value={location}
            onChange={e => setLocation(e.target.value)}
            className="browse-page__search-input browse-page__search-input--small"
          />
        </form>

        <div className="browse-page__sort">
          <label>Sort by:</label>
          <select value={sort} onChange={e => setSort(e.target.value)}>
            <option value="newest">Newest</option>
            <option value="budget">Highest Budget</option>
            <option value="taskTime">Soonest</option>
          </select>
        </div>
      </div>

      <div className="browse-page__categories">
        <button
          className={`browse-cat-btn ${!selectedCategory ? 'browse-cat-btn--active' : ''}`}
          onClick={() => setSelectedCategory(null)}
        >
          All <span className="browse-cat-btn__count">{totalOpen}</span>
        </button>
        {categoryCounts.map(cat => (
          <button
            key={cat.CategoryID}
            className={`browse-cat-btn ${selectedCategory === cat.CategoryID ? 'browse-cat-btn--active' : ''}`}
            onClick={() => setSelectedCategory(cat.CategoryID === selectedCategory ? null : cat.CategoryID)}
          >
            {cat.CategoryName} <span className="browse-cat-btn__count">{cat.TaskCount || 0}</span>
          </button>
        ))}
      </div>

      {tasks.length === 0 && !loading && (
        <div className="browse-page__empty">
          <p>No open tasks found{search ? ` matching "${search}"` : ''}.</p>
          <p>Check back later or try different filters!</p>
        </div>
      )}

      <div className="browse-page__grid">
        {tasks.map(task => (
          <div
            key={task.TaskID}
            className="browse-task-card"
            onClick={() => navigate(`/task/${task.TaskID}`)}
          >
            <div className="browse-task-card__top">
              <span className="browse-task-card__category">{task.CategoryName || 'Other'}</span>
              <span className="browse-task-card__time">{formatTimeAgo(task.CreatedAt)}</span>
            </div>
            <h3 className="browse-task-card__title">{task.Title}</h3>
            <p className="browse-task-card__desc">
              {(task.Description || '').length > 100
                ? task.Description.slice(0, 100) + '...'
                : task.Description}
            </p>
            <div className="browse-task-card__meta">
              <span className="browse-task-card__location">📍 {task.Location}</span>
              <span className="browse-task-card__budget">₱{Number(task.Budget).toFixed(0)}</span>
            </div>
            <div className="browse-task-card__poster">
              <span className="browse-task-card__poster-name">{task.PosterName}</span>
              {renderRating(task.PosterRating, task.PosterReviewCount)}
            </div>
          </div>
        ))}
      </div>

      {loading && <div className="browse-page__loading">Loading tasks...</div>}

      {hasMore && !loading && tasks.length > 0 && (
        <div className="browse-page__load-more">
          <button onClick={() => fetchTasks(false)} className="browse-page__load-more-btn">
            Load More
          </button>
        </div>
      )}

      <style>{`
        .browse-page {
          max-width: 1100px;
          margin: 0 auto;
          padding: 24px 16px;
        }
        .browse-page__header {
          margin-bottom: 24px;
        }
        .browse-page__header h1 {
          font-size: 28px;
          font-weight: 700;
          color: #1a1a2e;
          margin: 0 0 6px;
        }
        .browse-page__subtitle {
          color: #6b7280;
          font-size: 15px;
          margin: 0;
        }
        .browse-page__filters {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 16px;
          align-items: center;
        }
        .browse-page__search {
          display: flex;
          gap: 8px;
          flex: 1;
          min-width: 200px;
        }
        .browse-page__search-input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        .browse-page__search-input:focus {
          border-color: #0f6b3a;
          box-shadow: 0 0 0 3px rgba(15, 107, 58, 0.1);
        }
        .browse-page__search-input--small {
          max-width: 180px;
        }
        .browse-page__search-btn {
          padding: 10px 20px;
          background: #0f6b3a;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.2s;
        }
        .browse-page__search-btn:hover {
          background: #0a5430;
        }
        .browse-page__sort {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .browse-page__sort label {
          font-size: 13px;
          color: #6b7280;
          white-space: nowrap;
        }
        .browse-page__sort select {
          padding: 9px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          cursor: pointer;
        }
        .browse-page__categories {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }
        .browse-cat-btn {
          padding: 8px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          background: #fff;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .browse-cat-btn:hover {
          border-color: #0f6b3a;
          color: #0f6b3a;
        }
        .browse-cat-btn--active {
          background: #0f6b3a;
          color: #fff;
          border-color: #0f6b3a;
        }
        .browse-cat-btn__count {
          font-size: 11px;
          background: rgba(0,0,0,0.1);
          padding: 2px 7px;
          border-radius: 10px;
        }
        .browse-cat-btn--active .browse-cat-btn__count {
          background: rgba(255,255,255,0.25);
        }
        .browse-page__grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
        }
        .browse-task-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 18px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .browse-task-card:hover {
          border-color: #0f6b3a;
          box-shadow: 0 4px 12px rgba(15, 107, 58, 0.08);
          transform: translateY(-2px);
        }
        .browse-task-card__top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .browse-task-card__category {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: #0f6b3a;
          background: #f0faf4;
          padding: 3px 10px;
          border-radius: 12px;
          letter-spacing: 0.5px;
        }
        .browse-task-card__time {
          font-size: 12px;
          color: #9ca3af;
        }
        .browse-task-card__title {
          font-size: 17px;
          font-weight: 600;
          color: #1a1a2e;
          margin: 0 0 6px;
          line-height: 1.3;
        }
        .browse-task-card__desc {
          font-size: 13px;
          color: #6b7280;
          margin: 0 0 14px;
          line-height: 1.5;
        }
        .browse-task-card__meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .browse-task-card__location {
          font-size: 13px;
          color: #6b7280;
        }
        .browse-task-card__budget {
          font-size: 18px;
          font-weight: 700;
          color: #0f6b3a;
        }
        .browse-task-card__poster {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 10px;
          border-top: 1px solid #f3f4f6;
        }
        .browse-task-card__poster-name {
          font-size: 13px;
          color: #374151;
          font-weight: 500;
        }
        .browse-rating {
          font-size: 13px;
          color: #f59e0b;
          font-weight: 600;
        }
        .browse-rating__count {
          color: #9ca3af;
          font-weight: 400;
          font-size: 12px;
          margin-left: 2px;
        }
        .browse-rating--new {
          color: #9ca3af;
          font-weight: 400;
          font-style: italic;
        }
        .browse-page__empty {
          text-align: center;
          padding: 48px 20px;
          color: #6b7280;
        }
        .browse-page__loading {
          text-align: center;
          padding: 24px;
          color: #6b7280;
        }
        .browse-page__load-more {
          text-align: center;
          padding: 24px;
        }
        .browse-page__load-more-btn {
          padding: 12px 32px;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .browse-page__load-more-btn:hover {
          background: #e5e7eb;
        }
        @media (max-width: 640px) {
          .browse-page__filters {
            flex-direction: column;
          }
          .browse-page__search-input--small {
            max-width: none;
          }
          .browse-page__grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

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
        <button type="button" className="nav-item active" aria-current="page" onClick={() => navigate('/browse')}>
          <span className="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation" focusable="false">
              <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="m21 21-4.3-4.3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span>Browse</span>
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
    </div>
  )
}
