import React, { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Attempt to hydrate user from backend via HttpOnly cookie
    api.getCurrentUser()
      .then((data) => {
        if (data && data.user) {
          setUser(data.user)
          // Maintain legacy localStorage item temporarily for SSE stream fallback if needed, but not token
          localStorage.setItem('gh_user', JSON.stringify(data.user))
        }
      })
      .catch((err) => {
        // If unauthorized, clear everything
        setUser(null)
        localStorage.removeItem('gh_user')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const login = async (payload, isAdminRoute = false) => {
    let data
    if (isAdminRoute) {
      data = await api.adminLogin(payload)
      // Store token for Bearer header fallback (cross-domain cookie may be blocked)
      if (data && data.token) {
        localStorage.setItem('gh_token', data.token)
      }
      if (data && data.admin) {
        // Map Admin to user structure
        const mappedUser = {
          UserID: data.admin.AdminID,
          FullName: data.admin.FullName,
          Email: data.admin.Username,
          IsAdmin: 1
        }
        setUser(mappedUser)
        localStorage.setItem('gh_user', JSON.stringify(mappedUser))
      }
      return data
    } else {
      data = await api.login(payload)
      // Store token for Bearer header fallback (cross-domain cookie may be blocked)
      if (data && data.token) {
        localStorage.setItem('gh_token', data.token)
      }
      if (data && data.user) {
        setUser(data.user)
        localStorage.setItem('gh_user', JSON.stringify(data.user))
      }
      return data
    }
  }

  const register = async (payload) => {
    return api.register(payload)
  }

  const logout = async () => {
    try {
      await api.logout()
    } catch (e) {
      console.warn('Logout request failed', e)
    } finally {
      setUser(null)
      localStorage.removeItem('gh_user')
      localStorage.removeItem('gh_token') // clear legacy token if exists
      // SSE token cleanup is tricky without reloading, so a reload might be needed in some flows
      window.location.href = '/login'
    }
  }

  const updateUser = (updates) => {
    setUser((prev) => {
      if (!prev) return prev
      const updated = { ...prev, ...updates }
      localStorage.setItem('gh_user', JSON.stringify(updated))
      return updated
    })
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
