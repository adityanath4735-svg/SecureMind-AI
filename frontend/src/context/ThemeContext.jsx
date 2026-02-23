import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const THEME_KEY = 'securemind_theme'
const ThemeContext = createContext(null)

function getSystemTheme() {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function getStoredTheme() {
  if (typeof window === 'undefined') return 'system'
  return localStorage.getItem(THEME_KEY) || 'system'
}

function resolveTheme(preference) {
  if (preference === 'light' || preference === 'dark') return preference
  return getSystemTheme()
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(() => getStoredTheme())
  const [resolved, setResolved] = useState(() => resolveTheme(getStoredTheme()))

  useEffect(() => {
    const resolvedTheme = resolveTheme(preference)
    setResolved(resolvedTheme)
    document.documentElement.setAttribute('data-theme', resolvedTheme)
  }, [preference])

  useEffect(() => {
    if (preference !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handle = () => setResolved(getSystemTheme())
    mq.addEventListener('change', handle)
    return () => mq.removeEventListener('change', handle)
  }, [preference])

  const setTheme = useCallback((value) => {
    const next = value === 'system' ? 'system' : value === 'light' ? 'light' : 'dark'
    setPreferenceState(next)
    localStorage.setItem(THEME_KEY, next)
  }, [])

  const cycleTheme = useCallback(() => {
    setPreferenceState((p) => {
      const next = p === 'dark' ? 'light' : p === 'light' ? 'system' : 'dark'
      localStorage.setItem(THEME_KEY, next)
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme: resolved, preference, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
