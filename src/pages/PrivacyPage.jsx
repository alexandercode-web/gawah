import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

function PrivacyPage({ hasUnreadNotifications = false }) {
  const { user, logout: onLogout } = useAuth()
  const navigate = useNavigate()

  const sections = [
    { title: 'Information We Collect', content: 'We collect profile information such as your name, email, and phone number, along with task details and transaction history to facilitate our services.', color: 'blue' },
    { title: 'How We Use Your Info', content: 'We use your data to facilitate task matching, improve our platform services, and ensure the safety of all community members.', color: 'orange' },
    { title: 'Data Sharing', content: 'We only share your information with other users when you interact with them (e.g., sharing your name with a helper). We never sell your data to third parties.', color: 'green' },
    { title: 'Data Security', content: 'We use industry-standard encryption to keep your data safe. However, please be aware that no method of transmission over the internet is 100% secure.', color: 'red' },
    { title: 'Your Rights', content: 'You have the right to access, update, or request the deletion of your personal data at any time through your profile settings.', color: 'indigo' },
  ]

  return (
    <section className="guide-page">
      <button type="button" className="guide-back-btn" onClick={() => navigate(-1)} aria-label="Go back">←</button>
      
      <div className="guide-container">
        <header className="guide-header">
          <h1>Privacy Policy</h1>
          <p>Your privacy matters to us. Learn how we handle and protect your personal information.</p>
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

export default PrivacyPage
