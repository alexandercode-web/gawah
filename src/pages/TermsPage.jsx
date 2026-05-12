import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

function TermsPage({ hasUnreadNotifications = false }) {
  const { user, logout: onLogout } = useAuth()
  const navigate = useNavigate()

  const sections = [
    { title: '1. Acceptance of Terms', content: 'By accessing or using GawaHelper, you agree to be bound by these terms. If you do not agree, please do not use the service.', color: 'orange' },
    { title: '2. User Responsibilities', content: 'Users are responsible for providing accurate information and maintaining the security of their accounts. GawaHelper is not liable for interactions between users.', color: 'blue' },
    { title: '3. Task Posting & Completion', content: 'Posters must provide clear task requirements. Helpers must complete tasks to the best of their ability. Payments are settled directly between users.', color: 'orange' },
    { title: '4. Prohibited Content', content: 'Users may not post tasks that are illegal, harmful, or violate our community guidelines. We reserve the right to remove such content.', color: 'red' },
    { title: '5. Limitation of Liability', content: 'GawaHelper is a platform for matching. We do not guarantee the quality of work or the safety of users in offline interactions.', color: 'indigo' },
  ]

  return (
    <section className="guide-page">
      <button type="button" className="guide-back-btn" onClick={() => navigate(-1)} aria-label="Go back">←</button>
      
      <div className="guide-container">
        <header className="guide-header">
          <h1>Terms of Service</h1>
          <p>Understand the rules and guidelines for using GawaHelper. Updated May 2026.</p>
        </header>

        <div className="guide-list">
          {sections.map((section, idx) => (
            <div key={idx} className="guide-card">
              <div className={`guide-card-dot ${section.color}`} />
              <div className="guide-card-content">
                <h3>{section.title}</h3>
                <p>{section.content}</p>
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

export default TermsPage
