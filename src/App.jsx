import React, { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { api } from './api'
import { useAuth } from './context/AuthContext'
import LandingPage from './pages/LandingPage'
import HomePage from './pages/HomePage'
import MyTasksPage from './pages/MyTasksPage'
import PostTaskPage from './pages/PostTaskPage'
import NotificationsPage from './pages/NotificationsPage'
import MessagesPage from './pages/MessagesPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import TaskDetailsPage from './pages/TaskDetailsPage'
import AdminPage from './pages/AdminPage'
import ReportsPage from './pages/ReportsPage'
import LoginPage from './pages/LoginPage'
import AdminLoginPage from './pages/AdminLoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'

import VerifyEmailPage from './pages/VerifyEmailPage'

import SupportPage from './pages/SupportPage'
import './App.css'
import './responsive.css'

const lastMessageRouteKey = 'gh_last_message_route'

function App() {
  const navigate = useNavigate()
  const location = useLocation()

  const { user, login: loginUser, logout, register: registerUser, updateUser: updateCurrentUser, loading: authLoading } = useAuth()
  const [message, setMessage] = useState('')
  const token = user ? true : false
  const [error, setError] = useState('')
  const [taskPosting, setTaskPosting] = useState(false)
  const [homeSummary, setHomeSummary] = useState(null)
  const [homeLoading, setHomeLoading] = useState(true)
  const [homeError, setHomeError] = useState('')
  const [myTasks, setMyTasks] = useState([])
  const [myTasksLoading, setMyTasksLoading] = useState(true)
  const [myTasksError, setMyTasksError] = useState('')
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false)

  async function loadUnreadNotificationState() {
    if (!token) {
      setHasUnreadNotifications(false)
      return
    }

    try {
      const data = await api.listNotifications()
      const hasUnread = Array.isArray(data) && data.some((item) => Number(item?.IsRead || 0) === 0)
      setHasUnreadNotifications(hasUnread)
    } catch {
      // Keep existing state on transient failures.
    }
  }

  async function loadHomeSummary() {
    setHomeLoading(true)
    setHomeError('')

    try {
      const data = await api.homeSummary()
      setHomeSummary(data)
    } catch (err) {
      setHomeError(err.message)
    } finally {
      setHomeLoading(false)
    }
  }

  async function loadMyTasks() {
    setMyTasksLoading(true)
    setMyTasksError('')

    try {
      const data = await api.myTasks()
      setMyTasks(Array.isArray(data) ? data : [])
    } catch (err) {
      setMyTasksError(err.message)
      setMyTasks([])
    } finally {
      setMyTasksLoading(false)
    }
  }

  async function refreshTaskData() {
    await Promise.all([loadHomeSummary(), loadMyTasks()])
  }

  useEffect(() => {
    if (!token) {
      setMyTasks([])
      setMyTasksLoading(false)
      return
    }

    if (
      location.pathname === '/home' ||
      location.pathname.startsWith('/tasks') ||
      location.pathname === '/notifications' ||
      location.pathname.startsWith('/messages') ||
      location.pathname === '/profile' ||
      location.pathname === '/reports'
    ) {
      loadHomeSummary()
      loadMyTasks()
    }
  }, [location.pathname, token])

  useEffect(() => {
    if (location.pathname.startsWith('/messages/')) {
      localStorage.setItem(lastMessageRouteKey, `${location.pathname}${location.search}`)
    }
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!token || location.pathname !== '/') return

    const lastMessageRoute = localStorage.getItem(lastMessageRouteKey)
    if (lastMessageRoute && lastMessageRoute.startsWith('/messages/')) {
      navigate(lastMessageRoute, { replace: true })
    }
  }, [location.pathname, navigate, token])

  useEffect(() => {
    if (!token) {
      setHasUnreadNotifications(false)
      return
    }

    if (location.pathname === '/notifications') {
      setHasUnreadNotifications(false)
      return
    }

    loadUnreadNotificationState()

    let sseUrl = api.getSseUrl()
    // EventSource doesn't support custom headers, so pass token as query param fallback
    const storedToken = localStorage.getItem('gh_token')
    if (storedToken && storedToken !== 'undefined') {
      sseUrl += `?token=${encodeURIComponent(storedToken)}`
    }
    const eventSource = new EventSource(sseUrl, { withCredentials: true })

    eventSource.addEventListener('notification', (event) => {
      try {
        const data = JSON.parse(event.data)
        window.dispatchEvent(new CustomEvent('gh_sse_notification', { detail: data }))
      } catch (e) {}
      setHasUnreadNotifications(true)
      loadUnreadNotificationState()
    })

    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data)
        window.dispatchEvent(new CustomEvent('gh_sse_message', { detail: data }))
      } catch (e) {}
      if (!location.pathname.startsWith('/messages')) {
        setHasUnreadNotifications(true)
      }
    })

    return () => {
      eventSource.close()
    }
  }, [location.pathname, token])

  // Auto-redirect admin users to /admin dashboard
  useEffect(() => {
    if (!token || !user) {
      return
    }

    const userVal = user.IsAdmin ?? user.isAdmin
    const isAdmin = Number(userVal) === 1 || userVal === true || String(userVal) === '1'
    const isOnAdminPath = location.pathname === '/admin'
    const isOnLoginPath = location.pathname === '/login'

    if (isAdmin && (location.pathname === '/home' || location.pathname === '/')) {
            navigate('/admin', { replace: true })
    }
  }, [user, token, navigate, location.pathname])

  async function postTask(payload) {
    setTaskPosting(true)
    setMessage('')
    setError('')

    try {
      const created = await api.createTask(payload)
      setMessage('Task posted successfully.')
      await refreshTaskData()
      return created
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setTaskPosting(false)
    }
  }

  async function forgotPassword(payload) {
    setMessage('')
    setError('')

    try {
      const email = typeof payload === 'string' ? payload : payload.email
      await api.requestPasswordResetCode(email)
      setMessage('Reset code sent to your email! Redirecting...')
      navigate('/forgot-password', { state: { email } })
      return true
    } catch (err) {
      setError(err.message)
      return false
    }
  }

  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage('')
        setError('')
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [message, error])

  const bannerText = String(error || message || '').trim()
  const showBanner = bannerText.length > 0

  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f5f5f5' }}>
        <div className="loading-spinner"></div>
      </div>
    )
  }

  return (
    <main className="app-shell">
      {showBanner && (
        <div className={`feedback ${error ? 'error' : 'ok'}`}>
          {bannerText}
        </div>
      )}

      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/home"
          element={
            token ? (
              <HomePage
                user={user}
                onLogout={logout}
                summary={homeSummary}
                loading={homeLoading}
                error={homeError}
                myTasks={myTasks}
                hasUnreadNotifications={hasUnreadNotifications}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/tasks"
          element={
            token ? (
              <MyTasksPage
                user={user}
                onLogout={logout}
                summary={homeSummary}
                loading={myTasksLoading}
                error={myTasksError || homeError}
                myTasks={myTasks}
                hasUnreadNotifications={hasUnreadNotifications}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/tasks/new"
          element={
            token ? (
              <PostTaskPage
                user={user}
                onLogout={logout}
                onSubmitTask={postTask}
                posting={taskPosting}
                hasUnreadNotifications={hasUnreadNotifications}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/tasks/:taskId"
          element={
            token ? (
              <MyTasksPage
                user={user}
                onLogout={logout}
                summary={homeSummary}
                loading={myTasksLoading}
                error={myTasksError || homeError}
                myTasks={myTasks}
                hasUnreadNotifications={hasUnreadNotifications}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/task/:taskId"
          element={
            token ? (
              <TaskDetailsPage
                user={user}
                onLogout={logout}
                hasUnreadNotifications={hasUnreadNotifications}
                onTaskUpdated={refreshTaskData}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/notifications"
          element={
            token ? (
              <NotificationsPage
                user={user}
                onLogout={logout}
                summary={homeSummary}
                myTasks={myTasks}
                onNotificationsRead={() => setHasUnreadNotifications(false)}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/messages/:otherUserId/:taskId"
          element={
            token ? (
              <MessagesPage
                user={user}
                onLogout={logout}
                hasUnreadNotifications={hasUnreadNotifications}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/profile"
          element={
            token ? (
              <ProfilePage
                user={user}
                onLogout={logout}
                summary={homeSummary}
                myTasks={myTasks}
                hasUnreadNotifications={hasUnreadNotifications}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/settings"
          element={
            token ? (
              <SettingsPage
                user={user}
                onLogout={logout}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/reports"
          element={
            token ? (
              <ReportsPage
               
                hasUnreadNotifications={hasUnreadNotifications}
               
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/support"
          element={
            token ? (
              <SupportPage />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/admin"
          element={
            token && (Number(user?.IsAdmin) === 1 || user?.IsAdmin === true || String(user?.IsAdmin) === '1') ? (
              <AdminPage />
            ) : token ? (
              <Navigate to="/home" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/admin-login"
          element={
            token && (Number(user?.IsAdmin) === 1 || user?.IsAdmin === true || String(user?.IsAdmin) === '1') ? (
              <Navigate to="/admin" replace />
            ) : (
              <AdminLoginPage />
            )
          }
        />
        <Route
          path="/login"
          element={
            token ? (
              <Navigate to="/home" replace />
            ) : (
              <LoginPage onLogin={loginUser} loading={authLoading} error={error} />
            )
          }
        />
        <Route
          path="/register"
          element={
            token ? (
              <Navigate to="/home" replace />
            ) : (
              <RegisterPage onRegister={registerUser} loading={authLoading} error={error} />
            )
          }
        />
        <Route
          path="/forgot-password"
          element={
            token ? (
              <Navigate to="/home" replace />
            ) : (
              <ForgotPasswordPage onForgotPassword={forgotPassword} />
            )
          }
        />
        <Route
          path="/verify-email"
          element={
            token ? (
              <Navigate to="/home" replace />
            ) : (
              <VerifyEmailPage />
            )
          }
        />

        <Route path="*" element={<Navigate to={token ? '/home' : '/'} replace />} />
      </Routes>
    </main>
  )
}

export default App
