import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

function ContactPage({ hasUnreadNotifications = false }) {
  const { user, logout: onLogout } = useAuth()
  const navigate = useNavigate()

  const contactMethods = [
    { title: 'Email Support', content: 'For technical issues or account inquiries: support@gawahelper.com', color: 'blue' },
    { title: 'Social Media', content: 'Follow us on Facebook: GawaHelper Official for updates and community news.', color: 'indigo' },
    { title: 'Office Location', content: 'Visit us at the University of Cebu Lapu-Lapu And Mandaue Campus, 2nd Floor.', color: 'orange' },
    { title: 'Response Time', content: 'We typically respond to all inquiries within 24-48 hours during business days.', color: 'green' },
  ]

  return (
    <section className="guide-page">
      <button type="button" className="guide-back-btn" onClick={() => navigate(-1)} aria-label="Go back">←</button>
      
      <div className="guide-container">
        <header className="guide-header">
          <h1>Contact Us</h1>
          <p>Have questions or feedback? Reach out to our team through any of these channels.</p>
        </header>

        <div className="guide-list">
          {contactMethods.map((item, idx) => (
            <div key={idx} className="guide-card">
              <div className={`guide-card-dot ${item.color}`} />
              <div className="guide-card-content">
                <h3>{item.title}</h3>
                <p>{item.content}</p>
              </div>
            </div>
          ))}

          <div className="guide-card" style={{ flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div className="guide-card-dot blue" />
                <h3>Send us a Message</h3>
            </div>
            <form className="contact-form-placeholder" onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input type="text" placeholder="Your Name" style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc' }} />
              <input type="email" placeholder="Your Email" style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc' }} />
              <textarea placeholder="Your Message" rows="4" style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', resize: 'none' }}></textarea>
              <button type="button" style={{ padding: '1rem', borderRadius: '10px', border: 'none', background: '#2563eb', color: 'white', fontWeight: '700', cursor: 'pointer' }}>Send Message</button>
            </form>
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

export default ContactPage
