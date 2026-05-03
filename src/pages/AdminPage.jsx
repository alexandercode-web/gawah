import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

function AdminPage({ user, onLogout }) {
  const navigate = useNavigate()
  const [adminData, setAdminData] = useState({
    stats: {},
    users: [],
    tasks: [],
    messages: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [selectedImage, setSelectedImage] = useState(null)

  // Check if user is admin
  useEffect(() => {
    const userVal = user?.IsAdmin ?? user?.isAdmin
    const isAdmin = Number(userVal) === 1 || userVal === true || String(userVal) === '1'
    if (!isAdmin) {
      navigate('/home')
      return
    }
  }, [user, navigate])

  useEffect(() => {
    loadAdminData()
  }, [])

  async function loadAdminData() {
    setLoading(true)
    setError('')
    try {
      const [stats, users, tasks, messages] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers(),
        api.getAdminTasks(),
        api.getAdminMessages(),
      ])

      setAdminData({
        stats: stats || {},
        users: Array.isArray(users) ? users : [],
        tasks: Array.isArray(tasks) ? tasks : [],
        messages: Array.isArray(messages) ? messages : [],
      })
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Failed to load admin data:', err)
      setError(err.message || 'Unable to load admin data')
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = adminData.users.filter((user) => {
    const matchesSearch = user.FullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.Email.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const filteredTasks = adminData.tasks.filter((task) => {
    const matchesSearch = task.Title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = filterStatus === 'all' || task.Status === filterStatus
    return matchesSearch && matchesStatus
  })

  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [userForm, setUserForm] = useState({ fullName: '', email: '', password: '', rating: 5 })

  const handleDeactivateUser = async (userId) => {
    if (!window.confirm('Are you sure you want to deactivate this user? This will disable their account without deleting data.')) return
    try {
      await api.adminSuspendUser(userId)
      loadAdminData()
    } catch (err) {
      alert('Failed to deactivate user: ' + err.message)
    }
  }

  const exportMessagesToCSV = (taskTitle, messages) => {
    const headers = ['Message ID', 'Task ID', 'Sender', 'Recipient', 'Content', 'Attachment Type', 'Attachment Name', 'Timestamp']
    const csvRows = [headers.join(',')]
    
    messages.forEach(msg => {
      const row = [
        msg.MessageID,
        msg.TaskID,
        `"${(msg.SenderName || '').replace(/"/g, '""')}"`,
        `"${(msg.RecipientName || '').replace(/"/g, '""')}"`,
        `"${(msg.Content || '').replace(/"/g, '""')}"`,
        msg.AttachmentType || 'none',
        `"${(msg.AttachmentName || '').replace(/"/g, '""')}"`,
        new Date(msg.CreatedAt).toLocaleString()
      ]
      csvRows.push(row.join(','))
    })
    
    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `task_${taskTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_messages.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleActivateUser = async (userId) => {
    if (!window.confirm('Are you sure you want to reactivate this user?')) return
    try {
      await api.adminActivateUser(userId)
      loadAdminData()
    } catch (err) {
      alert('Failed to reactivate user: ' + err.message)
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    try {
      await api.adminCreateUser(userForm)
      setShowUserModal(false)
      setUserForm({ fullName: '', email: '', password: '', rating: 5 })
      loadAdminData()
    } catch (err) {
      alert('Failed to create user: ' + err.message)
    }
  }

  const handleUpdateUser = async (e) => {
    e.preventDefault()
    try {
      await api.adminUpdateUser(editingUser.UserID, userForm)
      setShowUserModal(false)
      setEditingUser(null)
      setUserForm({ fullName: '', email: '', password: '', rating: 5 })
      loadAdminData()
    } catch (err) {
      alert('Failed to update user: ' + err.message)
    }
  }

  const openEditModal = (user) => {
    setEditingUser(user)
    setUserForm({ fullName: user.FullName, email: user.Email, rating: user.Rating, password: '' })
    setShowUserModal(true)
  }

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return
    try {
      await api.adminDeleteTask(taskId)
      loadAdminData()
    } catch (err) {
      alert('Failed to delete task: ' + err.message)
    }
  }

  const groupedMessages = useMemo(() => {
    const groups = {}
    adminData.messages.forEach((msg) => {
      const id = msg.TaskID
      if (!groups[id]) {
        groups[id] = {
          taskId: id,
          taskTitle: msg.TaskTitle || `Task #${id}`,
          messages: [],
        }
      }
      groups[id].messages.push(msg)
    })
    return Object.values(groups).sort((a, b) => {
      const aDate = new Date(a.messages[0]?.CreatedAt || 0)
      const bDate = new Date(b.messages[0]?.CreatedAt || 0)
      return bDate - aDate
    })
  }, [adminData.messages])

  const filteredGroupedMessages = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return groupedMessages

    return groupedMessages.filter((group) => {
      const matchesTitle = group.taskTitle.toLowerCase().includes(query)
      const matchesMessages = group.messages.some((m) =>
        m.Content.toLowerCase().includes(query) ||
        m.SenderName.toLowerCase().includes(query) ||
        m.RecipientName.toLowerCase().includes(query)
      )
      return matchesTitle || matchesMessages
    })
  }, [groupedMessages, searchQuery])

  if (loading) {
    return (
      <section className="page admin-page">
        <div className="admin-loading">
          <div className="spinner" />
          <p>Loading admin data...</p>
        </div>
      </section>
    )
  }

  return (
    <section className="page admin-page">
      <header className="admin-header">
        <div className="admin-header-content">
          <h1>Admin Dashboard</h1>
          <p>Platform management and monitoring</p>
        </div>
        <button
          type="button"
          className="admin-logout-btn"
          onClick={() => onLogout()}
          aria-label="Log out"
        >
          Log Out
        </button>
      </header>

      {error && <div className="feedback error">{error}</div>}

      {/* Refresh Info */}
      <div className="admin-refresh-info">
        <span className="admin-refresh-info-text">
          Last updated: <span className="admin-refresh-time">
            {lastRefresh.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true
            })}
          </span>
        </span>
      </div>

      {/* Stats Overview */}
      {activeTab === 'overview' && (
        <AdminStats
          stats={adminData.stats || {}}
          onCardClick={(label) => {
            if (label === 'Total Users') setActiveTab('users');
            if (label === 'Active Tasks') setActiveTab('tasks');
            if (label === 'Completed Tasks') setActiveTab('tasks');
            if (label === 'Total Messages') setActiveTab('messages');
            if (label === 'Active Helpers') setActiveTab('users');
          }}
        />
      )}

      {/* Navigation Tabs */}
      <nav className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users ({filteredUsers.length})
        </button>
        <button
          className={`admin-tab ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Tasks ({filteredTasks.length})
        </button>
        <button
          className={`admin-tab ${activeTab === 'messages' ? 'active' : ''}`}
          onClick={() => setActiveTab('messages')}
        >
          Messages ({adminData.messages.length})
        </button>
      </nav>

      {/* Users Management */}
      {activeTab === 'users' && (
        <article className="admin-section">
          <h2>User Management</h2>
          <div className="admin-controls">
            <input
              type="text"
              className="admin-search"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              type="button"
              className="admin-create-btn"
              onClick={() => { setEditingUser(null); setUserForm({ fullName: '', email: '', password: '', rating: 5 }); setShowUserModal(true); }}
            >
              + Create User
            </button>
            <button
              type="button"
              className="admin-refresh-btn"
              onClick={loadAdminData}
            >
              ↻ Refresh
            </button>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Rating</th>
                  <th>Tasks Posted</th>
                  <th>Tasks Completed</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="admin-empty-cell">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.UserID} className={u.IsDeactivated ? 'deactivated-row' : ''}>
                      <td>
                        <strong>{u.FullName}</strong> {Number(u.IsDeactivated) === 1 && <span className="status-badge suspended">Deactivated</span>}
                      </td>
                      <td>{u.Email}</td>
                      <td>★ {(Number(u.Rating || 0) > 0 ? Number(u.Rating) : 5.0).toFixed(1)}</td>
                      <td>{u.TasksPosted || 0}</td>
                      <td>{u.TasksCompleted || 0}</td>
                      <td>
                        {new Date(u.CreatedAt).toLocaleDateString()}
                      </td>
                      <td className="admin-actions-cell">
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="admin-action-btn edit"
                            onClick={() => openEditModal(u)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`admin-action-btn ${u.IsDeactivated ? 'success' : 'danger'}`}
                            onClick={() => u.IsDeactivated ? handleActivateUser(u.UserID) : handleDeactivateUser(u.UserID)}
                          >
                            {u.IsDeactivated ? 'Activate' : 'Deactivate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {/* Tasks Management */}
      {activeTab === 'tasks' && (
        <article className="admin-section">
          <h2>Task Management</h2>
          <div className="admin-controls">
            <input
              type="text"
              className="admin-search"
              placeholder="Search by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="admin-filter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="Open">Open</option>
              <option value="Assigned">Assigned</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <button
              type="button"
              className="admin-refresh-btn"
              onClick={loadAdminData}
            >
              ↻ Refresh
            </button>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Poster</th>
                  <th>Status</th>
                  <th>Budget</th>
                  <th>Helper</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="admin-empty-cell">
                      No tasks found
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((t) => (
                    <tr key={t.TaskID}>
                      <td>
                        <strong>{t.Title}</strong>
                      </td>
                      <td>{t.PosterName}</td>
                      <td>
                        <span className={`admin-status ${t.Status.toLowerCase()}`}>
                          {t.Status}
                        </span>
                      </td>
                      <td>P{Number(t.Budget || 0).toFixed(2)}</td>
                      <td>{t.HelperName || '—'}</td>
                      <td>
                        {new Date(t.CreatedAt).toLocaleDateString()}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-action-btn danger"
                          onClick={() => handleDeleteTask(t.TaskID)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {/* Messages Activity */}
      {activeTab === 'messages' && (
        <article className="admin-section">
          <h2>Message Activity</h2>
          <div className="admin-controls">
            <input
              type="text"
              className="admin-search"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              type="button"
              className="admin-refresh-btn"
              onClick={loadAdminData}
            >
              ↻ Refresh
            </button>
          </div>

          <div className="admin-messages-list">
            {filteredGroupedMessages.length === 0 ? (
              <div className="admin-empty">No messages found</div>
            ) : (
              filteredGroupedMessages.map((group) => (
                <div key={group.taskId} className="admin-message-group">
                  <div className="admin-message-group-header">
                    <span className="group-task-id">#{group.taskId}</span>
                    <h3 className="group-task-title">{group.taskTitle}</h3>
                    <div className="group-header-actions">
                      <span className="group-message-count">{group.messages.length} messages</span>
                      <button 
                        className="admin-csv-btn"
                        onClick={() => exportMessagesToCSV(group.taskTitle, group.messages)}
                        title="Export conversation to CSV"
                      >
                        📊 Download CSV
                      </button>
                    </div>
                  </div>
                  <div className="admin-message-thread">
                    {[...group.messages].reverse().map((msg, idx, arr) => {
                      const isSameSender = idx > 0 && arr[idx - 1].SenderName === msg.SenderName

                      // Highlight helper
                      const highlightText = (text, query) => {
                        if (!query.trim()) return text
                        const parts = text.split(new RegExp(`(${query})`, 'gi'))
                        return (
                          <span>
                            {parts.map((part, i) =>
                              part.toLowerCase() === query.toLowerCase()
                                ? <mark key={i} className="admin-search-highlight">{part}</mark>
                                : part
                            )}
                          </span>
                        )
                      }

                      return (
                        <div key={msg.MessageID} className={`admin-chat-bubble ${isSameSender ? 'consecutive' : ''}`}>
                          {!isSameSender && (
                            <div className="bubble-meta">
                              <span className="bubble-author">{msg.SenderName}</span>
                              <span className="bubble-time">
                                {new Date(msg.CreatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          )}
                          <div className="bubble-content">
                            {highlightText(msg.Content, searchQuery)}
                            {msg.AttachmentType && <AttachmentCard msg={msg} onImageClick={setSelectedImage} />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      )}
      {/* Bottom Navigation */}
      <nav className="nav-hint" aria-label="Bottom navigation">
        <div className="sidebar-header">
          <span className="sidebar-brand-icon" aria-hidden="true">
            <img src="/gawalogo.png" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
          </span>
          <span className="sidebar-brand">GawaHelper</span>
        </div>
        <button type="button" className="nav-item active" aria-current="page" onClick={() => navigate('/admin')}>
          <span className="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation" focusable="false">
              <path d="M5 6h6v6H5z" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M14 7h5M14 12h5M5 17h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span>Admin Panels</span>
        </button>
        <button type="button" className="nav-item" onClick={() => navigate('/reports')}>
          <span className="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation" focusable="false">
              <path d="M3 3v18h18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M7 16l4-8 4 4 4-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>Reports</span>
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

      {/* User Modal */}
      {showUserModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <header className="admin-modal-header">
              <h2>{editingUser ? 'Edit User' : 'Create New User'}</h2>
              <button className="admin-modal-close" onClick={() => setShowUserModal(false)}>&times;</button>
            </header>
            <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="admin-modal-form">
              <div className="admin-form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={userForm.fullName}
                  onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                  required
                  placeholder="John Doe"
                />
              </div>
              <div className="admin-form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  required
                  placeholder="john@example.com"
                />
              </div>
              {!editingUser && (
                <div className="admin-form-group">
                  <label>Initial Password</label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    required
                    placeholder="At least 8 characters"
                  />
                </div>
              )}
              {editingUser && (
                <div className="admin-form-group">
                  <label>Rating (1.0 - 5.0)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={userForm.rating}
                    onChange={(e) => setUserForm({ ...userForm, rating: e.target.value })}
                    required
                  />
                </div>
              )}
              <footer className="admin-modal-footer">
                <button type="button" className="admin-btn-secondary" onClick={() => setShowUserModal(false)}>Cancel</button>
                <button type="submit" className="admin-btn-primary">{editingUser ? 'Save Changes' : 'Create User'}</button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div className="admin-image-preview-overlay" onClick={() => setSelectedImage(null)}>
          <div className="admin-image-preview-container" onClick={(e) => e.stopPropagation()}>
            <button className="admin-image-close" onClick={() => setSelectedImage(null)} aria-label="Close preview">&times;</button>
            <img src={selectedImage} alt="Preview" className="admin-preview-img" />
          </div>
        </div>
      )}


      <style>{`
        .admin-page {
          background: #f1f5f9;
          color: #334155;
          min-height: 100vh;
          padding-bottom: 80px;
        }
        .admin-header {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          padding: 2.5rem 3rem;
          color: white;
          box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.2);
        }
        .admin-header h1 {
          color: white;
          font-weight: 800;
          font-size: 2.2rem;
          letter-spacing: -0.03em;
        }
        .admin-stats-grid {
          padding: 3rem;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
        }
        .stat-card {
          background: #ffffff;
          border: 1px solid rgba(59, 130, 246, 0.1);
          border-radius: 20px;
          padding: 1.5rem;
          box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.05);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .stat-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 30px -5px rgba(37, 99, 235, 0.1);
          border-color: #3b82f6;
        }
        .stat-card::after {
          content: 'Click to view details';
          position: absolute;
          bottom: -20px;
          left: 0;
          right: 0;
          background: rgba(59, 130, 246, 0.9);
          color: white;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 4px 0;
          transition: bottom 0.2s ease;
        }
        .stat-card:hover::after { bottom: 0; }
        
        .stat-icon-box {
          width: 50px;
          height: 50px;
          background: #f8fafc;
          border-radius: 12px;
          display: grid;
          place-items: center;
          font-size: 1.5rem;
          margin-bottom: 1rem;
        }
        .stat-label-main {
          font-size: 0.75rem;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.25rem;
        }
        .stat-value {
          font-size: 2rem;
          font-weight: 900;
          color: #1e3a8a;
          line-height: 1.1;
        }
        .stat-label-sub {
          font-size: 0.7rem;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          margin-top: 0.5rem;
          max-width: 100%;
          line-height: 1.2;
        }
        
        .admin-message-group {
          background: #ffffff;
          border-radius: 24px;
          margin: 0 3rem 4rem;
          border: 1px solid #e2e8f0;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.04);
          overflow: hidden;
        }
        .admin-message-group-header {
          background: #f8fafc;
          padding: 1.5rem 2.5rem;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }
        .group-task-id {
          background: #3b82f6;
          color: white;
          padding: 0.4rem 1rem;
          border-radius: 10px;
          font-weight: 800;
          font-size: 0.9rem;
        }
        .group-task-title {
          font-size: 1.2rem;
          color: #1e3a8a;
          font-weight: 800;
        }
        .group-message-count {
          font-size: 0.9rem;
          color: #64748b;
          font-weight: 600;
        }
        .group-header-actions {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }
        .admin-csv-btn {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          color: #1e3a8a;
          padding: 0.4rem 0.85rem;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .admin-csv-btn:hover {
          background: #f8fafc;
          border-color: #3b82f6;
          color: #2563eb;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .admin-message-thread {
          padding: 2.5rem;
          gap: 1.5rem;
          display: flex;
          flex-direction: column;
        }
        .admin-chat-bubble {
          max-width: 85%;
          align-self: flex-start;
        }
        .bubble-meta {
          margin-bottom: 0.5rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .bubble-author { font-size: 0.95rem; font-weight: 800; color: #334155; }
        .bubble-time { font-size: 0.8rem; color: #94a3b8; }
        
        .bubble-content {
          padding: 1rem 1.5rem;
          border-radius: 18px;
          border-top-left-radius: 4px;
          font-size: 1rem;
          line-height: 1.5;
          border: 1px solid #f1f5f9;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
        }
        .admin-chat-bubble:nth-child(odd) .bubble-content {
          background: #eff6ff;
          border-left: 4px solid #3b82f6;
          color: #1e3a8a;
        }
        .admin-chat-bubble:nth-child(even) .bubble-content {
          background: #f0fdf4;
          border-left: 4px solid #10b981;
          color: #064e3b;
        }
        
        .bubble-attachment {
          margin-top: 1rem;
          padding: 0.85rem 1.25rem;
          background: #ffffff;
          border: 2px solid #e2e8f0;
          border-radius: 14px;
          display: flex;
          align-items: center;
          gap: 0.85rem;
          font-weight: 700;
          color: #2563eb;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        .bubble-attachment:hover {
          border-color: #3b82f6;
          background: #f8fafc;
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.1);
        }
        .attachment-icon { font-size: 1.25rem; }
        .attachment-text { font-size: 0.9rem; }
        
        .admin-btn-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .admin-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);
        }
        
        .admin-search-highlight {
          background: #fef08a;
          color: #854d0e;
          padding: 0 2px;
          border-radius: 2px;
          font-weight: 700;
        }
        
        /* Modal Styles */
        .admin-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: modalFadeIn 0.3s ease;
        }

        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .admin-modal {
          background: #ffffff;
          border-radius: 24px;
          width: 90%;
          max-width: 500px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          animation: modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .admin-modal-header {
          padding: 1.5rem 2rem;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f8fafc;
        }

        .admin-modal-header h2 {
          font-size: 1.5rem;
          font-weight: 800;
          color: #1e3a8a;
          margin: 0;
        }

        .admin-modal-close {
          background: #eff6ff;
          border: none;
          color: #3b82f6;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          font-size: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .admin-modal-close:hover {
          background: #dbeafe;
          color: #1d4ed8;
          transform: scale(1.1);
        }

        .admin-modal-form {
          padding: 2rem;
        }

        .admin-form-group {
          margin-bottom: 1.5rem;
        }

        .admin-form-group label {
          display: block;
          font-size: 0.9rem;
          font-weight: 700;
          color: #475569;
          margin-bottom: 0.5rem;
        }

        .admin-form-group input {
          width: 100%;
          padding: 0.875rem 1.25rem;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          font-size: 1rem;
          color: #334155;
          transition: all 0.2s ease;
          background: #f8fafc;
          box-sizing: border-box;
        }

        .admin-form-group input:focus {
          outline: none;
          border-color: #3b82f6;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        .admin-form-group input::placeholder {
          color: #94a3b8;
        }

        .admin-modal-footer {
          margin-top: 2.5rem;
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
        }

        .admin-btn-secondary {
          background: #f1f5f9;
          color: #64748b;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .admin-btn-secondary:hover {
          background: #e2e8f0;
          color: #334155;
        }

        /* Image Preview Styles */
        .admin-image-preview-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          cursor: zoom-out;
          animation: fadeIn 0.3s ease;
        }
        .admin-image-preview-container {
          position: relative;
          max-width: 95%;
          max-height: 95%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .admin-preview-img {
          max-width: 100%;
          max-height: 85vh;
          object-fit: contain;
          border-radius: 8px;
          box-shadow: 0 0 40px rgba(0,0,0,0.5);
          cursor: default;
        }
        .admin-image-close {
          position: absolute;
          top: 15px;
          right: 15px;
          background: rgba(255, 255, 255, 0.9);
          border: none;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          font-size: 1.8rem;
          line-height: 1;
          cursor: pointer;
          display: grid;
          place-items: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          transition: all 0.2s ease;
          z-index: 2001;
          color: #1e3a8a;
        }
        .admin-image-close:hover {
          background: #ffffff;
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(0,0,0,0.3);
        }
        .admin-image-hint {
          display: none;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </section>
  )
}

function AdminStats({ stats, onCardClick }) {
  const cards = [
    { label: 'Total Users', sub: 'Registered Accounts', value: stats.totalUsers || 0, icon: '👥', color: '#3b82f6' },
    { label: 'Active Tasks', sub: 'In Progress', value: stats.activeTasks || 0, icon: '⚡', color: '#f59e0b' },
    { label: 'Completed Tasks', sub: 'Successfully Done', value: stats.completedTasks || 0, icon: '✅', color: '#10b981' },
    { label: 'Total Value', sub: 'Platform Volume', value: `₱${Number(stats.totalValue || 0).toLocaleString()}`, icon: '💰', color: '#06b6d4' },
    { label: 'Total Messages', sub: 'Conversations', value: stats.totalMessages || 0, icon: '💬', color: '#8b5cf6' },
    { label: 'Active Helpers', sub: 'Task Workers', value: stats.activeHelpers || 0, icon: '🤝', color: '#ec4899' },
  ]

  return (
    <div className="admin-stats-grid">
      {cards.map((card, i) => (
        <article key={i} className="stat-card" onClick={() => onCardClick(card.label)}>
          <div className="stat-icon-box" style={{ color: card.color }}>{card.icon}</div>
          <span className="stat-label-main">{card.label}</span>
          <span className="stat-value">{card.value}</span>
          <span className="stat-label-sub">{card.sub}</span>
        </article>
      ))}
    </div>
  )
}

function highlightText(text, query) {
  if (!query || !query.trim()) return text
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="admin-search-highlight">{part}</mark>
    ) : part
  )
}

function AttachmentCard({ msg, onImageClick }) {
  const isImage = msg.AttachmentType === 'image' || (msg.AttachmentName && msg.AttachmentName.match(/\.(jpg|jpeg|png|gif)$/i))
  const icon = isImage ? '🖼️' : '📁'
  const label = isImage ? 'View Image' : 'Download File'
  const fileName = msg.AttachmentName || msg.AttachmentData || 'file'

  const handleClick = () => {
    if (msg.AttachmentData) {
      let url = msg.AttachmentData
      if (url.startsWith('data:')) {
        // base64
      } else if (!url.startsWith('http')) {
        url = `http://localhost:4000/uploads/proofs/${url}`
      }
      
      if (isImage && onImageClick) {
        onImageClick(url)
      } else {
        window.open(url, '_blank')
      }
    }
  }

  return (
    <div className="bubble-attachment" onClick={handleClick} title={fileName}>
      <span className="attachment-icon">{icon}</span>
      <span className="attachment-text">
        {fileName.length > 25 ? fileName.substring(0, 25) + '...' : fileName}
      </span>
    </div>
  )
}

export default AdminPage
