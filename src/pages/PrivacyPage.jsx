import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

function PrivacyPage({ hasUnreadNotifications = false }) {
  const { user, logout: onLogout } = useAuth()
  const navigate = useNavigate()

  const sections = [
    { title: 'Information Collection', content: 'We collect profile info, task details, and transaction history to facilitate our services.', color: 'blue' },
    { title: 'Data Usage', content: 'Your data is used to match tasks, improve services, and ensure platform safety.', color: 'orange' },
    { title: 'Information Sharing', content: 'We only share info with other users when you interact. We never sell your data.', color: 'green' },
    { title: 'Security Measures', content: 'We use industry-standard encryption to keep your data safe from unauthorized access.', color: 'red' },
  ]

  return (
    <section className="guide-page">
      <div className="guide-container">
        <header className="guide-modal-header">
          <h1>Privacy Policy</h1>
          <button type="button" className="guide-close-btn" onClick={() => navigate(-1)}>×</button>
        </header>

        <div className="guide-scroll-area">
          <p className="guide-intro">Learn how GawaHelper collects, uses, and protects your personal information.</p>
          
          <div className="guide-list">
            {sections.map((section, idx) => (
              <div key={idx} className={`guide-card ${section.color}`}>
                <div className={`guide-card-dot ${section.color}`} />
                <div className="guide-card-content">
                  <h3>{section.title}</h3>
                  <p>{section.content}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="guide-tip-card">
            <span><strong>Tip:</strong> You can manage your privacy preferences and data visibility in your <a href="/settings">Profile Settings</a>.</span>
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

export default PrivacyPage
