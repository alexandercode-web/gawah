import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

function CommunityPage({ hasUnreadNotifications = false }) {
  const { user, logout: onLogout } = useAuth()
  const navigate = useNavigate()

  const guidelines = [
    { title: 'Respect', content: 'Treat every user with dignity. Professional communication is required.', color: 'blue' },
    { title: 'Reliability', content: 'Follow through on your commitments. Complete tasks on time.', color: 'green' },
    { title: 'Safety', content: 'Keep interactions professional and report suspicious behavior immediately.', color: 'orange' },
    { title: 'Prohibited Behavior', content: 'Harassment and illegal tasks will lead to account suspension.', color: 'red' },
  ]

  return (
    <section className="guide-page">
      <div className="guide-container">
        <header className="guide-modal-header">
          <h1>Community Guidelines</h1>
          <button type="button" className="guide-close-btn" onClick={() => navigate(-1)}>×</button>
        </header>

        <div className="guide-scroll-area">
          <p className="guide-intro">Help us build a trusted and safe workspace for every GawaHelper user.</p>
          
          <div className="guide-list">
            {guidelines.map((item, idx) => (
              <div key={idx} className={`guide-card ${item.color}`}>
                <div className={`guide-card-dot ${item.color}`} />
                <div className="guide-card-content">
                  <h3>{item.title}</h3>
                  <p>{item.content}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="guide-tip-card">
            <span><strong>Tip:</strong> Always use the in-app chat to document your task agreements and updates.</span>
          </div>
        </div>
      </div>

      {user && (
        <Sidebar 
          user={user} 
          onLogout={onLogout} 
          hasUnreadNotifications={hasUnreadNotifications} 
        />
      )}
    </section>
  )
}

export default CommunityPage
