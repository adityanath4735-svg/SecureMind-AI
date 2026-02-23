import './TrustScore.css'

export function TrustScore({ value, hijackProbability }) {
  const pct = Math.min(100, Math.max(0, value))
  const color = pct >= 70 ? 'var(--accent-green)' : pct >= 40 ? 'var(--accent-amber)' : 'var(--accent-red)'

  return (
    <div className="trust-score">
      <div className="trust-ring">
        <svg viewBox="0 0 36 36">
          <path
            className="trust-bg"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            className="trust-fill"
            stroke={color}
            strokeDasharray={`${pct}, 100`}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <span className="trust-value" style={{ color }}>{Math.round(pct)}</span>
      </div>
      <div className="trust-meta">
        <span className="trust-label">Trust score</span>
        <span className="hijack-p">
          Session hijack risk: <strong>{(hijackProbability * 100).toFixed(0)}%</strong>
        </span>
      </div>
    </div>
  )
}
