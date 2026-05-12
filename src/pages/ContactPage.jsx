import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

function ContactPage({ hasUnreadNotifications = false }) {
  const { user, logout: onLogout } = useAuth()
  const navigate = useNavigate()

  const contactMethods = [
    { title: 'Email Support', content: 'support@gawahelper.com', color: 'blue' },
    { title: 'Social Media', content: 'Facebook: GawaHelper Official', color: 'indigo' },
    { title: 'Office Location', content: 'University of Cebu Lapu-Lapu And Mandaue Campus, 2nd Floor.', color: 'orange' },
  ]

  return (
    <section className="guide-page">
      <div className="guide-container">
        <header className="guide-modal-header">
          <h1>Contact Us</h1>
          <button type="button" className="guide-close-btn" onClick={() => navigate(-1)}>×</button>
        </header>

        <div className="guide-scroll-area">
          <p className="guide-intro">Reach out to our team through any of these channels for help or feedback.</p>
          
          <div className="guide-list">
            {contactMethods.map((item, idx) => (
              <div key={idx} className={`guide-card ${item.color}`}>
                <div className={`guide-card-dot ${item.color}`} />
                <div className="guide-card-content">
                  <h3>{item.title}</h3>
                  <p>{item.content}</p>
                </div>
              </div>
            ))}

            <div className={`guide-card blue`} style={{ flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div className="guide-card-dot blue" />
                    <h3 style={{ color: '#2563eb' }}>Send Message</h3>
                </div>
                <form className="contact-form-placeholder" onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <input type="text" placeholder="Your Name" style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid #f1f5f9', background: '#f8fafc' }} />
                  <input type="email" placeholder="Your Email" style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid #f1f5f9', background: '#f8fafc' }} />
                  <textarea placeholder="Your Message" rows="3" style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid #f1f5f9', background: '#f8fafc', resize: 'none' }}></textarea>
                  <button type="button" style={{ padding: '0.75rem', borderRadius: '10px', border: 'none', background: '#2563eb', color: 'white', fontWeight: '700', cursor: 'pointer' }}>Send Message</button>
                </form>
            </div>
          </div>

          <div className="guide-tip-card">
            <span><strong>Tip:</strong> Most inquiries are answered within 24 hours. Check your email for our reply.</span>
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
