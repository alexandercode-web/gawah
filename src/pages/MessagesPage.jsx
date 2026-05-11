import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'

function MessagesPage({user, onLogout}) {
  const navigate = useNavigate()
  const { otherUserId, taskId } = useParams()
  const messagesEndRef = useRef(null)
  const imageInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [attachmentType, setAttachmentType] = useState('')
  const [attachmentData, setAttachmentData] = useState('')
  const [attachmentName, setAttachmentName] = useState('')
  const [attachmentMime, setAttachmentMime] = useState('')
  const [attachmentPreview, setAttachmentPreview] = useState('')
  const [attachmentError, setAttachmentError] = useState('')
  const [sending, setSending] = useState(false)
  const [otherUser, setOtherUser] = useState(null)
  const [task, setTask] = useState(null)
  const [activeImage, setActiveImage] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const currentUserId = Number(user?.UserID || 0)
  const taskPosterId = Number(task?.UserID || 0)
  const taskHelperId = Number(task?.HelperID || 0)
  const chatReady = Boolean(taskHelperId)
    && (
      (currentUserId === taskPosterId && Number(otherUserId) === taskHelperId) ||
      (currentUserId === taskHelperId && Number(otherUserId) === taskPosterId)
    )
  const taskStatusText = String(task?.Status || '').toLowerCase()
  const chatClosed = taskStatusText.includes('complete') || taskStatusText.includes('cancel')
  const canCompose = chatReady && !chatClosed
  const currentRole = useMemo(() => {
    if (currentUserId === taskPosterId) return 'Poster'
    if (currentUserId === taskHelperId) return 'Helper'
    return 'Participant'
  }, [currentUserId, taskPosterId, taskHelperId])
  const partnerRole = useMemo(() => {
    if (currentUserId === taskPosterId) return 'Helper'
    if (currentUserId === taskHelperId) return 'Poster'
    return 'Participant'
  }, [currentUserId, taskPosterId, taskHelperId])
  const taskStatusLabel = useMemo(() => {
    if (String(task?.Status || '').toLowerCase().includes('complete')) return 'Completed'
    if (String(task?.Status || '').toLowerCase().includes('review')) return 'Waiting for review'
    if (String(task?.Status || '').toLowerCase().includes('assign') || taskHelperId) return 'In progress'
    return 'Waiting for helper'
  }, [task?.Status, taskHelperId])

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setAccessError('')
    try {
      const [taskData, usersData] = await Promise.all([
        api.getTask(taskId),
        api.listUsers(),
      ])

      const posterId = Number(taskData?.UserID || 0)
      const helperId = Number(taskData?.HelperID || 0)
      const participantMatch = Boolean(helperId)
        && (
          (Number(user?.UserID || 0) === posterId && Number(otherUserId) === helperId) ||
          (Number(user?.UserID || 0) === helperId && Number(otherUserId) === posterId)
        )

      if (!participantMatch) {
        setTask(taskData)
        setOtherUser(usersData.find((u) => u.UserID === Number(otherUserId)) || null)
        setMessages([])
        setAccessError(helperId
          ? 'Chat is only available between the poster and the assigned helper.'
          : 'Chat becomes available after a helper accepts the task.')
        return
      }

      const messagesData = await api.getMessages(otherUserId, taskId)
      setMessages(Array.isArray(messagesData) ? messagesData : [])
      setTask(taskData)

      const foundUser = usersData.find((u) => u.UserID === Number(otherUserId))
      setOtherUser(foundUser)

      if (Array.isArray(messagesData) && messagesData.some(msg => msg.RecipientID === user?.UserID && !msg.IsRead)) {
        api.markTaskMessagesAsRead(taskId).catch(console.error)
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
      const authExpired = String(error?.message || '').toLowerCase().includes('invalid token') || String(error?.message || '').toLowerCase().includes('unauthorized')

      if (authExpired && onLogout) {
        localStorage.setItem('gh_last_message_route', `${window.location.pathname}${window.location.search}`)
        onLogout({ preserveRoute: true })
        return
      }

      setMessages([])
      setAccessError(error.message || 'Unable to load this chat right now.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData(true)
  }, [otherUserId, taskId, user?.UserID])

  async function handleManualRefresh() {
    setRefreshing(true)
    await loadData(false)
  }

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages])

  useEffect(() => {
    if (!taskId) return

    const handleSseMessage = (e) => {
      const msg = e.detail
      if (Number(msg.taskId) === Number(taskId)) {
        loadData(false)
      }
    }

    const handleSseNotification = (e) => {
      const notif = e.detail
      if (Number(notif.taskId) === Number(taskId)) {
        loadData(false)
      }
    }

    window.addEventListener('gh_sse_message', handleSseMessage)
    window.addEventListener('gh_sse_notification', handleSseNotification)
    
    return () => {
      window.removeEventListener('gh_sse_message', handleSseMessage)
      window.removeEventListener('gh_sse_notification', handleSseNotification)
    }
  }, [taskId])

  const getSafeAttachmentUrl = (data) => {
    if (!data) return ''
    if (data.startsWith('data:') || data.startsWith('http')) return data
    
    // It's a filename or path, construct the full URL
    const apiUrl = import.meta.env.VITE_API_URL || '/api'
    const origin = /^https?:\/\//i.test(apiUrl) ? new URL(apiUrl).origin : window.location.origin
    
    if (data.startsWith('/uploads/') || data.startsWith('uploads/')) {
      const path = data.startsWith('/') ? data : `/${data}`
      return `${origin}${path}`
    }
    
    return data.startsWith('/') ? `${origin}${data}` : `${origin}/uploads/proofs/${data}`
  }

  const handleAttachmentClick = (e, msg) => {
    const url = msg.AttachmentData
    if (!url) return

    if (url.startsWith('data:')) {
      e.preventDefault()
      try {
        const parts = url.split(',')
        const mime = parts[0].match(/:(.*?);/)[1]
        const b64Data = parts[1]
        
        const byteCharacters = atob(b64Data)
        const byteArrays = []
        
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512)
          const byteNumbers = new Array(slice.length)
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i)
          }
          const byteArray = new Uint8Array(byteNumbers)
          byteArrays.push(byteArray)
        }
        
        const blob = new Blob(byteArrays, { type: mime })
        const blobUrl = URL.createObjectURL(blob)
        window.open(blobUrl, '_blank')
      } catch (err) {
        console.error('Failed to open base64 attachment:', err)
        window.open(url, '_blank')
      }
    } else {
      // For normal URLs, just let the <a> tag handle it or use window.open
      const safeUrl = getSafeAttachmentUrl(url)
      if (!msg.AttachmentType || msg.AttachmentType === 'image') {
        e.preventDefault()
        setActiveImage({ src: safeUrl, alt: msg.AttachmentName || 'Shared image' })
      }
    }
  }

  function resetAttachment() {
    setAttachmentType('')
    setAttachmentData('')
    setAttachmentName('')
    setAttachmentMime('')
    setAttachmentPreview('')
    setAttachmentError('')
    setLinkUrl('')

    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function compressImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDimension = 1280;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDimension) {
              height *= maxDimension / width;
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width *= maxDimension / height;
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ dataUrl: String(e.target.result), mime: file.type || 'image/jpeg' });
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          
          const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const quality = mime === 'image/png' ? undefined : 0.82;
          resolve({ dataUrl: canvas.toDataURL(mime, quality), mime });
        };
        img.onerror = () => reject(new Error('Failed to load image for compression.'));
        img.src = String(e.target.result);
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Unable to read image file.'))
      reader.readAsDataURL(file)
    })
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0]
    setAttachmentError('')

    if (!file) return

    if (!file.type.startsWith('image/')) {
      setAttachmentError('Please choose an image file.')
      return
    }

    if (file.size > 8 * 1024 * 1024) {
      setAttachmentError('Image must be 8MB or smaller.')
      return
    }

    try {
      setSending(true) // Reuse sending state to show loading
      const { dataUrl, mime } = file.size > 450 * 1024
        ? await compressImageFile(file)
        : { dataUrl: await fileToDataUrl(file), mime: file.type || 'image/jpeg' }

      setAttachmentType('image')
      setAttachmentData(dataUrl)
      setAttachmentName(file.name)
      setAttachmentMime(mime)
      setAttachmentPreview(dataUrl)
      setLinkUrl('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Attachment error:', error)
      setAttachmentError(error.message || 'Unable to load image.')
      alert('Error loading image: ' + (error.message || 'Please try a different image.'))
    } finally {
      setSending(false)
    }
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    setAttachmentError('')

    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      setAttachmentError('File must be 10MB or smaller.')
      return
    }

    try {
      const dataUrl = await fileToDataUrl(file)
      setAttachmentType('file')
      setAttachmentData(dataUrl)
      setAttachmentName(file.name)
      setAttachmentMime(file.type || 'application/octet-stream')
      setAttachmentPreview('')
      setLinkUrl('')
      if (imageInputRef.current) {
        imageInputRef.current.value = ''
      }
    } catch (error) {
      setAttachmentError(error.message || 'Unable to load file.')
    }
  }

  function applyLinkAttachment() {
    const value = linkUrl.trim()
    if (!value) {
      setAttachmentError('Paste a document link first.')
      return
    }

    try {
      const parsed = new URL(value)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Link must start with http or https.')
      }
    } catch {
      setAttachmentError('Enter a valid Google Drive, Dropbox, or other URL.')
      return
    }

    setAttachmentError('')
    setAttachmentType('link')
    setAttachmentData(value)
    setAttachmentName(value)
    setAttachmentMime('text/uri-list')
    setAttachmentPreview('')
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleSendMessage(e) {
    e.preventDefault()
    if (!canCompose) return

    const trimmedMessage = newMessage.trim()
    const canSendAttachment = Boolean(attachmentType && attachmentData)
    const attachmentFallbackText = canSendAttachment
      ? (attachmentType === 'link'
        ? (attachmentName || 'Shared link')
        : attachmentType === 'file'
          ? (attachmentName || 'Shared file')
          : 'Image')
      : ''
    const contentToSend = trimmedMessage || attachmentFallbackText

    if (!trimmedMessage && !canSendAttachment) return

    setSending(true)
    try {
      await api.sendMessage(Number(taskId), Number(otherUserId), {
        content: contentToSend,
        attachmentType: canSendAttachment ? attachmentType : '',
        attachmentData: canSendAttachment ? attachmentData : '',
        attachmentName: canSendAttachment ? attachmentName : '',
        attachmentMime: canSendAttachment ? attachmentMime : '',
      })
      setMessages([
        ...messages,
        {
          MessageID: Date.now(),
          TaskID: Number(taskId),
          SenderID: user?.UserID,
          RecipientID: Number(otherUserId),
          Content: contentToSend,
          AttachmentType: canSendAttachment ? attachmentType : null,
          AttachmentData: canSendAttachment ? attachmentData : null,
          AttachmentName: canSendAttachment ? attachmentName : null,
          AttachmentMime: canSendAttachment ? attachmentMime : null,
          IsRead: 0,
          CreatedAt: new Date().toISOString(),
        },
      ])
      setNewMessage('')
      resetAttachment()
    } catch (error) {
      console.error('Failed to send message:', error)
      alert('Failed to send message: ' + error.message)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <section className="page messages-page">
        <header className="messages-header">
          <button type="button" className="back-btn" onClick={() => navigate(`/task/${taskId}`)} aria-label="Back">
            <svg viewBox="0 0 24 24" role="presentation" focusable="false">
              <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20 12H8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </button>
          <div className="messages-header-info">
            <h1>Messages</h1>
            <p>Restoring your chat...</p>
          </div>
        </header>

        <div className="messages-loading-card">
          <div className="messages-skeleton-line messages-skeleton-title" />
          <div className="messages-skeleton-line" />
          <div className="messages-skeleton-line messages-skeleton-short" />
        </div>

        <nav className="nav-hint" aria-label="Bottom navigation">
          <div className="sidebar-header">
            <span className="sidebar-brand-icon" aria-hidden="true">
              <img src="/gawalogo.png" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
            </span>
            <span className="sidebar-brand">GawaHelper</span>
          </div>
          <button type="button" className="nav-item active" aria-current="page" onClick={() => navigate('/home')}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                <path d="M4 11.5 12 4l8 7.5V20H4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </span>
            <span>Home</span>
          </button>
          <button type="button" className="nav-item" onClick={() => navigate('/tasks')}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                <path d="M5 6h6v6H5z" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M14 7h5M14 12h5M5 17h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <span>My Tasks</span>
          </button>
          {(Number(user?.IsAdmin) === 1 || user?.IsAdmin === true || String(user?.IsAdmin) === '1') && (
            <button type="button" className="nav-item" onClick={() => navigate('/admin')}>
              <span className="nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                  <path d="M5 6h6v6H5z" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M14 7h5M14 12h5M5 17h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <span>Admin Panels</span>
            </button>
          )}
          {(Number(user?.IsAdmin) === 1 || user?.IsAdmin === true || String(user?.IsAdmin) === '1') && (
            <button type="button" className="nav-item" onClick={() => navigate('/reports')}>
              <span className="nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                  <path d="M3 3v18h18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M7 16l4-8 4 4 4-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>Reports</span>
            </button>
          )}
          <button type="button" className="nav-item" onClick={() => navigate('/notifications')}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                <path d="M18 8a6 6 0 0 0-12 0v5l-2 3h16l-2-3z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 19a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <span>Notifications</span>
          </button>
          <button type="button" className="nav-item" onClick={() => navigate('/profile')}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M5 20a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <span>Profile</span>
          </button>

          <button type="button" className="nav-item" onClick={onLogout}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                <path d="M10 7V5a2 2 0 0 1 2-2h6v18h-6a2 2 0 0 1-2-2v-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 12h11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="m6 9 3 3-3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span>Log out</span>
          </button>
        </nav>
      </section>
    )
  }

  if (accessError) {
    return (
      <section className="page messages-page">
        <header className="messages-header">
          <button type="button" className="back-btn" onClick={() => navigate(`/task/${taskId}`)}>
            <svg viewBox="0 0 24 24" role="presentation" focusable="false">
              <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20 12H8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </button>
          <div className="messages-header-info">
            <h1>Messages</h1>
            <p>{task?.Title || 'Task chat'}</p>
          </div>
        </header>

        <div className="feedback error">{accessError}</div>
      </section>
    )
  }

  return (
    <section className="page messages-page">
      <header className="messages-header">
        <button type="button" className="back-btn" onClick={() => navigate(`/task/${taskId}`)} aria-label="Back">
          <svg viewBox="0 0 24 24" role="presentation" focusable="false">
            <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20 12H8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </button>
        <div className="messages-header-info">
          <h1>{otherUser?.FullName || 'User'}</h1>
          <p className="task-title">{task?.Title || 'Task'}</p>
          <div className="messages-header-meta">
            <span className="messages-role-pill">You: {currentRole}</span>
            <span className="messages-role-pill secondary">Chatting with: {partnerRole}</span>
            <span className="messages-status-pill">{taskStatusLabel}</span>
          </div>
        </div>
        <button
          type="button"
          className="messages-refresh-text-btn"
          onClick={handleManualRefresh}
          disabled={refreshing || loading}
        >
          {refreshing ? (
            <>
              <svg viewBox="0 0 24 24" className="spinning" width="14" height="14" style={{ marginRight: '6px' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Refreshing...
            </>
          ) : (
            'Refresh'
          )}
        </button>
      </header>

      <div className="messages-shell">
        <section className="messages-panel" aria-label="Messages">
          {messages.length === 0 ? (
            <div className="no-messages-card">
              <div className="no-messages-icon" aria-hidden="true">💬</div>
              <h2>No messages yet</h2>
              <p>Start the conversation with a clear update, question, or quick confirmation.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const sentByMe = msg.SenderID === user?.UserID
              const attachmentTypeValue = String(msg.AttachmentType || '').toLowerCase()
              const isImageAttachment = attachmentTypeValue === 'image' && msg.AttachmentData
              const isLinkAttachment = attachmentTypeValue === 'link' && msg.AttachmentData
              const isFileAttachment = attachmentTypeValue === 'file' && msg.AttachmentData
              return (
                <article
                  key={msg.MessageID}
                  className={`message ${sentByMe ? 'message-sent' : 'message-received'}`}
                >
                  <div className="message-bubble">
                    {msg.Content && <p>{msg.Content}</p>}
                    {isImageAttachment && (
                      <button
                        type="button"
                        className="message-attachment-link message-image-btn"
                        onClick={(e) => handleAttachmentClick(e, msg)}
                        aria-label="View image"
                      >
                        <img className="message-image" src={getSafeAttachmentUrl(msg.AttachmentData)} alt={msg.AttachmentName || 'Shared image'} />
                      </button>
                    )}
                    {isLinkAttachment && (
                      <a 
                        className="message-link-card" 
                        href={getSafeAttachmentUrl(msg.AttachmentData)} 
                        target="_blank" 
                        rel="noreferrer"
                        onClick={(e) => msg.AttachmentData.startsWith('data:') && handleAttachmentClick(e, msg)}
                      >
                        <span className="message-link-label">Document link</span>
                        <strong>{msg.AttachmentName || msg.AttachmentData}</strong>
                        <span>{msg.AttachmentData.startsWith('data:') ? 'Document File' : msg.AttachmentData}</span>
                      </a>
                    )}
                    {isFileAttachment && (
                      <a
                        className="message-file-card"
                        href={getSafeAttachmentUrl(msg.AttachmentData)}
                        download={msg.AttachmentName || 'attachment'}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => msg.AttachmentData.startsWith('data:') && handleAttachmentClick(e, msg)}
                      >
                        <span className="message-link-label">File</span>
                        <strong>{msg.AttachmentName || 'Attachment file'}</strong>
                        <span>{msg.AttachmentMime || 'Download file'}</span>
                      </a>
                    )}
                    <time className="message-time">
                      {new Date(msg.CreatedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </div>
                </article>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </section>

        <form className="messages-form" onSubmit={handleSendMessage}>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleImageChange}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/csv,application/zip,application/x-rar-compressed,application/x-7z-compressed"
            hidden
            onChange={handleFileChange}
          />
          <div className="messages-attachment-bar">
            <button type="button" className="attachment-btn" onClick={() => imageInputRef.current?.click()} disabled={sending || !canCompose}>
              Upload image
            </button>
            <button type="button" className="attachment-btn" onClick={() => fileInputRef.current?.click()} disabled={sending || !canCompose}>
              Upload file
            </button>
            <button type="button" className={`attachment-btn ${attachmentType === 'link' ? 'active' : ''}`} onClick={applyLinkAttachment} disabled={sending || !canCompose}>
              Share link
            </button>
            {(attachmentType || linkUrl) && (
              <button type="button" className="attachment-btn ghost" onClick={resetAttachment} disabled={sending}>
                Clear
              </button>
            )}
          </div>
          <div className="messages-link-input-row">
            <input
              type="url"
              className="message-link-input"
              placeholder="Paste a Google Drive, Dropbox, or other document URL"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              disabled={sending || !canCompose}
            />
            <button type="button" className="attachment-btn apply-link-btn" onClick={applyLinkAttachment} disabled={sending || !canCompose}>
              Attach
            </button>
          </div>
          {attachmentPreview && (
            <div className="message-attachment-preview image-preview">
              <img src={attachmentPreview} alt={attachmentName || 'Image preview'} />
              <div>
                <strong>{attachmentName || 'Selected image'}</strong>
                <p>Ready to send with your message.</p>
              </div>
            </div>
          )}
          {attachmentType === 'link' && attachmentData && (
            <div className="message-attachment-preview link-preview">
              <div>
                <strong>{attachmentName || 'Document link ready'}</strong>
                <p>{attachmentData}</p>
              </div>
            </div>
          )}
          {attachmentType === 'file' && attachmentData && (
            <div className="message-attachment-preview link-preview">
              <div>
                <strong>{attachmentName || 'File ready'}</strong>
                <p>{attachmentMime || 'File attachment'}</p>
              </div>
            </div>
          )}
          {attachmentError && <p className="message-attachment-error">{attachmentError}</p>}
          <div className="messages-composer">
            <input
              type="text"
              className="message-input"
              placeholder={chatClosed ? 'Chat is closed after task completion' : (chatReady ? 'Type a message or add a file/link...' : 'Chat available after acceptance')}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={sending || !canCompose}
            />
            <button type="submit" className="send-btn" disabled={sending || (!newMessage.trim() && !attachmentData) || !canCompose} aria-label="Send message">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false" width="28" height="28">
                <path d="M3 12.1 21 4l-6.2 16.9-3.5-6.5L3 12.1z" fill="currentColor" />
              </svg>
            </button>
          </div>
          <p className="messages-composer-note">{chatClosed ? 'Chat is closed because this task is done.' : 'This chat is linked to the accepted task only.'}</p>
        </form>
      </div>

      {activeImage && (
        <div className="image-lightbox" role="dialog" aria-modal="true" onClick={() => setActiveImage(null)}>
          <button
            type="button"
            className="image-lightbox-close"
            aria-label="Close image preview"
            onClick={() => setActiveImage(null)}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="3" fill="none">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <div className="image-lightbox-body" onClick={(event) => event.stopPropagation()}>
            <img className="image-lightbox-content" src={activeImage.src} alt={activeImage.alt} />
          </div>
        </div>
      )}

      <nav className="nav-hint" aria-label="Bottom navigation">
        <div className="sidebar-header">
          <span className="sidebar-brand-icon" aria-hidden="true">
            <img src="/gawalogo.png" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
          </span>
          <span className="sidebar-brand">GawaHelper</span>
        </div>
        <button type="button" className="nav-item active" aria-current="page" onClick={() => navigate('/home')}>
          <span className="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation" focusable="false">
              <path d="M4 11.5 12 4l8 7.5V20H4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </span>
          <span>Home</span>
        </button>
        <button type="button" className="nav-item" onClick={() => navigate('/tasks')}>
          <span className="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation" focusable="false">
              <path d="M5 6h6v6H5z" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M14 7h5M14 12h5M5 17h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span>My Tasks</span>
        </button>
        {(Number(user?.IsAdmin) === 1 || user?.IsAdmin === true || String(user?.IsAdmin) === '1') && (
          <button type="button" className="nav-item" onClick={() => navigate('/admin')}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                <path d="M5 6h6v6H5z" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M14 7h5M14 12h5M5 17h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <span>Admin Panels</span>
          </button>
        )}
        {(Number(user?.IsAdmin) === 1 || user?.IsAdmin === true || String(user?.IsAdmin) === '1') && (
          <button type="button" className="nav-item" onClick={() => navigate('/reports')}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                <path d="M3 3v18h18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M7 16l4-8 4 4 4-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span>Reports</span>
          </button>
        )}
        <button type="button" className="nav-item" onClick={() => navigate('/notifications')}>
          <span className="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation" focusable="false">
              <path d="M18 8a6 6 0 0 0-12 0v5l-2 3h16l-2-3z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 19a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span>Notifications</span>
        </button>
        <button type="button" className="nav-item" onClick={() => navigate('/profile')}>
          <span className="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation" focusable="false">
              <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M5 20a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span>Profile</span>
        </button>

        <button type="button" className="nav-item" onClick={onLogout}>
          <span className="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation" focusable="false">
              <path d="M10 7V5a2 2 0 0 1 2-2h6v18h-6a2 2 0 0 1-2-2v-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 12h11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="m6 9 3 3-3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>Log out</span>
        </button>
      </nav>
    </section>
  )
}

export default MessagesPage
