import { useState } from 'react'
import './DemoPanel.css'

const API = '/api'

export function DemoPanel({ sessionId }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const simulateLoginAttempt = async () => {
    try {
      await fetch(`${API}/login_attempt?session_id=${encodeURIComponent(sessionId)}&success=false`)
    } catch (_) {}
  }

  return (
    <div className="demo-panel">
      <div className="demo-fields">
        <input
          type="email"
          placeholder="Email (type or paste)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="demo-input"
        />
        <input
          type="password"
          placeholder="Password (paste here to trigger high risk)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="demo-input"
        />
      </div>
      <button type="button" className="demo-btn" onClick={simulateLoginAttempt}>
        Simulate failed login attempt
      </button>
    </div>
  )
}
