import { useState, useEffect } from 'react'
import './AlertTray.css'

export function AlertTray({ risk }) {
  const [alerts, setAlerts] = useState([])
  const level = risk?.alert_level || 'low'

  useEffect(() => {
    if (level === 'high' || level === 'critical') {
      setAlerts((prev) => [
        ...prev,
        {
          id: Date.now(),
          level,
          message:
            level === 'critical'
              ? 'Critical risk level — immediate review recommended'
              : 'Elevated risk — unusual behavior detected',
          time: new Date().toISOString(),
        },
      ])
    }
  }, [level])

  const dismiss = (id) => setAlerts((prev) => prev.filter((a) => a.id !== id))

  if (alerts.length === 0) return null

  return (
    <div className="alert-tray">
      {alerts.slice(-5).map((a) => (
        <div
          key={a.id}
          className={`alert-banner alert-${a.level}`}
          role="alert"
        >
          <span className="alert-message">{a.message}</span>
          <button
            type="button"
            className="alert-dismiss"
            onClick={() => dismiss(a.id)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
