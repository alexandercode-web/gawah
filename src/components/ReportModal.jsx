import React, { useState, useEffect } from 'react'
import { api } from '../api'

function ReportModal({ isOpen, onClose, targetUserId, targetUserName }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [animateIn, setAnimateIn] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setAnimateIn(true), 10)
    } else {
      setAnimateIn(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleClose = () => {
    setAnimateIn(false)
    setTimeout(onClose, 300)
  }

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
        handleClose()
        setTimeout(() => {
          setSuccess(false)
          setReason('')
        }, 400)
      }, 2500)
    } catch (err) {
      setError(err.message || 'Failed to submit report. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      className={`report-modal-overlay ${animateIn ? 'active' : ''}`} 
      onClick={handleClose}
    >
      <div 
        className={`report-modal-card ${animateIn ? 'active' : ''}`} 
        onClick={(e) => e.stopPropagation()}
      >
        <header className="report-modal-header">
          <div className="report-header-title">
            <span className="report-icon">🚩</span>
            <div>
              <h2>Report User</h2>
              <p>Reporting: <strong>{targetUserName}</strong></p>
            </div>
          </div>
          <button className="report-close-btn" onClick={handleClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="report-modal-body">
          {success ? (
            <div className="report-success-state">
              <div className="success-checkmark">
                <div className="check-icon">
                  <svg viewBox="0 0 24 24" width="40" height="40" stroke="white" strokeWidth="4" fill="none">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <h3>Thank You</h3>
              <p>Your report has been submitted and will be reviewed by our moderation team to keep GawaHelper safe.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p className="report-guidelines">
                Please provide specific details about why you are reporting this user. This helps our team take appropriate action.
              </p>
              
              {error && (
                <div className="report-error-message">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                  </svg>
                  {error}
                </div>
              )}

              <div className="report-input-group">
                <label htmlFor="reportReason">Describe the issue</label>
                <textarea
                  id="reportReason"
                  placeholder="Tell us what happened..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  minLength={5}
                  disabled={loading}
                  autoFocus
                />
                <span className="char-hint">{reason.length}/500</span>
              </div>

              <div className="report-modal-actions">
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={handleClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-submit" 
                  disabled={loading || reason.trim().length < 5}
                >
                  {loading ? (
                    <span className="loading-spinner"></span>
                  ) : 'Submit Report'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <style>{`
        .report-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(0px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          opacity: 0;
          transition: all 0.3s ease;
          pointer-events: none;
        }
        .report-modal-overlay.active {
          opacity: 1;
          backdrop-filter: blur(8px);
          pointer-events: auto;
        }

        .report-modal-card {
          background: white;
          width: 100%;
          max-width: 480px;
          border-radius: 24px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          overflow: hidden;
          transform: scale(0.9) translateY(20px);
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          opacity: 0;
        }
        .report-modal-card.active {
          transform: scale(1) translateY(0);
          opacity: 1;
        }

        .report-modal-header {
          padding: 24px 32px;
          background: #f8fafc;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .report-header-title {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .report-icon {
          font-size: 24px;
          background: #fee2e2;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
        }
        .report-header-title h2 {
          margin: 0;
          font-size: 1.25rem;
          color: #0f172a;
          font-weight: 700;
        }
        .report-header-title p {
          margin: 2px 0 0;
          font-size: 0.875rem;
          color: #64748b;
        }
        .report-close-btn {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
          transition: all 0.2s;
        }
        .report-close-btn:hover {
          background: #f1f5f9;
          color: #0f172a;
        }

        .report-modal-body {
          padding: 32px;
        }
        .report-guidelines {
          font-size: 0.95rem;
          color: #475569;
          line-height: 1.6;
          margin-bottom: 24px;
        }

        .report-input-group {
          margin-bottom: 24px;
          position: relative;
        }
        .report-input-group label {
          display: block;
          font-size: 0.875rem;
          font-weight: 600;
          color: #334155;
          margin-bottom: 8px;
        }
        .report-input-group textarea {
          width: 100%;
          min-height: 140px;
          padding: 16px;
          background: #f8fafc;
          border: 2px solid #e2e8f0;
          border-radius: 16px;
          font-family: inherit;
          font-size: 1rem;
          color: #1e293b;
          resize: none;
          transition: all 0.2s;
          box-sizing: border-box;
        }
        .report-input-group textarea:focus {
          outline: none;
          background: white;
          border-color: #ef4444;
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1);
        }
        .char-hint {
          position: absolute;
          bottom: -20px;
          right: 0;
          font-size: 0.75rem;
          color: #94a3b8;
        }

        .report-error-message {
          background: #fef2f2;
          color: #b91c1c;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 0.875rem;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #fee2e2;
        }

        .report-modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 32px;
        }
        .report-modal-actions button {
          flex: 1;
          padding: 14px;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-cancel {
          background: white;
          border: 1px solid #e2e8f0;
          color: #64748b;
        }
        .btn-cancel:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #1e293b;
        }
        .btn-submit {
          background: #ef4444;
          border: none;
          color: white;
          box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2);
        }
        .btn-submit:hover:not(:disabled) {
          background: #dc2626;
          transform: translateY(-1px);
          box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.3);
        }
        .btn-submit:active:not(:disabled) {
          transform: translateY(0);
        }
        .btn-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background: #94a3b8;
          box-shadow: none;
        }

        .report-success-state {
          text-align: center;
          padding: 20px 0;
          animation: successPop 0.4s ease-out;
        }
        .success-checkmark {
          width: 80px;
          height: 80px;
          background: #10b981;
          border-radius: 50%;
          margin: 0 auto 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3);
        }
        .report-success-state h3 {
          font-size: 1.5rem;
          color: #0f172a;
          margin-bottom: 12px;
        }
        .report-success-state p {
          color: #64748b;
          line-height: 1.6;
        }

        @keyframes successPop {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          display: inline-block;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default ReportModal
