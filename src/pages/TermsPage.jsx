import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

function TermsPage({ hasUnreadNotifications = false }) {
  const { user, logout: onLogout } = useAuth()
  const navigate = useNavigate()

  const sections = [
    { title: 'Acceptance of Terms', content: 'By accessing or using GawaHelper, you agree to be bound by these terms. If you do not agree, please do not use the service.', color: 'orange' },
    { title: 'User Responsibilities', content: 'Users are responsible for providing accurate information and maintaining the security of their accounts.', color: 'blue' },
    { title: 'Task Posting & Completion', content: 'Posters must provide clear requirements. Helpers must complete tasks to the best of their ability.', color: 'orange' },
    { title: 'Prohibited Content', content: 'Illegal, harmful, or violating tasks are strictly prohibited and will be removed.', color: 'red' },
    { title: 'Limitation of Liability', content: 'GawaHelper is a matching platform. We do not guarantee the quality of work or user safety.', color: 'green' },
  ]

  return (
    <section className="guide-page">
      <div className="guide-container">
        <header className="guide-modal-header">
          <h1>Terms of Service</h1>
          <button type="button" className="guide-close-btn" onClick={() => navigate(-1)}>×</button>
        </header>

        <div className="guide-scroll-area">
          <p className="guide-intro">Understand what each section means and your responsibilities as a user.</p>
          
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
            <span><strong>Tip:</strong> Please read our <a href="/privacy">Privacy Policy</a> to understand how we protect your personal data.</span>
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

export default TermsPage
