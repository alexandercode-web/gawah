import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

function HelperGuidePage({ hasUnreadNotifications = false }) {
  const { user, logout: onLogout } = useAuth()
  const navigate = useNavigate()

  return (
    <section className="page info-page">
      <header className="page-header-minimal">
        <button type="button" className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h1>Helper Guide</h1>
      </header>

      <div className="info-container">
        <div className="info-hero">
          <div className="info-icon">🚀</div>
          <h2>Success as a Helper</h2>
          <p>Everything you need to know to earn more and grow your reputation.</p>
        </div>

        <section className="info-section">
          <h3>Getting Started</h3>
          <ol>
            <li><strong>Complete your profile:</strong> Add a clear photo and details about your skills.</li>
            <li><strong>Browse tasks:</strong> Filter by category or location to find what fits you.</li>
            <li><strong>Apply with detail:</strong> Tell the poster why you're the best fit for the job.</li>
          </ol>
        </section>

        <section className="info-section">
          <h3>Best Practices</h3>
          <div className="guide-grid">
            <div className="guide-card">
              <h4>Quick Response</h4>
              <p>Posters appreciate fast replies. Keep an eye on your messages.</p>
            </div>
            <div className="guide-card">
              <h4>Quality Work</h4>
              <p>Go above and beyond. High ratings lead to more task opportunities.</p>
            </div>
            <div className="guide-card">
              <h4>Fair Pricing</h4>
              <p>Be honest about your rates and respect the poster's budget.</p>
            </div>
          </div>
        </section>

        <section className="info-section">
          <h3>Getting Paid</h3>
          <p>Once you complete a task, the poster will mark it as done. Make sure to confirm the completion in the app to finalize the record.</p>
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

export default HelperGuidePage
