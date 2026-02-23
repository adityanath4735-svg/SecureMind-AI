import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import './LiveGraph.css'

const API = '/api'
function authHeaders() {
  const token = typeof localStorage !== 'undefined' && localStorage.getItem('securemind_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function formatXLabel(iso) {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (_) {
    return ''
  }
}

export function LiveGraph({ sessionId }) {
  const [data, setData] = useState([])
  const maxPoints = 30

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await fetch(`${API}/activity?limit=50`, { headers: authHeaders() })
        if (!res.ok) return
        const logs = await res.json()
        const points = logs
          .filter((l) => l.risk_impact != null)
          .slice(0, maxPoints)
          .reverse()
          .map((l, i) => ({
            time: formatXLabel(l.timestamp) || String(i),
            timeRaw: l.timestamp,
            risk: Number(l.risk_impact),
            level: l.alert_level,
          }))
        setData(points)
      } catch (_) {}
    }
    fetchActivity()
    const t = setInterval(fetchActivity, 2000)
    return () => clearInterval(t)
  }, [sessionId])

  const color = data.length && data[data.length - 1]?.risk > 50 ? 'var(--accent-red)' : 'var(--accent-cyan)'

  return (
    <div className="live-graph-wrap">
      <div className="live-graph" aria-label="Risk score over time">
        <ResponsiveContainer width="100%" height={240} minHeight={200}>
          <AreaChart
            data={data}
            margin={{ top: 12, right: 12, left: 8, bottom: 24 }}
            layout="horizontal"
          >
            <defs>
              <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={{ stroke: 'var(--border)' }}
              interval="preserveStartEnd"
              minTickGap={32}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              width={36}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={{ stroke: 'var(--border)' }}
              tickFormatter={(v) => `${v}`}
            />
            <Tooltip
              content={({ payload }) =>
                payload?.[0] ? (
                  <span className="graph-tooltip">
                    {payload[0].payload.timeRaw
                      ? `${formatXLabel(payload[0].payload.timeRaw)} IST — Risk: ${Number(payload[0].payload.risk).toFixed(1)}`
                      : `Risk: ${Number(payload[0].payload.risk).toFixed(1)}`}
                  </span>
                ) : null
              }
            />
            <Area
              type="monotone"
              dataKey="risk"
              stroke={color}
              strokeWidth={2.5}
              fill="url(#riskGradient)"
              isAnimationActive={true}
              animationDuration={300}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
