import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

function PrivacyPage({ hasUnreadNotifications = false }) {
  const { user, logout: onLogout } = useAuth()
  const navigate = useNavigate()

  return (
    <section className="page info-page">
      <header className="page-header-minimal">
        <button type="button" className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h1>Privacy Policy</h1>
      </header>

      <div className="info-container">
        <div className="info-hero">
          <div className="info-icon">🔒</div>
          <h2>Your Privacy Matters</h2>
          <p>We are committed to protecting your personal data.</p>
        </div>

        <section className="info-section">
          <h3>Information We Collect</h3>
          <ul>
            <li>Profile info (Name, Email, Phone).</li>
            <li>Task details and transaction history.</li>
            <li>Usage data and device information.</li>
          </ul>
        </section>

        <section className="info-section">
          <h3>How We Use Your Info</h3>
          <p>We use your data to facilitate task matching, improve our services, and ensure platform safety.</p>
        </section>

        <section className="info-section">
          <h3>Data Sharing</h3>
          <p>We only share your information with other users when you interact with them (e.g., sharing your name with a helper). We never sell your data to third parties.</p>
        </section>

        <section className="info-section">
          <h3>Security</h3>
          <p>We use industry-standard encryption to keep your data safe. However, no method of transmission is 100% secure.</p>
        </section>
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
