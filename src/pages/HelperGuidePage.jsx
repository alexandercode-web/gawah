import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

function HelperGuidePage({ hasUnreadNotifications = false }) {
  const { user, logout: onLogout } = useAuth()
  const navigate = useNavigate()

  const tips = [
    { title: 'Complete Your Profile', content: 'Add a clear photo and detailed skills. A complete profile increases your chances of being hired by 70%.', color: 'blue' },
    { title: 'Write Clear Applications', content: 'When applying for a task, explain briefly why you are the right fit. Clear communication wins more jobs.', color: 'indigo' },
    { title: 'Respond Quickly', content: 'Posters often hire the first qualified person who replies. Keep your notifications on and respond promptly.', color: 'orange' },
    { title: 'Deliver Quality Work', content: 'Your rating is your reputation. High-quality work leads to 5-star reviews and recurring clients.', color: 'green' },
    { title: 'Payment Confirmation', content: 'Once the work is done, ensure the client approves the task in the app to finalize your record and payment.', color: 'indigo' },
  ]

  return (
    <section className="guide-page">
      <button type="button" className="guide-back-btn" onClick={() => navigate(-1)} aria-label="Go back">←</button>
      
      <div className="guide-container">
        <header className="guide-header">
          <h1>Helper Guide</h1>
          <p>Master the platform and grow your reputation as a top-tier GawaHelper.</p>
        </header>

        <div className="guide-list">
          {tips.map((item, idx) => (
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

export default HelperGuidePage
