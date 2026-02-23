import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const API = '/api'
const TOKEN_KEY = 'securemind_token'
const USER_KEY = 'securemind_user'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(() => {
    try {
      const s = localStorage.getItem(USER_KEY)
      return s ? JSON.parse(s) : null
    } catch {
      return null
    }
  })

  const setToken = useCallback((newToken, newUser) => {
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken)
      if (newUser) {
        localStorage.setItem(USER_KEY, JSON.stringify(newUser))
        setUser(newUser)
      }
      setTokenState(newToken)
    } else {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      setTokenState(null)
      setUser(null)
    }
  }, [])

  const login = useCallback(async (emailOrUsername, password) => {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailOrUsername, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Login failed')
    }
    const data = await res.json()
    setToken(data.access_token, {
      id: data.user_id,
      email: data.email,
      username: data.username || null,
    })
    return data
  }, [setToken])

  const register = useCallback(async (email, password, extra = {}) => {
    const res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        username: extra.username || undefined,
        phone: extra.phone || undefined,
        company_name: extra.company_name || undefined,
        company_domain: extra.company_domain || undefined,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Registration failed')
    }
    const data = await res.json()
    setToken(data.access_token, {
      id: data.user_id,
      email: data.email,
      username: data.username || null,
    })
    return data
  }, [setToken])

  const logout = useCallback(() => {
    setToken(null)
  }, [setToken])

  const getAuthHeaders = useCallback(() => {
    const t = localStorage.getItem(TOKEN_KEY)
    return t ? { Authorization: `Bearer ${t}` } : {}
  }, [])

  return (
    <AuthContext.Provider value={{ token, user, login, register, logout, getAuthHeaders, setToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
