import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import Sidebar from '../components/Sidebar'

function AdminSettingsPage({ hasUnreadNotifications = false }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [settings, setSettings] = useState({
    platform_fee_percentage: '5'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Check if user is admin
  useEffect(() => {
    const userVal = user?.IsAdmin ?? user?.isAdmin
    const isAdmin = Number(userVal) === 1 || userVal === true || String(userVal) === '1'
    if (!isAdmin) {
      navigate('/home')
      return
    }
    loadSettings()
  }, [user, navigate])

  async function loadSettings() {
    try {
      setLoading(true)
      const data = await api.getAdminSettings()
      if (data && Object.keys(data).length > 0) {
        setSettings(data)
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
      setError('Failed to load platform settings.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await api.updateAdminSettings(settings)
      setSuccess('Platform settings updated successfully!')
    } catch (err) {
      setError(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setSettings(prev => ({ ...prev, [name]: value }))
    setSuccess('')
    setError('')
  }

  if (loading) {
    return (
      <div className="admin-dashboard-layout">
        <Sidebar hasUnreadNotifications={hasUnreadNotifications} logoutRedirect="/admin-login" />
        <main className="admin-main-content">
          <div className="admin-loading-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div className="loading-spinner"></div>
            <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading settings...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="admin-dashboard-layout">
      <Sidebar hasUnreadNotifications={hasUnreadNotifications} logoutRedirect="/admin-login" />
      <main className="admin-main-content">
        <header className="admin-header">
          <div className="admin-header-title">
            <h1>Platform Settings</h1>
            <p>Configure global platform behavior and fees</p>
          </div>
        </header>

        <div className="admin-content-grid" style={{ maxWidth: '800px' }}>
          <div className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-title-group">
                <h2>Financial Configuration</h2>
                <p>Manage how fees are calculated across GawaHelper.</p>
              </div>
            </div>
            
            <div className="admin-card-body">
              <form onSubmit={handleSave} className="admin-form-stack">
                <div className="admin-form-group">
                  <label htmlFor="platform_fee_percentage" className="admin-form-label">Platform Fee Percentage</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      id="platform_fee_percentage"
                      type="number"
                      name="platform_fee_percentage"
                      className="admin-form-input"
                      value={settings.platform_fee_percentage}
                      onChange={handleChange}
                      min="0"
                      max="100"
                      step="0.1"
                      required
                      style={{ paddingRight: '3rem' }}
                    />
                    <span style={{ position: 'absolute', right: '1rem', color: '#94a3b8', fontWeight: '600' }}>%</span>
                  </div>
                  <p className="admin-form-help">This percentage is deducted from the total task budget when a payment is confirmed. (Current: {settings.platform_fee_percentage}%)</p>
                </div>

                {error && (
                  <div className="admin-alert admin-alert-error" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>!</span>
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="admin-alert admin-alert-success" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>✓</span>
                    <span>{success}</span>
                  </div>
                )}

                <div className="admin-card-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '2rem', paddingTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="admin-btn-primary" disabled={saving}>
                    {saving ? 'Saving Changes...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="admin-card" style={{ marginTop: '2rem' }}>
            <div className="admin-card-header">
              <div className="admin-card-title-group">
                <h2>Fee Example</h2>
                <p>How the 5% fee works for different budgets.</p>
              </div>
            </div>
            <div className="admin-card-body">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Budget</th>
                    <th>Platform Fee ({settings.platform_fee_percentage}%)</th>
                    <th>Helper Net Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {[100, 500, 1000, 5000].map(amount => {
                    const fee = amount * (Number(settings.platform_fee_percentage) / 100)
                    return (
                      <tr key={amount}>
                        <td>₱{amount.toLocaleString()}</td>
                        <td style={{ color: '#ef4444' }}>-₱{fee.toLocaleString()}</td>
                        <td style={{ color: '#10b981', fontWeight: '600' }}>₱{(amount - fee).toLocaleString()}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default AdminSettingsPage
