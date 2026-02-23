import './AdminStats.css'

export function AdminStats({ stats }) {
  const byLevel = stats?.by_alert_level || {}
  const total = stats?.total_events ?? 0
  const sessions = stats?.sessions?.length ?? 0

  return (
    <div className="admin-stats">
      <div className="stat-row">
        <span className="stat-label">Total events</span>
        <span className="stat-value">{total}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Active sessions</span>
        <span className="stat-value">{sessions}</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-row">
        <span className="stat-label level-low">Low risk</span>
        <span className="stat-value">{byLevel.low ?? 0}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label level-medium">Medium</span>
        <span className="stat-value">{byLevel.medium ?? 0}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label level-high">High</span>
        <span className="stat-value">{byLevel.high ?? 0}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label level-critical">Critical</span>
        <span className="stat-value">{byLevel.critical ?? 0}</span>
      </div>
    </div>
  )
}
