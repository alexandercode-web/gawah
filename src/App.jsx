import React, { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { api } from './api'
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

import SupportPage from './pages/SupportPage'
import './App.css'
import './responsive.css'

const lastMessageRouteKey = 'gh_last_message_route'

function readStoredUser() {
  const raw = localStorage.getItem('gh_user')
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    localStorage.removeItem('gh_user')
    return null
  }
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()

  const [token, setToken] = useState(localStorage.getItem('gh_token') || '')
  const [user, setUser] = useState(() => readStoredUser())
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
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

    const interval = setInterval(() => {
      loadUnreadNotificationState()
    }, 60000)

    return () => clearInterval(interval)
  }, [location.pathname, token])

  // Unified User Initialization & Profile Refresh
  useEffect(() => {
    if (!token) {
      setUser(null)
      return
    }

    async function initAndRefreshUser() {
      try {
                const freshUser = await api.getMe()

        if (freshUser) {
          const userVal = freshUser.IsAdmin ?? freshUser.isAdmin
          const isAdmin = Number(userVal) === 1 || userVal === true || String(userVal) === '1'
          
          setUser(freshUser)
          localStorage.setItem('gh_user', JSON.stringify(freshUser))
        }
      } catch (err) {
        console.error('App: Failed to refresh user profile:', err.message)
        // If we fail to refresh but have a local user, use it as fallback
        const stored = readStoredUser()
        if (stored && !user) setUser(stored)
      }
    }

    initAndRefreshUser()
  }, [token])

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

  async function loginUser(credentials) {
    setAuthLoading(true)
    setMessage('')
    setError('')

    try {
      const response = await api.login(credentials)

      localStorage.setItem('gh_token', response.token)
      localStorage.setItem('gh_user', JSON.stringify(response.user))
      setToken(response.token)
      setUser(response.user)
      setMessage(`Welcome, ${response.user.FullName}`)

      // Note: Redirect will be handled by the auto-redirect useEffect above
      // For regular users, redirect to home or restore route
      const userVal = response.user.IsAdmin ?? response.user.isAdmin
      const isAdmin = Number(userVal) === 1 || userVal === true || String(userVal) === '1'
            
      if (isAdmin) {
                navigate('/admin', { replace: true })
      } else {
                await refreshTaskData()
        const restoreRoute = localStorage.getItem(lastMessageRouteKey)
        if (restoreRoute && restoreRoute.startsWith('/messages/')) {
          localStorage.removeItem(lastMessageRouteKey)
          navigate(restoreRoute, { replace: true })
        } else {
          navigate('/home', { replace: true })
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setAuthLoading(false)
    }
  }

  async function registerUser(payload) {
    setAuthLoading(true)
    setMessage('')
    setError('')

    try {
      await api.register(payload)
      setMessage('Account created successfully. Please sign in.')
      navigate('/login')
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setAuthLoading(false)
    }
  }

  async function forgotPassword(payload) {
    setAuthLoading(true)
    setMessage('')
    setError('')

    try {
      await api.forgotPassword(payload)
      setMessage('Password reset successful. Please sign in with your new password.')
      navigate('/login')
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setAuthLoading(false)
    }
  }

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

  function updateCurrentUser(nextUser) {
    if (!nextUser) return
    setUser(nextUser)
    localStorage.setItem('gh_user', JSON.stringify(nextUser))
  }

  function logout(eventOrOptions = {}) {
    const isDomEvent = Boolean(eventOrOptions && typeof eventOrOptions === 'object' && 'preventDefault' in eventOrOptions)
    const preserveRoute = !isDomEvent && Boolean(eventOrOptions?.preserveRoute)

    // Capture admin status before clearing state
    // Use both state and localStorage as a fallback to ensure accuracy
    const storedUser = readStoredUser()
    const userVal = user?.IsAdmin ?? user?.isAdmin ?? storedUser?.IsAdmin ?? storedUser?.isAdmin
    const isAdmin = Number(userVal) === 1 || userVal === true || String(userVal) === '1'

    localStorage.removeItem('gh_token')
    localStorage.removeItem('gh_user')
    if (!preserveRoute) {
      localStorage.removeItem(lastMessageRouteKey)
    }
    setToken('')
    setUser(null)
    setMyTasks([])
    setMessage('Logged out')

    if (isAdmin) {
      window.location.href = '/admin-login'
    } else {
      navigate('/login')
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

  return (
    <main className="app-shell">
      {showBanner && (
        <div className={`feedback ${error ? 'error' : 'ok'}`}>
          {bannerText}
        </div>
      )}

      <Routes>
        <Route path="/" element={<LandingPage user={user} />} />
        <Route
          path="/home"
          element={
            token ? (
              <HomePage
                user={user}
                summary={homeSummary}
                loading={homeLoading}
                error={homeError}
                myTasks={myTasks}
                onLogout={logout}
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
                summary={homeSummary}
                loading={myTasksLoading}
                error={myTasksError || homeError}
                myTasks={myTasks}
                hasUnreadNotifications={hasUnreadNotifications}
                onLogout={logout}
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
                onSubmitTask={postTask}
                posting={taskPosting}
                hasUnreadNotifications={hasUnreadNotifications}
                onLogout={logout}
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
                summary={homeSummary}
                loading={myTasksLoading}
                error={myTasksError || homeError}
                myTasks={myTasks}
                hasUnreadNotifications={hasUnreadNotifications}
                onLogout={logout}
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
                hasUnreadNotifications={hasUnreadNotifications}
                onLogout={logout}
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
                summary={homeSummary}
                myTasks={myTasks}
                user={user}
                onNotificationsRead={() => setHasUnreadNotifications(false)}
                onLogout={logout}
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
                hasUnreadNotifications={hasUnreadNotifications}
                onLogout={logout}
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
                summary={homeSummary}
                myTasks={myTasks}
                onUserUpdate={updateCurrentUser}
                onLogout={logout}
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
                user={user}
                hasUnreadNotifications={hasUnreadNotifications}
                onLogout={logout}
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
              <AdminPage user={user} onLogout={logout} />
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
              <ForgotPasswordPage />
            )
          }
        />
        <Route path="*" element={<Navigate to={token ? '/home' : '/'} replace />} />
      </Routes>
    </main>
  )
}

export default App
