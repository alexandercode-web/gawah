import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

function CommunityPage({ hasUnreadNotifications = false }) {
  const { user, logout: onLogout } = useAuth()
  const navigate = useNavigate()

  return (
    <section className="page info-page">
      <header className="page-header-minimal">
        <button type="button" className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h1>Community Guidelines</h1>
      </header>

      <div className="info-container">
        <div className="info-hero">
          <div className="info-icon">🤝</div>
          <h2>Our Community</h2>
          <p>GawaHelper is built on trust, respect, and mutual benefit.</p>
        </div>

        <section className="info-section">
          <h3>Core Values</h3>
          <div className="value-grid">
            <div className="value-card">
              <h4>Respect</h4>
              <p>Treat every helper and poster with dignity. Professional communication is key.</p>
            </div>
            <div className="value-card">
              <h4>Reliability</h4>
              <p>Follow through on your commitments. If you accept a task, complete it on time.</p>
            </div>
            <div className="value-card">
              <h4>Safety</h4>
              <p>Keep interactions professional and report any suspicious behavior immediately.</p>
            </div>
          </div>
        </section>

        <section className="info-section">
          <h3>Prohibited Behavior</h3>
          <ul>
            <li>Harassment or abusive language.</li>
            <li>Posting illegal or dangerous tasks.</li>
            <li>Spamming or fraudulent reviews.</li>
            <li>Circumventing the platform for payments.</li>
          </ul>
        </section>

        <footer className="info-footer">
          <p>Join us in building a better workspace for everyone.</p>
        </footer>
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
