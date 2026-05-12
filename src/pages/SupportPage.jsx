import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

function SupportPage({ hasUnreadNotifications = false }) {
  const { user, logout: onLogout } = useAuth()
  const navigate = useNavigate()

  const items = [
    { title: 'How do I post a task?', content: 'Tap the "+" button on the Home screen, fill in the details, and set a budget.', color: 'blue' },
    { title: 'How do I get paid?', content: 'Once the task poster approves your work, confirm payment receipt in the task details to complete the transfer.', color: 'green' },
    { title: 'What if there is a dispute?', content: 'Contact our support team through the official email with your Task ID for assistance.', color: 'orange' },
    { title: 'Email Support', content: 'Reach us at support@gawahelper.com for any technical or account-related inquiries.', color: 'indigo' },
    { title: 'Community Support', content: 'Join our official Messenger group: GawaHelper Official for community discussions.', color: 'blue' },
  ]

  return (
    <section className="guide-page">
      <button type="button" className="guide-back-btn" onClick={() => navigate(-1)} aria-label="Go back">←</button>
      
      <div className="guide-container">
        <header className="guide-header">
          <h1>Help & Support</h1>
          <p>Find answers to common questions or reach out to our team for help.</p>
        </header>

        <div className="guide-list">
          {items.map((item, idx) => (
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

export default SupportPage
