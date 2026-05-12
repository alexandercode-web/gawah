import React, { useState } from 'react'
import { api } from '../api'

function ReportModal({ isOpen, onClose, targetUserId, targetUserName }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (reason.trim().length < 5) {
      setError('Please provide a more detailed reason (at least 5 characters).')
      return
    }

    setLoading(true)
    setError('')
    try {
      await api.reportUser(targetUserId, reason)
      setSuccess(true)
      setTimeout(() => {
        onClose()
        setSuccess(false)
        setReason('')
      }, 2000)
    } catch (err) {
      setError(err.message || 'Failed to submit report. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-modal-overlay report-modal-overlay" onClick={onClose}>
      <div className="admin-modal report-modal" onClick={(e) => e.stopPropagation()}>
        <header className="admin-modal-header">
          <h2>Report {targetUserName}</h2>
          <button className="admin-modal-close" onClick={onClose}>&times;</button>
        </header>

        {success ? (
          <div className="report-success-body">
            <div className="report-success-icon">✓</div>
            <h3>Report Submitted</h3>
            <p>Thank you for helping keep GawaHelper safe. An administrator will review your report shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="admin-modal-form">
            <p className="report-intro">
              Please describe the issue with this user. Your report will be reviewed by our moderation team.
            </p>
            
            {error && <div className="feedback error">{error}</div>}

            <div className="admin-form-group">
              <label htmlFor="reportReason">Reason for reporting</label>
              <textarea
                id="reportReason"
                placeholder="Example: Unprofessional behavior, didn't complete task, suspicious activity..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                minLength={5}
                disabled={loading}
                autoFocus
              />
            </div>

            <footer className="admin-modal-footer">
              <button 
                type="button" 
                className="admin-btn-secondary" 
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="admin-btn-primary danger" 
                disabled={loading || reason.trim().length < 5}
              >
                {loading ? 'Submitting...' : 'Submit Report'}
              </button>
            </footer>
          </form>
        )}
      </div>

      <style>{`
        .report-modal {
          max-width: 450px;
        }
        .report-intro {
          font-size: 0.9rem;
          color: #64748b;
          margin-bottom: 1.5rem;
          line-height: 1.5;
        }
        .admin-modal-form textarea {
          width: 100%;
          min-height: 120px;
          padding: 0.75rem;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-family: inherit;
          font-size: 0.95rem;
          resize: vertical;
        }
        .admin-modal-form textarea:focus {
          outline: none;
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }
        .admin-btn-primary.danger {
          background: #ef4444;
        }
        .admin-btn-primary.danger:hover {
          background: #dc2626;
        }
        .report-success-body {
          padding: 2rem;
          text-align: center;
        }
        .report-success-icon {
          width: 60px;
          height: 60px;
          background: #10b981;
          color: white;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 2rem;
          margin: 0 auto 1.5rem;
        }
        .report-success-body h3 {
          color: #0f172a;
          margin-bottom: 0.5rem;
        }
        .report-success-body p {
          color: #64748b;
          font-size: 0.95rem;
        }
      `}</style>
    </div>
  )
}

export default ReportModal
