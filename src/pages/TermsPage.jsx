import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

function TermsPage({ hasUnreadNotifications = false }) {
  const { user, logout: onLogout } = useAuth()
  const navigate = useNavigate()

  return (
    <section className="page info-page">
      <header className="page-header-minimal">
        <button type="button" className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h1>Terms of Service</h1>
      </header>

      <div className="info-container">
        <div className="info-hero">
          <div className="info-icon">📜</div>
          <h2>Terms & Conditions</h2>
          <p>Last Updated: May 2026</p>
        </div>

        <section className="info-section">
          <h3>1. Acceptance of Terms</h3>
          <p>By accessing or using GawaHelper, you agree to be bound by these terms. If you do not agree, please do not use the service.</p>
        </section>

        <section className="info-section">
          <h3>2. User Responsibilities</h3>
          <p>Users are responsible for providing accurate information and maintaining the security of their accounts. GawaHelper is not liable for interactions between users.</p>
        </section>

        <section className="info-section">
          <h3>3. Task Posting & Completion</h3>
          <p>Posters must provide clear task requirements. Helpers must complete tasks to the best of their ability. Payments are settled directly between users unless specified otherwise.</p>
        </section>

        <section className="info-section">
          <h3>4. Prohibited Content</h3>
          <p>Users may not post tasks that are illegal, harmful, or violate our community guidelines.</p>
        </section>

        <section className="info-section">
          <h3>5. Limitation of Liability</h3>
          <p>GawaHelper is a platform for matching. We do not guarantee the quality of work or the safety of users.</p>
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

export default TermsPage
