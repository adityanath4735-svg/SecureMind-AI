import './RiskMeter.css'

const LEVEL_COLORS = {
  low: 'var(--accent-green)',
  medium: 'var(--accent-amber)',
  high: 'var(--accent-red)',
  critical: '#dc2626',
}

export function RiskMeter({ value, level = 'low' }) {
  const pct = Math.min(100, Math.max(0, value))
  const color = LEVEL_COLORS[level] || LEVEL_COLORS.low

  return (
    <div className="risk-meter">
      <div className="risk-bar-bg">
        <div
          className="risk-bar-fill"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="risk-labels">
        <span className="risk-value risk-value-num" style={{ color }}>{value.toFixed(1)}</span>
        <span className="risk-level">{level.toUpperCase()}</span>
      </div>
    </div>
  )
}
