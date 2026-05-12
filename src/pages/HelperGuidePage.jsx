import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

function HelperGuidePage({ hasUnreadNotifications = false }) {
  const { user, logout: onLogout } = useAuth()
  const navigate = useNavigate()

  const tips = [
    { title: 'Profile Setup', content: 'Add a clear photo and skills. A complete profile builds trust.', color: 'blue' },
    { title: 'Clear Applications', content: 'Explain why you are the right fit. Good communication wins jobs.', color: 'indigo' },
    { title: 'Quick Response', content: 'Reply promptly to messages to increase your hiring rate.', color: 'orange' },
    { title: 'Quality Work', content: 'Deliver high-quality work to earn 5-star ratings and reviews.', color: 'green' },
  ]

  return (
    <section className="guide-page">
      <div className="guide-container">
        <header className="guide-modal-header">
          <h1>Helper Guide</h1>
          <button type="button" className="guide-close-btn" onClick={() => navigate(-1)}>×</button>
        </header>

        <div className="guide-scroll-area">
          <p className="guide-intro">Everything you need to know to grow your reputation and earn more as a Helper.</p>
          
          <div className="guide-list">
            {tips.map((item, idx) => (
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
            <span><strong>Tip:</strong> Your rating is affected by completing tasks on time and with high quality.</span>
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

export default HelperGuidePage
