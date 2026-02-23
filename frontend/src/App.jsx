import { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext'
import { useTheme } from './context/ThemeContext'
import { useWebSocket, useActivityLog, useStats } from './hooks'
import { initBehaviorTracker } from './lib/behaviorTracker'
import { RiskMeter } from './components/RiskMeter'
import { LiveGraph } from './components/LiveGraph'
import { ActivityLog } from './components/ActivityLog'
import { Heatmap } from './components/Heatmap'
import { AlertTray } from './components/AlertTray'
import { TrustScore } from './components/TrustScore'
import { AdminStats } from './components/AdminStats'
import { DemoPanel } from './components/DemoPanel'
import { ExportButton } from './components/ExportButton'
import { DeviceNetworkPanel } from './components/DeviceNetworkPanel'
import { ProfileVerifyCard } from './components/ProfileVerifyCard'
import { ImageMalwareScanner } from './components/ImageMalwareScanner'
import { LoginPage } from './components/LoginPage'
import { RegisterPage } from './components/RegisterPage'
import './App.css'

const SESSION_ID = (() => {
  const key = 'securemind_session_id'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = 'session_' + Math.random().toString(36).slice(2, 11)
    sessionStorage.setItem(key, id)
  }
  return id
})()

function Dashboard({ risk, setRisk, lastMessage, connected, logs, fetchLogs, stats, isDemoMode }) {
  const { user, logout } = useAuth()
  const { theme, preference, cycleTheme } = useTheme()

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 2000)
    return () => clearInterval(interval)
  }, [fetchLogs])

  useEffect(() => {
    if (!lastMessage) return
    if (lastMessage.type === 'risk_update') {
      setRisk(lastMessage.payload)
    }
  }, [lastMessage, setRisk])

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">◇</span>
          <h1>SecureMind AI</h1>
          <span className="tagline">Behavioral Threat Intelligence — Detect suspicious behavior before an attack</span>
        </div>
        <div className="header-meta">
          <button
            type="button"
            onClick={cycleTheme}
            className="theme-toggle"
            title={`Theme: ${preference === 'system' ? 'Auto' : preference} (click to cycle)`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀' : '☽'}
          </button>
          <span className={`ws-status ${connected ? 'connected' : ''}`}>
            {connected ? '● Live' : '○ Offline'}
          </span>
          {user && (
            <>
              <span className="session-id">{user.username || user.email}</span>
              <button type="button" onClick={logout} className="btn-logout">
                Logout
              </button>
            </>
          )}
          {!user && <span className="session-id">Session: {SESSION_ID.slice(0, 12)}…</span>}
          {isDemoMode && (
            <span className="demo-badge">Demo mode</span>
          )}
        </div>
      </header>

      {isDemoMode && (
        <div className="demo-mode-banner">
          Viewing in demo mode. Sign in to track your session and export data.
        </div>
      )}

      <AlertTray risk={risk} />

      <section className="dashboard-grid dashboard-grid-metrics-top" aria-label="Risk, trust, and activity metrics">
        <div className="card metrics-top-card">
          <h2>Risk Meter</h2>
          <RiskMeter value={risk.risk_score} level={risk.alert_level} />
        </div>
        <div className="card metrics-top-card">
          <h2>User Trust Score</h2>
          <TrustScore value={risk.trust_score} hijackProbability={risk.session_hijack_probability} />
        </div>
        <div className="card metrics-top-card">
          <h2>Interaction Heatmap</h2>
          <Heatmap />
        </div>
      </section>

      <section className="dashboard-grid dashboard-grid-four">
        <div className="card demo-card">
          <h2>Demo — Trigger signals</h2>
          <DemoPanel sessionId={SESSION_ID} />
        </div>
        <div className="card device-network-card">
          <h2>Device &amp; Network</h2>
          <DeviceNetworkPanel />
        </div>
        <div className="card graph-card">
          <h2>Risk Over Time</h2>
          <LiveGraph sessionId={SESSION_ID} />
        </div>
        <div className="card admin-card admin-card-standalone">
          <h2>Security Analytics</h2>
          <AdminStats stats={stats} />
          <div className="export-row">
            <ExportButton />
          </div>
        </div>
      </section>

      <section className="dashboard-grid dashboard-grid-two">
        <div className="card profile-verify-card-wrap">
          <h2>Profile &amp; verification</h2>
          <ProfileVerifyCard />
        </div>
        <div className="card image-scan-card">
          <h2>Image malware checker</h2>
          <ImageMalwareScanner />
        </div>
      </section>

      <section className="logs-section">
        <div className="card logs-card">
          <h2>Suspicious Activity Log</h2>
          <ActivityLog logs={logs} />
        </div>
      </section>
    </div>
  )
}

export default function App() {
  const { token, login, register, setToken } = useAuth()
  const { theme, preference, cycleTheme } = useTheme()
  const [demoMode, setDemoMode] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [authError, setAuthError] = useState('')
  const [risk, setRisk] = useState({
    risk_score: 0,
    alert_level: 'low',
    trust_score: 100,
    session_hijack_probability: 0,
    requires_reauth: false,
  })
  const { lastMessage, connected } = useWebSocket()
  const { logs, fetchLogs } = useActivityLog()
  const stats = useStats()

  useEffect(() => {
    if (token || demoMode) {
      initBehaviorTracker({ trackTyping: true, trackMouse: true, trackPaste: true, trackTabs: true })
    }
  }, [token, demoMode])

  useEffect(() => {
    if (lastMessage?.type === 'risk_update' && lastMessage.payload?.requires_reauth) {
      setToken(null)
      setAuthError('Session locked due to high risk. Please sign in again.')
    }
  }, [lastMessage, setToken])

  if (!token && !demoMode) {
    return (
      <>
        <button
          type="button"
          onClick={cycleTheme}
          className="theme-toggle theme-toggle-fixed"
          title={`Theme: ${preference === 'system' ? 'Auto' : preference}`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀' : '☽'}
        </button>
        {showRegister ? (
          <RegisterPage
            onRegister={register}
            onSwitchToLogin={() => { setShowRegister(false); setAuthError('') }}
            error={authError}
            clearError={() => setAuthError('')}
          />
        ) : (
          <LoginPage
            onLogin={login}
            onSwitchToRegister={() => { setShowRegister(true); setAuthError('') }}
            onDemoMode={() => setDemoMode(true)}
            error={authError}
            clearError={() => setAuthError('')}
          />
        )}
      </>
    )
  }

  return (
    <Dashboard
      risk={risk}
      setRisk={setRisk}
      lastMessage={lastMessage}
      connected={connected}
      logs={logs}
      fetchLogs={fetchLogs}
      stats={stats}
      isDemoMode={demoMode && !token}
    />
  )
}
