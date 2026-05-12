import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

function SupportPage({ hasUnreadNotifications = false }) {
  const { user, logout: onLogout } = useAuth()
  const navigate = useNavigate()

  const items = [
    { title: 'Task Posting', content: 'Tap the "+" button on Home, fill details, and set your budget.', color: 'orange' },
    { title: 'Payments', content: 'Confirm receipt in task details after the poster approves your work.', color: 'blue' },
    { title: 'Disputes', content: 'Contact support through email with your Task ID for help with issues.', color: 'orange' },
    { title: 'Email Support', content: 'Reach us directly at support@gawahelper.com for technical help.', color: 'green' },
  ]

  return (
    <section className="guide-page">
      <div className="guide-container">
        <header className="guide-modal-header">
          <h1>Help & Support</h1>
          <button type="button" className="guide-close-btn" onClick={() => navigate(-1)}>×</button>
        </header>

        <div className="guide-scroll-area">
          <p className="guide-intro">Find quick answers or contact our team for assistance with your tasks.</p>
          
          <div className="guide-list">
            {items.map((item, idx) => (
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
            <span><strong>Tip:</strong> Join our <a href="https://facebook.com">Messenger Group</a> for faster community-based support.</span>
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

export default SupportPage
