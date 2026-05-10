import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import { api } from '../api'

function LandingPage() {
  const [stats, setStats] = useState({
    TotalUsers: 0,
    CompletedTasks: 0,
    TotalValue: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const data = await api.getPublicStats()
        setStats(data)
      } catch (error) {
        console.error('Failed to fetch stats:', error)
        // Fallback to default values on error
        setStats({
          TotalUsers: 0,
          CompletedTasks: 0,
          TotalValue: 0,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const formatCurrency = (value) => {
    if (value >= 1000000) {
      return `₱${(value / 1000000).toFixed(1)}M+`
    }
    if (value >= 1000) {
      return `₱${(value / 1000).toFixed(1)}K+`
    }
    return `₱${value}+`
  }

  return (
    <div className="landing-page-wrapper">
      <nav className="landing-navbar">
        <div className="navbar-container">
          <div className="navbar-brand">
            <span className="brand-dot-nav" />
            <span className="brand-text">GawaHelper</span>
          </div>

          <div className="navbar-links">
            <a href="#features" className="nav-link"><span>01</span> Features</a>
            <a href="#benefits" className="nav-link"><span>02</span> Why Us</a>
          </div>

          <div className="navbar-actions">
            <Link className="btn-auth login-btn" to="/login">Login</Link>
            <Link className="btn-auth register-btn" to="/register">Get Started</Link>
          </div>
        </div>
      </nav>

      <section className="hero-section hero-live-shell">
        <div className="hero-grid-overlay" aria-hidden="true" />

        <div className="hero-left hero-copy-live">
          <div className="hero-chip-row">
            <span className="hero-chip hero-chip-solid">Task Marketplace</span>

          </div>

          <h1 className="hero-title">Manage tasks and campus opportunities up to your pace</h1>
          <p className="hero-subtitle">
            Post a task, match with trusted helpers, and track everything live. GawaHelper keeps your workflow clear from request to payout.
          </p>

          <div className="hero-cta">
            <Link to="/register" className="cta-primary">Get Started Now</Link>

          </div>

          <div className="hero-stats">
            <div className="stat">
              <span className="stat-number">{loading ? '-' : `${stats.TotalUsers}+`}</span>
              <span className="stat-label">active users</span>
            </div>
            <div className="stat">
              <span className="stat-number">{loading ? '-' : `${stats.CompletedTasks}+`}</span>
              <span className="stat-label">completed tasks</span>
            </div>

          </div>
        </div>

        <div className="hero-right hero-live-art" aria-hidden="true">
          <div className="hero-orb" />

          <div className="hero-phone">
            <div className="hero-phone-sparkline">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>




          <div className="hero-floating hero-floating-a" />
          <div className="hero-floating hero-floating-b" />


        </div>
      </section>

      <section id="features" className="features-section">
        <div className="features-head">
          <div className="features-head-left">
            <span className="features-pill">Our Benefits</span>
            <h2>The benefits that set us apart</h2>
          </div>
          <div className="features-head-right">
            <p>
              GawaHelper helps you move faster from posting to payout with trusted matching, transparent
              updates, and flexible progress tracking from anywhere.
            </p>
            <Link to="/register" className="features-head-cta">Get Started</Link>
          </div>
        </div>

        <div className="features-grid">
          <div className="feature-card live-card">
            <span className="feature-index">0.1</span>
            <div className="feature-icon-wrap">
              <div className="feature-icon">∞</div>
            </div>
            <span className="feature-kicker">Relax</span>
            <h3>Easy Task Posting</h3>
            <p>Post tasks in seconds with detailed descriptions, budget, and timeline.</p>
          </div>

          <div className="feature-card live-card">
            <span className="feature-index">0.2</span>
            <div className="feature-icon-wrap">
              <div className="feature-icon">◉</div>
            </div>
            <span className="feature-kicker">Your Rules</span>
            <h3>Smart Matching</h3>
            <p>Find the perfect helper based on ratings, reviews, and expertise.</p>
          </div>

          <div className="feature-card live-card">
            <span className="feature-index">0.3</span>
            <div className="feature-icon-wrap">
              <div className="feature-icon">✦</div>
            </div>
            <span className="feature-kicker">Connected</span>
            <h3>Real-Time Chat</h3>
            <p>Communicate directly with helpers and track progress in real-time.</p>
          </div>

          <div className="feature-card live-card">
            <span className="feature-index">0.4</span>
            <div className="feature-icon-wrap">
              <div className="feature-icon">⬢</div>
            </div>
            <span className="feature-kicker">Protected</span>
            <h3>Secure Payments</h3>
            <p>Safe escrow system protects both parties until work is complete.</p>
          </div>

          <div className="feature-card live-card">
            <span className="feature-index">0.5</span>
            <div className="feature-icon-wrap">
              <div className="feature-icon">★</div>
            </div>
            <span className="feature-kicker">Trusted</span>
            <h3>Ratings & Reviews</h3>
            <p>Build your reputation with transparent ratings and verified reviews.</p>
          </div>

          <div className="feature-card live-card">
            <span className="feature-index">0.6</span>
            <div className="feature-icon-wrap">
              <div className="feature-icon">◌</div>
            </div>
            <span className="feature-kicker">Mobile First</span>
            <h3>Mobile Ready</h3>
            <p>Manage tasks and chat on the go with our responsive platform.</p>
          </div>
        </div>
      </section>

      <section id="team" className="team-section">
        <style>{`
          .team-section {
            background: transparent !important;
            color: #e2e8f0 !important;
            padding: 6rem 2rem !important;
          }
          .team-title {
            color: #ffffff !important;
          }
          .team-name {
            color: #ffffff !important;
          }
          .team-role {
            color: #60a5fa !important;
          }
          .team-subtitle, .team-bio {
            color: #94a3b8 !important;
          }
          .team-card {
            background: rgba(255, 255, 255, 0.03) !important;
            border: 1px solid rgba(255, 255, 255, 0.05) !important;
          }
          @media (max-width: 768px) {
            .team-section {
              padding: 3rem 1rem !important;
            }
          }
        `}</style>
        <div className="team-header">
          <div className="team-icon-top">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          </div>
          <h2 className="team-title">Our Team</h2>
          <p className="team-subtitle">
            We are a group of students working together to build GawaHelper, a simple and helpful task platform for everyone.
          </p>
        </div>

        <div className="team-grid">
          {/* Force rebuild 1 */}
          <div className="team-card">
            <div className="team-photo-wrap">
              <img src="/gerunda.png" alt="Marion Gerunda" className="team-photo" />
            </div>
            <span className="team-role">Project Manager</span>
            <h3 className="team-name">Marion Gerunda</h3>
            <p className="team-bio">The Project Manager oversees the entire development of GawaHelper.</p>
            <div className="team-socials">
              <a href="https://www.facebook.com/marion.gerunda.3" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg></a>

            </div>
          </div>

          <div className="team-card">
            <div className="team-photo-wrap">
              <img src="/antigua.png" alt="Louie Jhe Antigua" className="team-photo" />
            </div>
            <span className="team-role">Hustler</span>
            <h3 className="team-name">Louie Jhe Antigua</h3>
            <p className="team-bio">The Hustler handles the business side of GawaHelper. </p>
            <div className="team-socials">
              <a href="https://www.facebook.com/louiejhe.basanezantigua" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg></a>

            </div>
          </div>

          <div className="team-card">
            <div className="team-photo-wrap">
              <img src="/sam.png" alt="Samantha Nicole Cabrillos" className="team-photo" />
            </div>
            <span className="team-role">Hipster</span>
            <h3 className="team-name">Samantha Nicole Cabrillos</h3>
            <p className="team-bio">The Hipster focuses on the design and user experience of GawaHelper.</p>
            <div className="team-socials">
              <a href="https://www.facebook.com/miss.nicx0" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg></a>

            </div>
          </div>

          <div className="team-card">
            <div className="team-photo-wrap">
              <img src="/ducay.png" alt="Alexander Ducay" className="team-photo" />
            </div>
            <span className="team-role">Hacker</span>
            <h3 className="team-name">Alexander Ducay</h3>
            <p className="team-bio">The Hacker is responsible for building the core system of GawaHelper.</p>
            <div className="team-socials">
              <a href="https://www.facebook.com/ducay.alexander" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg></a>

            </div>
          </div>
        </div>
      </section>

      <section id="benefits" className="benefits-section">
        <div className="benefits-content">
          <div className="benefits-left">
            <h2 className="benefits-title">Why Choose GawaHelper?</h2>
            <ul className="benefits-list">
              <li className="benefits-list-item"><span>✓</span>No hidden fees - transparent pricing</li>
              <li className="benefits-list-item"><span>✓</span>Flexible scheduling - work when you want</li>
              <li className="benefits-list-item"><span>✓</span>24/7 customer support</li>
              <li className="benefits-list-item"><span>✓</span>Secure payment system</li>
              <li className="benefits-list-item"><span>✓</span>Build your professional profile</li>
              <li className="benefits-list-item"><span>✓</span>Earn unlimited income</li>
            </ul>
          </div>
          <div className="benefits-right">
            <div className="benefits-logo-shell" aria-hidden="true">
              <span className="benefits-orbit benefits-orbit-a" />
              <span className="benefits-orbit benefits-orbit-b" />
              <img src="/gawahelper-logo.png?v=2" alt="GawaHelper logo" className="benefits-image benefits-image-moving" />
            </div>
          </div>
        </div>
      </section>

      <section className="cta-final-section">
        <h2>Ready to Get Started?</h2>
        <p>Join thousands of users earning money on GawaHelper today</p>
        <div className="cta-buttons">
          <Link to="/register" className="btn-cta-primary">Get Started</Link>
          <Link to="/login" className="btn-cta-secondary">Already a Member? Login</Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-section footer-brand">
            <h4>GawaHelper</h4>
            <p>Empowering the modern workforce with seamless task matching and trusted connections.</p>
            <div className="footer-social-row">
              <a href="#" className="footer-social-icon" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg></a>
              <a href="#" className="footer-social-icon" aria-label="Twitter"><svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" /></svg></a>
              <a href="#" className="footer-social-icon" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg></a>
            </div>
          </div>
          <div className="footer-section">
            <h4>Platform</h4>
            <a href="#features">Features</a>
            <a href="#benefits">Why Us</a>
            <a href="/register">Get Started</a>
          </div>
          <div className="footer-section">
            <h4>Resources</h4>
            <a href="/login">Support</a>
            <a href="/register">Community</a>
            <a href="/login">Helper Guide</a>
          </div>
          <div className="footer-section">
            <h4>Legal</h4>
            <a href="/">Terms of Service</a>
            <a href="/">Privacy Policy</a>
            <a href="/">Contact Us</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 GawaHelper. All rights reserved.</p>
          <p>Made with ❤️ for GawaHelpers</p>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage