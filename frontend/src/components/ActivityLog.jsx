import './ActivityLog.css'

const LEVEL_CLASS = {
  low: 'level-low',
  medium: 'level-medium',
  high: 'level-high',
  critical: 'level-critical',
}

const IST_OPTIONS = { timeZone: 'Asia/Kolkata', hour12: false }

function formatTimeIST(iso) {
  try {
    const d = new Date(iso)
    const time = d.toLocaleTimeString('en-IN', {
      ...IST_OPTIONS,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    const date = d.toLocaleDateString('en-IN', {
      ...IST_OPTIONS,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    return { date, time: `${time} IST` }
  } catch (_) {
    return { date: '—', time: '—' }
  }
}

export function ActivityLog({ logs }) {
  return (
    <div className="activity-log">
      <ul className="activity-list">
        {logs.length > 0 && (
          <li className="activity-list-header" aria-hidden="true">
            <span className="activity-time-label">Time (IST)</span>
            <span>Activity</span>
            <span>Risk</span>
            <span>Level</span>
          </li>
        )}
        {logs.length === 0 && (
          <li className="activity-item empty">No activity yet. Events will appear in real time.</li>
        )}
        {logs.map((entry) => {
          const { date, time } = formatTimeIST(entry.timestamp)
          return (
            <li
              key={entry.id}
              className={`activity-item ${LEVEL_CLASS[entry.alert_level] || ''}`}
            >
              <span className="activity-time" title={`${date} ${time}`}>
                <span className="activity-time-date">{date}</span>
                <span className="activity-time-clock">{time}</span>
              </span>
              <span className="activity-desc">{entry.description}</span>
              <span className="activity-risk">{entry.risk_impact?.toFixed(1) ?? '—'}</span>
              <span className="activity-level">{entry.alert_level}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
