import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

function SupportPage({ hasUnreadNotifications = false }) {
  const { user, logout: onLogout } = useAuth()
  const navigate = useNavigate()

  const faqs = [
    { q: 'How do I post a task?', a: 'Tap the "+" button on the Home screen, fill in the details, and set a budget.' },
    { q: 'How do I get paid?', a: 'Once the task poster approves your work, confirm payment receipt in the task details to complete the transfer.' },
    { q: 'What if there is a dispute?', a: 'Contact our support team through the email below with your Task ID.' },
  ]

  return (
    <section className="page support-page">
      <header className="page-header-minimal">
        <button type="button" className="back-btn" onClick={() => navigate('/profile')}>←</button>
        <h1>Help & Support</h1>
      </header>

      <div className="support-container">
        <div className="support-hero">
          <div className="support-icon">?</div>
          <h2>How can we help?</h2>
          <p>Find answers to common questions or reach out to our team.</p>
        </div>

        <section className="support-section">
          <h3>Frequently Asked Questions</h3>
          <div className="faq-list">
            {faqs.map((faq, i) => (
              <details key={i} className="faq-item">
                <summary>{faq.q}</summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="support-section">
          <h3>Contact Us</h3>
          <div className="contact-card">
            <div className="contact-row">
              <span className="contact-icon">📧</span>
              <div>
                <p className="label">Email Support</p>
                <p className="value">support@gawahelper.com</p>
              </div>
            </div>
            <div className="contact-row">
              <span className="contact-icon">📱</span>
              <div>
                <p className="label">Messenger</p>
                <p className="value">GawaHelper Official</p>
              </div>
            </div>
          </div>
        </section>

        <footer className="support-footer">
          <p>GawaHelper v1.0.0</p>
          <p>Made for Campus Productivity</p>
        </footer>
      </div>
      <Sidebar 
        user={user} 
        onLogout={onLogout} 
        hasUnreadNotifications={hasUnreadNotifications} 
      />
    </section>
  )
}

export default SupportPage
