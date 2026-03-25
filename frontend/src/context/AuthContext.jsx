import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [token, setToken]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('auth')
    if (stored) {
      try {
        const { user, accessToken } = JSON.parse(stored)
        setUser(user)
        setToken(accessToken)
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
      } catch { localStorage.removeItem('auth') }
    }
    setLoading(false)
  }, [])

  // Listen for 401 events from the api interceptor
  useEffect(() => {
    const handle = () => { setUser(null); setToken(null); delete api.defaults.headers.common['Authorization'] }
    window.addEventListener('auth:logout', handle)
    return () => window.removeEventListener('auth:logout', handle)
  }, [])

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    setUser(data.user)
    setToken(data.accessToken)
    api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`
    localStorage.setItem('auth', JSON.stringify({ user: data.user, accessToken: data.accessToken }))
    return data
  }, [])

  const register = useCallback(async (email, password, role = 'user') => {
    const { data } = await api.post('/auth/register', { email, password, role })
    setUser(data.user)
    setToken(data.accessToken)
    api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`
    localStorage.setItem('auth', JSON.stringify({ user: data.user, accessToken: data.accessToken }))
    return data
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    delete api.defaults.headers.common['Authorization']
    localStorage.removeItem('auth')
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
