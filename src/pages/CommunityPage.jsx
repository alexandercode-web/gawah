import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

function CommunityPage({ hasUnreadNotifications = false }) {
  const { user, logout: onLogout } = useAuth()
  const navigate = useNavigate()

  const guidelines = [
    { title: 'Respect Everyone', content: 'Treat every helper and poster with dignity. Professional communication is the foundation of our community.', color: 'blue' },
    { title: 'Reliability', content: 'Follow through on your commitments. If you accept or post a task, ensure it is completed on time and as described.', color: 'green' },
    { title: 'Safety First', content: 'Keep interactions professional. Never share sensitive personal info and report suspicious behavior immediately.', color: 'orange' },
    { title: 'Prohibited Behavior', content: 'Harassment, illegal tasks, and fraudulent reviews are strictly prohibited and will lead to account suspension.', color: 'red' },
    { title: 'Fair Payments', content: 'Always settle payments fairly and as agreed upon. Transparency builds trust between clients and helpers.', color: 'indigo' },
  ]

  return (
    <section className="guide-page">
      <button type="button" className="guide-back-btn" onClick={() => navigate(-1)} aria-label="Go back">←</button>
      
      <div className="guide-container">
        <header className="guide-header">
          <h1>Community Guidelines</h1>
          <p>GawaHelper is built on trust. Help us maintain a safe and productive environment for everyone.</p>
        </header>

        <div className="guide-list">
          {guidelines.map((item, idx) => (
            <div key={idx} className="guide-card">
              <div className={`guide-card-dot ${item.color}`} />
              <div className="guide-card-content">
                <h3>{item.title}</h3>
                <p>{item.content}</p>
              </div>
            </div>
          ))}
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
