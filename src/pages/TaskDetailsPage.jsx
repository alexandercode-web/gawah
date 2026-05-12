import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import Sidebar from '../components/Sidebar'
import ReportModal from '../components/ReportModal'

function getProofImageSrc(proofImage) {
  const raw = String(proofImage || '').trim()
  if (!raw) return ''

  if (raw.startsWith('data:image')) return raw
  if (/^https?:\/\//i.test(raw)) return raw

  const normalized = raw.replace(/\\+/g, '/')

  const apiUrl = import.meta.env.VITE_API_URL || '/api'
  let origin = ''

  if (/^https?:\/\//i.test(apiUrl)) {
    origin = new URL(apiUrl).origin
  } else if (typeof window !== 'undefined') {
    origin = window.location.origin
  }

  if (normalized.startsWith('/')) {
    return `${origin}${encodeURI(normalized)}`
  }

  if (normalized.startsWith('uploads/')) {
    return `${origin}/${encodeURI(normalized)}`
  }

  if (normalized.includes('/')) {
    const cleanedPath = normalized.replace(/^\.\/?/, '')
    return `${origin}/${encodeURI(cleanedPath)}`
  }

  if (/\.(png|jpe?g|gif|webp)$/i.test(normalized)) {
    return `${origin}/uploads/proofs/${encodeURIComponent(normalized)}`
  }

  return ''
}

function getProfileImageSrc(profileImage) {
  const raw = String(profileImage || '').trim()
  if (!raw) return ''

  if (raw.startsWith('data:image')) return raw
  if (/^https?:\/\//i.test(raw)) return raw

  const normalized = raw.replace(/\\+/g, '/')
  const apiUrl = import.meta.env.VITE_API_URL || '/api'
  let origin = ''

  if (/^https?:\/\//i.test(apiUrl)) {
    origin = new URL(apiUrl).origin
  } else if (typeof window !== 'undefined') {
    origin = window.location.origin
  }

  if (normalized.startsWith('/')) {
    return `${origin}${encodeURI(normalized)}`
  }

  return `${origin}/${encodeURI(normalized.replace(/^\.\/?/, ''))}`
}

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase()
}

function formatDisplayTime(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return 'Today'

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatElapsedTime(value, now = Date.now()) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return '0 min'

  const elapsedMinutes = Math.max(0, Math.floor((now - date.getTime()) / 60000))
  const hours = Math.floor(elapsedMinutes / 60)
  const minutes = elapsedMinutes % 60

  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} hr`
  return `${hours} hr ${minutes} min`
}

function statusLabel(status) {
  if (String(status || '').toLowerCase().includes('complete')) return 'Completed'
  if (String(status || '').toLowerCase().includes('review')) return 'Waiting for Review'
  if (String(status || '').toLowerCase().includes('assign')) return 'In Progress'
  if (String(status || '').toLowerCase().includes('cancel')) return 'Cancelled'
  return 'Waiting for helper'
}

function statusTone(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized.includes('complete')) return 'complete'
  if (normalized.includes('review')) return 'review'
  if (normalized.includes('assign') || normalized.includes('progress')) return 'progress'
  if (normalized.includes('cancel')) return 'cancelled'
  return 'waiting'
}

function getTaskDurationMinutes(categoryName) {
  const key = String(categoryName || '').trim().toLowerCase()

  if (key.includes('moving')) return 85
  if (key.includes('delivery')) return 45
  if (key.includes('tutor')) return 75
  if (key.includes('errand')) return 40
  if (key.includes('print')) return 30
  return 50
}

function formatDuration(totalMinutes) {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '0 min'

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} hr`
  return `${hours} hr ${minutes} min`
}

function formatCountdownTime(startTime, durationMinutes, now = Date.now()) {
  const start = startTime ? new Date(startTime).getTime() : null
  if (!start) return formatDuration(durationMinutes)

  const targetMs = start + (durationMinutes * 60000)
  const remainingMs = targetMs - now

  if (remainingMs <= 0) return 'Overdue'

  const totalSeconds = Math.floor(remainingMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function TaskDetailsPage({user, hasUnreadNotifications = false, onLogout, onTaskUpdated}) {
  const navigate = useNavigate()
  const { taskId } = useParams()
  const proofInputRef = useRef(null)
  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [showAcceptConfirm, setShowAcceptConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelCooldown, setCancelCooldown] = useState(0)
  const [cancelling, setCancelling] = useState(false)
  const [showProofModal, setShowProofModal] = useState(false)
  const [proofFile, setProofFile] = useState(null)
  const [proofDataUrl, setProofDataUrl] = useState('')
  const [submittingProof, setSubmittingProof] = useState(false)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [approvingProof, setApprovingProof] = useState(false)
  const [rejectingProof, setRejectingProof] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [confirmingPayment, setConfirmingPayment] = useState(false)
  const [paymentConfirmed, setPaymentConfirmed] = useState(false)
  const [clockTick, setClockTick] = useState(() => Date.now())
  const [activeLightboxImage, setActiveLightboxImage] = useState(null)
  
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportTarget, setReportTarget] = useState({ id: 0, name: '' })

  useEffect(() => {
    let active = true

    async function loadTask() {
      setLoading(true)
      setError('')

      try {
        const data = await api.getTask(taskId)
        if (active) {
          setTask(data)
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Failed to load task')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadTask()

    return () => {
      active = false
    }
  }, [taskId])

  const isOwnTask = useMemo(() => {
    if (!task || !user) return false
    return Number(task.UserID) === Number(user.UserID)
  }, [task, user])

  const isAssignedHelper = useMemo(() => {
    if (!task || !user) return false
    const userVal = user?.IsAdmin ?? user?.isAdmin
    const isAdmin = Number(userVal) === 1 || userVal === true || String(userVal) === '1' || user.role === 'admin'
    const isHelper = Number(task.HelperID) === Number(user.UserID)
    return isHelper || isAdmin
  }, [task, user])

  const isOpenTask = useMemo(() => String(task?.Status || '').toLowerCase() === 'open', [task])
  const formattedBudget = useMemo(() => {
    return Number(task?.Budget || 0).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  }, [task?.Budget])

  const showTaskActions = useMemo(() => {
    return (!isOwnTask && isOpenTask && !isAssignedHelper)
      || (isOwnTask && isOpenTask)
      || isAssignedHelper
  }, [isAssignedHelper, isOpenTask, isOwnTask])

  const canSubmitProof = useMemo(() => {
    const normalized = String(task?.Status || '').toLowerCase()
    const hasProofImage = Boolean(String(task?.ProofImage || '').trim())
    if (!isAssignedHelper) return false
    if (!hasProofImage) return true
    return normalized.includes('assign') || normalized.includes('progress') || normalized === 'open'
  }, [isAssignedHelper, task])

  const canCancelTask = useMemo(() => {
    const normalized = String(task?.Status || '').toLowerCase()
    const hasProofImage = Boolean(String(task?.ProofImage || '').trim())
    return isAssignedHelper && !normalized.includes('complete') && !hasProofImage
  }, [isAssignedHelper, task])

  const canCancelOwnTask = useMemo(() => {
    return isOwnTask && isOpenTask
  }, [isOwnTask, isOpenTask])
  const cancelActionLabel = canCancelOwnTask ? 'Cancel Post' : 'Cancel Task'

  const isCompletedTask = useMemo(() => String(task?.Status || '').toLowerCase().includes('complete'), [task])
  const isCancelledTask = useMemo(() => String(task?.Status || '').toLowerCase().includes('cancel'), [task])
  const isRunningAcceptedTask = useMemo(() => {
    return Boolean(task?.HelperAcceptedAt) && !isCompletedTask && !isCancelledTask
  }, [task?.HelperAcceptedAt, isCompletedTask, isCancelledTask])
  const canMessageTask = useMemo(() => {
    return Boolean(task?.HelperID)
      && !isCancelledTask
      && (isOwnTask || isAssignedHelper)
  }, [task?.HelperID, isCancelledTask, isOwnTask, isAssignedHelper])
  const chatPartnerId = useMemo(() => {
    if (!task) return 0
    return isOwnTask ? Number(task.HelperID || 0) : Number(task.UserID || 0)
  }, [task, isOwnTask])
  const chatButtonLabel = isOwnTask ? 'Message Helper' : 'Message Poster'
  const estimatedTaskDuration = useMemo(
    () => formatDuration(getTaskDurationMinutes(task?.CategoryName)),
    [task?.CategoryName]
  )
  const hasPosterReview = useMemo(() => Number(task?.PosterReviewID || 0) > 0, [task?.PosterReviewID])
  const canRateHelper = useMemo(() => {
    return isOwnTask && isCompletedTask && Number(task?.HelperID || 0) > 0 && !hasPosterReview
  }, [isOwnTask, isCompletedTask, task?.HelperID, hasPosterReview])

  const isWaitingForReview = useMemo(() => String(task?.Status || '').toLowerCase() === 'waitingforreview', [task])
  const isProofApproved = useMemo(() => String(task?.Status || '').toLowerCase() === 'proofapproved', [task])
  const canApproveProof = useMemo(() => {
    return isOwnTask && isWaitingForReview && Boolean(String(task?.ProofImage || '').trim()) && Boolean(task?.HelperID)
  }, [isOwnTask, isWaitingForReview, task?.ProofImage, task?.HelperID])
  const canDeleteProof = useMemo(() => {
    return isAssignedHelper
      && Boolean(String(task?.ProofImage || '').trim())
      && !isProofApproved
      && !isCompletedTask
  }, [isAssignedHelper, isProofApproved, isCompletedTask, task?.ProofImage])

  const submittedProofImageSrc = useMemo(() => getProofImageSrc(task?.ProofImage), [task?.ProofImage])
  const posterProfileImageSrc = useMemo(() => {
    const raw = task?.PosterProfileImage || (isOwnTask ? user?.ProfileImage : '')
    return getProfileImageSrc(raw)
  }, [task?.PosterProfileImage, isOwnTask, user?.ProfileImage])
  const helperProfileImageSrc = useMemo(() => {
    const raw = task?.HelperProfileImage || (isAssignedHelper ? user?.ProfileImage : '')
    return getProfileImageSrc(raw)
  }, [task?.HelperProfileImage, isAssignedHelper, user?.ProfileImage])
  const acceptedAtLabel = useMemo(() => formatDisplayTime(task?.HelperAcceptedAt), [task?.HelperAcceptedAt])
  const runningElapsedLabel = useMemo(
    () => formatElapsedTime(task?.HelperAcceptedAt, clockTick),
    [task?.HelperAcceptedAt, clockTick]
  )
  const runningCountdownLabel = useMemo(() => {
    const duration = getTaskDurationMinutes(task?.CategoryName)
    // Use the later of TaskTime and AcceptedAt as the countdown start
    const acceptedMs = task?.HelperAcceptedAt ? new Date(task.HelperAcceptedAt).getTime() : 0
    const taskTimeMs = task?.TaskTime ? new Date(task.TaskTime).getTime() : 0
    const startRef = new Date(Math.max(acceptedMs, taskTimeMs)).toISOString()
    return formatCountdownTime(startRef, duration, clockTick)
  }, [task?.HelperAcceptedAt, task?.TaskTime, task?.CategoryName, clockTick])

  const posterPaymentConfirmed = useMemo(() => Number(task?.PosterPaymentConfirmed || 0) === 1, [task?.PosterPaymentConfirmed])

  useEffect(() => {
    const completed = String(task?.Status || '').toLowerCase().includes('complete')
    setPaymentConfirmed(completed)
  }, [task?.Status])

  useEffect(() => {
    if (!isRunningAcceptedTask) return undefined

    const timer = window.setInterval(() => {
      setClockTick(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [isRunningAcceptedTask, task?.TaskID])

  useEffect(() => {
    setReviewRating(Number(task?.PosterReviewRating || 0))
    setReviewComment(String(task?.PosterReviewComment || ''))
  }, [task?.PosterReviewRating, task?.PosterReviewComment, task?.TaskID, task?.HelperID, task?.Status, task?.ProofImage])

  function openAcceptConfirm() {
    if (!task) return
    setSuccess('')
    setShowAcceptConfirm(true)
  }

  function closeAcceptConfirm() {
    setShowAcceptConfirm(false)
  }

  async function acceptTask() {
    if (!task) return

    setAccepting(true)
    setError('')
    setSuccess('')

    try {
      await api.applyTask(task.TaskID)
      const refreshed = await api.getTask(task.TaskID)
      setTask(refreshed)
      setShowAcceptConfirm(false)
      setSuccess('Task accepted successfully. It is now in progress.')
      navigate('/tasks?tab=Accepted')
    } catch (err) {
      setError(err.message || 'Unable to accept this task')
    } finally {
      setAccepting(false)
    }
  }

  function openCancelConfirm() {
    if (!canCancelTask && !canCancelOwnTask) {
      setError('This task cannot be cancelled.')
      return
    }
    setCancelReason('')
    setCancelCooldown(0)
    setShowCancelConfirm(true)
  }

  function closeCancelConfirm() {
    if (cancelling) return
    setShowCancelConfirm(false)
    setCancelReason('')
    setCancelCooldown(0)
  }

  useEffect(() => {
    if (!showCancelConfirm || !canCancelTask || !cancelReason || cancelCooldown <= 0) return

    const timer = setInterval(() => {
      setCancelCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [showCancelConfirm, canCancelTask, cancelReason, cancelCooldown])

  async function cancelAcceptedTask() {
    if (!task) return
    // Cancel reason is required for helpers, optional for task posters
    if (canCancelTask && !cancelReason) return

    setCancelling(true)
    setError('')

    try {
      await api.cancelTask(task.TaskID, cancelReason || 'Cancelled by task poster')
      const refreshed = await api.getTask(task.TaskID)
      setTask(refreshed)
      setShowCancelConfirm(false)
      setCancelReason('')
    } catch (err) {
      setError(err.message || 'Unable to cancel task')
    } finally {
      setCancelling(false)
    }
  }

  function openProofModal() {
    setProofFile(null)
    setProofDataUrl('')
    setShowProofModal(true)
  }

  function closeProofModal() {
    if (submittingProof) return
    setShowProofModal(false)
    setProofFile(null)
    setProofDataUrl('')
  }

  function onPickProofFile(event) {
    const picked = event.target.files?.[0]
    if (!picked) return

    const isValidType = picked.type === 'image/jpeg' || picked.type === 'image/png'
    const maxBytes = 10 * 1024 * 1024

    if (!isValidType) {
      setError('Please upload JPG or PNG proof image.')
      event.target.value = ''
      return
    }

    if (picked.size > maxBytes) {
      setError('Image must be 10MB or smaller.')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      setProofDataUrl(result)
      setError('')
      setProofFile(picked)
    }
    reader.onerror = () => {
      setError('Unable to read the selected image. Please try again.')
      event.target.value = ''
      setProofFile(null)
      setProofDataUrl('')
    }
    reader.readAsDataURL(picked)
  }

  async function submitProof() {
    if (!task || !proofFile || !proofDataUrl) return

    setSubmittingProof(true)
    setError('')
    setSuccess('')

    try {
      await api.submitTaskProof(task.TaskID, proofFile.name, proofDataUrl)
      const refreshed = await api.getTask(task.TaskID)
      setTask(refreshed)
      setShowProofModal(false)
      setProofFile(null)
      setProofDataUrl('')
      setSuccess('Proof submitted successfully. Task is now completed.')
    } catch (err) {
      setError(err.message || 'Unable to submit proof right now')
    } finally {
      setSubmittingProof(false)
    }
  }

  async function deleteProof() {
    if (!task) return

    const ok = window.confirm('Delete submitted proof image?')
    if (!ok) return

    setError('')
    setSuccess('')

    try {
      await api.deleteTaskProof(task.TaskID)
      const refreshed = await api.getTask(task.TaskID)
      setTask(refreshed)
      setSuccess('Submitted proof deleted.')
    } catch (err) {
      setError(err.message || 'Unable to delete proof image')
    }
  }

  async function submitHelperRating() {
    if (!task || !canRateHelper || reviewRating < 0.5) return

    setSubmittingReview(true)
    setError('')
    setSuccess('')

    try {
      await api.submitTaskReview(task.TaskID, reviewRating, reviewComment)
      const refreshed = await api.getTask(task.TaskID)
      setTask(refreshed)
      setSuccess('Helper rating submitted successfully.')
      if (typeof onTaskUpdated === 'function') {
        await onTaskUpdated()
      }
    } catch (err) {
      setError(err.message || 'Unable to submit rating right now')
    } finally {
      setSubmittingReview(false)
    }
  }

  async function approveProof() {
    if (!task || !canApproveProof) return

    const ok = window.confirm('Approve the proof and complete this task?')
    if (!ok) return

    setApprovingProof(true)
    setError('')
    setSuccess('')

    try {
      await api.approveTaskProof(task.TaskID)
      const refreshed = await api.getTask(task.TaskID)
      setTask(refreshed)
      setSuccess('Task approved successfully. Payment released to helper.')
    } catch (err) {
      setError(err.message || 'Unable to approve task right now')
    } finally {
      setApprovingProof(false)
    }
  }

  async function rejectProof() {
    if (!task) return

    setRejectingProof(true)
    setError('')
    setSuccess('')
    try {
      await api.rejectTaskProof(task.TaskID, rejectReason.trim())
      setSuccess('Proof rejected. Helper has been notified to resubmit.')
      setShowRejectForm(false)
      setRejectReason('')
      await loadTask()
    } catch (err) {
      setError(err.message || 'Unable to reject proof right now')
    } finally {
      setRejectingProof(false)
    }
  }

  async function confirmPaymentReceived() {
    if (!task || !isAssignedHelper || paymentConfirmed) return

    setConfirmingPayment(true)
    setError('')
    setSuccess('')

    try {
      const paymentResult = await api.confirmPaymentReceived(task.TaskID)
      const refreshed = await api.getTask(task.TaskID)
      const completedStatus = String(paymentResult?.status || '').trim() || 'Completed'
      const nextTask = String(refreshed?.Status || '').toLowerCase().includes('complete')
        ? refreshed
        : { ...refreshed, Status: completedStatus }

      setTask(nextTask)
      setPaymentConfirmed(String(nextTask?.Status || '').toLowerCase().includes('complete'))
      if (typeof onTaskUpdated === 'function') {
        await onTaskUpdated()
      }

      const successMsg = paymentResult?.message || 'Payment confirmed. Task marked as completed.'
      setSuccess(successMsg)

      // Navigate to tasks page after a short delay so they see the success message
      setTimeout(() => {
        navigate('/tasks?tab=Completed')
      }, 1500)
    } catch (err) {
      setError(err.message || 'Unable to confirm payment right now')
    } finally {
      setConfirmingPayment(false)
    }
  }

  async function confirmPaymentSent() {
    if (!task || !isOwnTask || posterPaymentConfirmed) return

    setConfirmingPayment(true)
    setError('')
    setSuccess('')

    try {
      await api.confirmPaymentSent(task.TaskID)
      const refreshed = await api.getTask(task.TaskID)
      setTask(refreshed)
      setSuccess('Payment sent confirmed. Awaiting helper confirmation.')
      if (typeof onTaskUpdated === 'function') {
        await onTaskUpdated()
      }
    } catch (err) {
      setError(err.message || 'Unable to confirm payment right now')
    } finally {
      setConfirmingPayment(false)
    }
  }

  function openImageLightbox(src, alt = 'Image Preview') {
    if (!src) return
    setActiveLightboxImage({ src, alt })
  }

  function closeImageLightbox() {
    setActiveLightboxImage(null)
  }

  function openReportUser(id, name) {
    if (!id || id === user?.UserID) return
    setReportTarget({ id, name })
    setShowReportModal(true)
  }

  return (
    <div className="task-details-page-shell">
      <section className="page task-details-page">

        <header className="task-details-header">
          <button type="button" className="task-details-back" onClick={() => navigate('/tasks')} aria-label="Back">
            ←
          </button>
          <div className="task-details-heading">
            <h1>Task Details</h1>
            <p>Review the task, coordinate with your partner, and complete it confidently.</p>
          </div>
        </header>

        {loading && <p className="loading">Loading task details...</p>}
        {error && <div className="feedback error">{error}</div>}
        {success && <div className="feedback ok">{success}</div>}

        {!loading && task && (
          <>
            <div className={`task-details-status ${statusTone(task.Status)}`}>{statusLabel(task.Status)}</div>

            <article className="task-details-card">
              <h2>{task.Title || 'Untitled Task'}</h2>

              <div className="task-budget-box">
                <span>Task Budget</span>
                <strong>P{formattedBudget}</strong>
              </div>

              <div className="task-details-row">
                <span className="task-row-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                    <path d="M12 22s7-5.4 7-12a7 7 0 1 0-14 0c0 6.6 7 12 7 12z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="10" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </span>
                <div className="task-row-text">
                  <p className="label">Location</p>
                  <p className="value">{task.Location || 'No location'}</p>
                </div>
              </div>

              <div className="task-details-row">
                <span className="task-row-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div className="task-row-text">
                  <p className="label">Task duration</p>
                  <p className={`value ${isRunningAcceptedTask ? 'ticking' : ''}`}>
                    {isRunningAcceptedTask ? runningCountdownLabel : estimatedTaskDuration}
                    {isRunningAcceptedTask && <span className="ticking-badge"><span className="ticking-dot" /> LIVE</span>}
                  </p>
                  {isRunningAcceptedTask && (
                    <p className="label">Started {acceptedAtLabel} ({runningElapsedLabel} elapsed)</p>
                  )}
                </div>
              </div>

              <div className="task-details-row">
                <span className="task-row-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                    <rect x="3" y="6" width="18" height="12" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path d="M3 10h18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <div className="task-row-text">
                  <p className="label">Payment Method</p>
                  <p className="value">{task.PaymentMethod || 'Cash'}</p>
                </div>
              </div>
            </article>

            <article className="task-details-card">
              <h3>Description</h3>
              <p>{task.Description || 'No description provided.'}</p>
            </article>

            {task.ProofImage && (
              <article className="task-details-card">
                <div className="task-proof-header">
                  <h3>Submitted Proof</h3>
                  {canDeleteProof && (
                    <button type="button" className="task-proof-delete-btn" onClick={deleteProof} aria-label="Delete submitted proof">
                      🗑
                    </button>
                  )}
                </div>
                {submittedProofImageSrc ? (
                  <img
                    src={submittedProofImageSrc}
                    alt="Submitted proof"
                    className="task-proof-preview"
                    onClick={() => openImageLightbox(submittedProofImageSrc, 'Submitted Proof')}
                  />
                ) : (
                  <p>{task.ProofImage}</p>
                )}
              </article>
            )}

            <article className="task-details-card">
              <h3>Category</h3>
              <span className="task-category-chip">{task.CategoryName || 'General'}</span>
            </article>

            <article className="task-details-card">
              <h3>Task Poster</h3>
              <div className="task-poster-block">
                <div className="task-poster-avatar" style={{ position: 'relative' }} aria-hidden={posterProfileImageSrc ? 'false' : 'true'}>
                  <span>{getInitials(task.PosterName || user?.FullName || 'User')}</span>
                  {posterProfileImageSrc && (
                    <img 
                      src={posterProfileImageSrc} 
                      alt="" 
                      className="task-party-avatar-image" 
                      style={{ position: 'absolute', inset: 0 }}
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  )}
                </div>
                <div>
                  <p className="task-poster-name">{task.PosterName || user?.FullName || 'User'}</p>
                  <p className="task-poster-rating">
                    {task.PosterRating != null 
                      ? `★ ${Number(task.PosterRating).toFixed(1)} (${task.PosterReviewCount || 0} reviews)`
                      : `★ 5.0 (0 reviews)`}
                  </p>
                </div>
                <button 
                  type="button" 
                  className="task-report-link"
                  onClick={() => openReportUser(task.UserID, task.PosterName)}
                  title="Report this user to admin"
                >
                  🚩 Report
                </button>
              </div>
            </article>

            {(isAssignedHelper || (isOwnTask && Number(task.HelperID || 0) > 0)) && (
              <article className="task-details-card">
                <h3>Helper</h3>
                <div className="task-poster-block">
                  <div className="task-helper-avatar" style={{ position: 'relative' }} aria-hidden={helperProfileImageSrc ? 'false' : 'true'}>
                    <span>{getInitials(task.HelperName || user?.FullName || 'Helper')}</span>
                    {helperProfileImageSrc && (
                      <img 
                        src={helperProfileImageSrc} 
                        alt="" 
                        className="task-party-avatar-image" 
                        style={{ position: 'absolute', inset: 0 }}
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                  </div>
                  <div>
                    <p className="task-poster-name">{task.HelperName || user?.FullName || 'You'}</p>
                    <p className="task-poster-rating">
                      {task.HelperRating != null
                        ? `★ ${Number(task.HelperRating).toFixed(1)} (${task.HelperReviewCount || 0} reviews)`
                        : `★ 5.0 (0 reviews)`}
                    </p>
                  </div>
                  <button 
                    type="button" 
                    className="task-report-link"
                    onClick={() => openReportUser(task.HelperID, task.HelperName)}
                    title="Report this user to admin"
                  >
                    🚩 Report
                  </button>
                </div>
              </article>
            )}

            {canMessageTask && chatPartnerId > 0 && (
              <article className="task-details-card task-message-card">
                <div>
                  <h3>Message</h3>
                  <p>Chat is available because this task has been accepted.</p>
                </div>
                <button
                  type="button"
                  className="task-message-btn"
                  onClick={() => navigate(`/messages/${chatPartnerId}/${task.TaskID}`)}
                >
                  {chatButtonLabel}
                </button>
              </article>
            )}

            {canApproveProof && (
              <article className="task-details-card task-review-proof-card">
                <div className="task-review-proof-header">
                  <div className="task-review-proof-icon">✓</div>
                  <div>
                    <h3>Review Proof</h3>
                    <p>The helper has submitted proof. Review carefully before approving.</p>
                  </div>
                </div>
                <div className="proof-actions">
                  <button
                    type="button"
                    className="task-approve-proof-btn"
                    onClick={approveProof}
                    disabled={approvingProof || rejectingProof}
                  >
                    {approvingProof ? '⏳ Approving...' : '✓ Approve Proof'}
                  </button>
                  <button
                    type="button"
                    className="task-approve-proof-btn"
                    style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', marginTop: '8px' }}
                    onClick={() => setShowRejectForm(!showRejectForm)}
                    disabled={approvingProof || rejectingProof}
                  >
                    ✗ Reject Proof
                  </button>
                </div>
                {showRejectForm && (
                  <div style={{ marginTop: '12px' }}>
                    <textarea
                      placeholder="Optional: tell the helper why you're rejecting the proof..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      maxLength={255}
                      style={{ width: '100%', borderRadius: '8px', padding: '10px', border: '1px solid #d1d5db', fontSize: '14px', resize: 'vertical' }}
                    />
                    <button
                      type="button"
                      className="task-approve-proof-btn"
                      style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', marginTop: '8px' }}
                      onClick={rejectProof}
                      disabled={rejectingProof}
                    >
                      {rejectingProof ? '⏳ Rejecting...' : 'Confirm Rejection'}
                    </button>
                  </div>
                )}
              </article>
            )}

            {isOwnTask && isProofApproved && !posterPaymentConfirmed && (
              <article className="task-details-card task-review-proof-card">
                <div className="task-review-proof-header">
                  <div className="task-review-proof-icon">💳</div>
                  <div>
                    <h3>Send Payment</h3>
                    <p>Proof has been approved. Please send the payment of P{formattedBudget} via {task.PaymentMethod || 'Cash'} and confirm below.</p>
                  </div>
                </div>
                <div className="proof-actions">
                  <button
                    type="button"
                    className="task-approve-proof-btn"
                    onClick={confirmPaymentSent}
                    disabled={confirmingPayment}
                  >
                    {confirmingPayment ? '⏳ Confirming...' : 'Confirm Payment Sent'}
                  </button>
                </div>
              </article>
            )}

            {isOwnTask && isProofApproved && posterPaymentConfirmed && !paymentConfirmed && (
              <article className="task-details-card">
                <h3>Payment Sent</h3>
                <p>Waiting for the helper to confirm they received the payment.</p>
              </article>
            )}

            {isCompletedTask && (
              <article className="task-details-card">
                <h3>Task Completed</h3>
                <div className="task-completed-info">
                  <div className="info-row">
                    <span className="info-label">Status</span>
                    <span className="info-value">✓ Completed</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Amount Paid</span>
                    <span className="info-value task-earnings">P{Number(task.Budget || 0).toFixed(2)}</span>
                  </div>
                </div>
              </article>
            )}

            {isCompletedTask && task.PosterReviewRating && (
              <article className="task-details-card">
                <h3>Poster's Review</h3>
                <div className="task-review-block">
                  <div className="task-review-stars">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const ratingVal = Number(task.PosterReviewRating || 0)
                      const isFull = ratingVal >= star
                      const isHalf = !isFull && ratingVal >= star - 0.5
                      return (
                        <span key={star} className={`star-icon ${isFull ? 'full' : isHalf ? 'half' : 'empty'}`}>
                          ★
                        </span>
                      )
                    })}
                    <span className="star-count">{Number(task.PosterReviewRating || 0).toFixed(1)}</span>
                  </div>
                  {task.PosterReviewComment && (
                    <p className="task-review-comment">{task.PosterReviewComment}</p>
                  )}
                </div>
              </article>
            )}


            {isOwnTask && isCompletedTask && Number(task.HelperID || 0) > 0 && (
              <article className="task-details-card">
                <h3>Rate Helper</h3>
                <p className="task-rate-helper-note">Rate the helper's work quality for this completed task.</p>

                <div className="task-rate-stars" role="radiogroup" aria-label="Rate helper from 0.5 to 5 stars">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFull = reviewRating >= star
                    const isHalf = !isFull && reviewRating >= star - 0.5
                    return (
                      <span key={star} className="task-rate-star-wrapper">
                        <button
                          type="button"
                          className={`task-rate-star-half left ${(isFull || isHalf) ? 'active' : ''}`}
                          onClick={() => setReviewRating(star - 0.5)}
                          disabled={hasPosterReview || submittingReview}
                          aria-label={`${star - 0.5} stars`}
                        />
                        <button
                          type="button"
                          className={`task-rate-star-half right ${isFull ? 'active' : ''}`}
                          onClick={() => setReviewRating(star)}
                          disabled={hasPosterReview || submittingReview}
                          aria-label={`${star} star${star > 1 ? 's' : ''}`}
                        />
                        <span className={`task-rate-star-display ${isFull ? 'full' : isHalf ? 'half' : 'empty'}`} aria-hidden="true">★</span>
                      </span>
                    )
                  })}
                  {reviewRating > 0 && <span className="task-rate-value">{reviewRating.toFixed(1)}</span>}
                </div>

                {hasPosterReview ? (
                  <p className="task-rate-helper-note">You already rated this helper.</p>
                ) : (
                  <>
                    <textarea
                      className="task-rate-comment"
                      value={reviewComment}
                      onChange={(event) => setReviewComment(event.target.value)}
                      placeholder="Optional feedback for the helper"
                      rows={3}
                    />
                    <button
                      type="button"
                      className="task-rate-submit-btn"
                      onClick={submitHelperRating}
                      disabled={!canRateHelper || reviewRating < 0.5 || submittingReview}
                    >
                      {submittingReview ? 'Submitting Rating...' : 'Submit Rating'}
                    </button>
                  </>
                )}
              </article>
            )}

            {showTaskActions && (
              <article className="task-details-card task-actions-card">
                <h3>Actions</h3>

                {!isOwnTask && isOpenTask && !isAssignedHelper && (
                  <button type="button" className="task-accept-btn" onClick={openAcceptConfirm} disabled={accepting}>
                    Accept Task
                  </button>
                )}

                {isOwnTask && isOpenTask && (
                  <button type="button" className="task-cancel-btn" onClick={openCancelConfirm} disabled={cancelling}>
                    {cancelActionLabel}
                  </button>
                )}

                {isAssignedHelper && (
                  <>
                    {canSubmitProof ? (
                      <>
                        <button type="button" className="task-proof-btn" onClick={openProofModal}>
                          Submit Proof
                        </button>
                        <button type="button" className="task-cancel-btn" onClick={openCancelConfirm} disabled={!canCancelTask}>
                          Cancel Task
                        </button>
                      </>
                    ) : isProofApproved ? (
                      <>
                        <div className="task-proof-approved-pill" role="status" aria-live="polite">
                          Proof Approved
                        </div>
                        <p className="task-proof-approved-note">
                          {posterPaymentConfirmed ? 'The poster confirmed sending the payment. Please acknowledge receipt.' : 'Waiting for poster to send payment.'}
                        </p>
                        {!paymentConfirmed && (
                          <button
                            type="button"
                            className="task-payment-btn"
                            onClick={confirmPaymentReceived}
                            disabled={confirmingPayment || !posterPaymentConfirmed}
                          >
                            {confirmingPayment ? 'Confirming...' : (posterPaymentConfirmed ? 'Payment Received' : 'Awaiting Payment')}
                          </button>
                        )}
                        {paymentConfirmed && (
                          <div className="task-completed-badge done">
                            Task Completed
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="task-completed-badge" role="status" aria-live="polite">
                        {String(task?.Status || '').toLowerCase().includes('waiting') ? 'Waiting Approval' : 'Completed'}
                      </div>
                    )}
                  </>
                )}
              </article>
            )}

            {showAcceptConfirm && (
              <div className="accept-modal-overlay" role="presentation" onClick={closeAcceptConfirm}>
                <section
                  className="accept-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="accept-modal-title"
                  onClick={(event) => event.stopPropagation()}
                >
                  <header className="accept-modal-header">
                    <h3 id="accept-modal-title">Accept Task?</h3>
                    <button
                      type="button"
                      className="accept-modal-close"
                      aria-label="Close accept confirmation"
                      onClick={closeAcceptConfirm}
                    >
                      ×
                    </button>
                  </header>

                  <article className="accept-task-summary">
                    <p>You're about to accept:</p>
                    <strong>{task.Title || 'Untitled Task'}</strong>
                    <span>P{formattedBudget}</span>
                  </article>

                  <p className="accept-warning">
                    Make sure you can complete this task on time. Your rating will be affected if you cancel later.
                  </p>

                  <div className="accept-actions">
                    <button type="button" className="accept-cancel-btn" onClick={closeAcceptConfirm} disabled={accepting}>
                      Cancel
                    </button>
                    <button type="button" className="accept-confirm-btn" onClick={acceptTask} disabled={accepting}>
                      {accepting ? 'Accepting...' : 'Accept Task'}
                    </button>
                  </div>
                </section>
              </div>
            )}

            {showCancelConfirm && (
              <div className="accept-modal-overlay" role="presentation" onClick={closeCancelConfirm}>
                <section
                  className="accept-modal cancel-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="cancel-modal-title"
                  onClick={(event) => event.stopPropagation()}
                >
                  <header className="accept-modal-header">
                    <h3 id="cancel-modal-title">{cancelActionLabel}</h3>
                    <button
                      type="button"
                      className="accept-modal-close"
                      aria-label="Close cancel confirmation"
                      onClick={closeCancelConfirm}
                    >
                      ×
                    </button>
                  </header>

                  {canCancelTask && (
                    <div className="cancel-warning-box">
                      <div className="cancel-warning-title">
                        <span className="cancel-warning-icon" aria-hidden="true">⚠</span>
                        <strong>Warning</strong>
                      </div>
                      <p>This will affect your rating and may limit your future opportunities.</p>
                    </div>
                  )}

                  {canCancelTask && (
                    <>
                      <p className="cancel-reason-title">Select a reason (required)</p>
                      <div className="cancel-reason-list">
                        {['Accidentally accepted/posted', 'Emergency', 'Change of mind', 'Schedule conflict', 'Other'].map((reason) => (
                          <button
                            key={reason}
                            type="button"
                            className={`cancel-reason-item ${cancelReason === reason ? 'active' : ''}`}
                            onClick={() => {
                              setCancelReason(reason)
                              setCancelCooldown(3)
                            }}
                          >
                            <span className="cancel-radio" aria-hidden="true" />
                            {reason}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {canCancelTask && cancelReason && cancelCooldown > 0 && (
                    <p className="cancel-cooldown-msg">Please wait {cancelCooldown} seconds before confirming...</p>
                  )}

                  {canCancelOwnTask && (
                    <p className="cancel-reason-title">This will cancel your open task. No one has accepted it yet.</p>
                  )}

                  <div className="accept-actions">
                    <button type="button" className="accept-cancel-btn" onClick={closeCancelConfirm} disabled={cancelling}>
                      Go Back
                    </button>
                    <button
                      type="button"
                      className="accept-confirm-btn disabled-when-empty"
                      onClick={cancelAcceptedTask}
                      disabled={cancelling || (canCancelTask && (!cancelReason || cancelCooldown > 0))}
                    >
                      {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
                    </button>
                  </div>
                </section>
              </div>
            )}

            {showProofModal && (
              <div className="accept-modal-overlay" role="presentation" onClick={closeProofModal}>
                <section
                  className="accept-modal proof-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="proof-modal-title"
                  onClick={(event) => event.stopPropagation()}
                >
                  <header className="accept-modal-header">
                    <h3 id="proof-modal-title">Submit Proof</h3>
                    <button
                      type="button"
                      className="accept-modal-close"
                      aria-label="Close submit proof modal"
                      onClick={closeProofModal}
                    >
                      ×
                    </button>
                  </header>

                  <article className="proof-task-summary">
                    <p>Task:</p>
                    <strong>{task.Title || 'Untitled Task'}</strong>
                  </article>

                  <p className="proof-upload-title">Upload Photo Proof</p>

                  <input
                    ref={proofInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="proof-file-input"
                    onChange={onPickProofFile}
                  />

                  <button
                    type="button"
                    className="proof-upload-zone"
                    onClick={() => proofInputRef.current?.click()}
                  >
                    <span className="proof-upload-icon">↑</span>
                    <span className="proof-upload-main">{proofFile ? proofFile.name : 'Tap to upload photo'}</span>
                    <span className="proof-upload-sub">JPG, PNG up to 10MB</span>
                  </button>

                  <p className="accept-warning">
                    Make sure your photo clearly shows the completed task. This will be reviewed by the poster.
                  </p>

                  <div className="accept-actions">
                    <button type="button" className="accept-cancel-btn" onClick={closeProofModal} disabled={submittingProof}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="accept-confirm-btn disabled-when-empty"
                      onClick={submitProof}
                      disabled={submittingProof || !proofFile || !proofDataUrl}
                    >
                      {submittingProof ? 'Submitting...' : 'Submit Proof'}
                    </button>
                  </div>
                </section>
              </div>
            )}
          </>
        )}

        <Sidebar 
          user={user} 
          onLogout={onLogout} 
          hasUnreadNotifications={hasUnreadNotifications} 
        />
      </section>

      {activeLightboxImage && (
        <div className="image-lightbox" role="dialog" aria-modal="true" onClick={closeImageLightbox}>
          <button
            type="button"
            className="image-lightbox-close"
            aria-label="Close image preview"
            onClick={closeImageLightbox}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="3" fill="none">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <div className="image-lightbox-body" onClick={(event) => event.stopPropagation()}>
            <img
              className="image-lightbox-content"
              src={activeLightboxImage.src}
              alt={activeLightboxImage.alt}
            />
          </div>
        </div>
      )}

      <ReportModal 
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetUserId={reportTarget.id}
        targetUserName={reportTarget.name}
      />

      <style>{`
        .task-report-link {
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-left: auto;
        }
        .task-report-link:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.05);
        }
        .task-poster-block {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
        }
      `}</style>
    </div>
  )
}

export default TaskDetailsPage
