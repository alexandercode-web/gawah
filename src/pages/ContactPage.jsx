import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

function ContactPage({ hasUnreadNotifications = false }) {
  const { user, logout: onLogout } = useAuth()
  const navigate = useNavigate()

  return (
    <section className="page info-page">
      <header className="page-header-minimal">
        <button type="button" className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h1>Contact Us</h1>
      </header>

      <div className="info-container">
        <div className="info-hero">
          <div className="info-icon">📧</div>
          <h2>Get in Touch</h2>
          <p>We're here to help you with any questions or issues.</p>
        </div>

        <section className="info-section">
          <h3>Contact Details</h3>
          <div className="contact-grid-v2">
            <div className="contact-card-v2">
              <h4>Email</h4>
              <p>support@gawahelper.com</p>
            </div>
            <div className="contact-card-v2">
              <h4>Social Media</h4>
              <p>Facebook: GawaHelper Official</p>
              <p>Twitter: @GawaHelper</p>
            </div>
            <div className="contact-card-v2">
              <h4>Office</h4>
              <p>Campus Center, 2nd Floor</p>
              <p>Manila, Philippines</p>
            </div>
          </div>
        </section>

        <section className="info-section">
          <h3>Send us a Message</h3>
          <form className="contact-form-placeholder" onSubmit={(e) => e.preventDefault()}>
            <input type="text" placeholder="Your Name" className="form-input" />
            <input type="email" placeholder="Your Email" className="form-input" />
            <textarea placeholder="Your Message" className="form-input" rows="4"></textarea>
            <button type="button" className="btn-cta-primary" style={{ width: '100%' }}>Send Message</button>
          </form>
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

export default ContactPage
