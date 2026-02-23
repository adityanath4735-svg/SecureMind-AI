import { useState, useEffect, useRef } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import './Heatmap.css'

const COLS = 12
const ROWS = 8
const GRAPH_POINTS = 24
const GRAPH_INTERVAL_MS = 1000

export function Heatmap() {
  const [grid, setGrid] = useState(() =>
    Array(ROWS)
      .fill(0)
      .map(() => Array(COLS).fill(0))
  )
  const [graphData, setGraphData] = useState(() =>
    Array.from({ length: GRAPH_POINTS }, (_, i) => ({ t: i, activity: 0, time: '' }))
  )
  const activityCounterRef = useRef(0)
  const graphIndexRef = useRef(0)

  useEffect(() => {
    const interval = setInterval(() => {
      const value = Math.min(100, activityCounterRef.current * 4)
      activityCounterRef.current = 0
      const now = new Date()
      const timeStr = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      setGraphData((prev) => {
        const next = [...prev.slice(1), { t: graphIndexRef.current, activity: value, time: timeStr }]
        graphIndexRef.current += 1
        return next
      })
    }, GRAPH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleMove = (e) => {
      activityCounterRef.current += 1
      setGrid((prev) => {
        const next = prev.map((row) => [...row])
        const col = Math.min(COLS - 1, Math.floor((e.clientX / window.innerWidth) * COLS))
        const row = Math.min(ROWS - 1, Math.floor((e.clientY / window.innerHeight) * ROWS))
        if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
          next[row][col] = Math.min(100, (next[row][col] || 0) + 8)
        }
        return next
      })
    }
    window.addEventListener('mousemove', handleMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMove)
  }, [])

  const maxVal = Math.max(...grid.flat(), 1)

  return (
    <div className="heatmap" role="img" aria-label="Mouse activity concentration heatmap">
      <div
        className="heatmap-grid"
        style={{
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        }}
      >
        {grid.flat().map((v, i) => (
          <div
            key={i}
            className="heatmap-cell"
            style={{
              opacity: 0.35 + 0.65 * (v / maxVal),
              backgroundColor: `rgba(34, 211, 238, ${0.15 + 0.85 * (v / 100)})`,
            }}
          />
        ))}
      </div>
      <p className="heatmap-live-label">Mouse activity concentration (live)</p>
      <div className="heatmap-graph-wrap">
        <p className="heatmap-graph-title">Activity over time</p>
        <ResponsiveContainer width="100%" height={100}>
          <AreaChart data={graphData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="heatmapActivityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(34, 211, 238, 0.5)" stopOpacity={1} />
                <stop offset="100%" stopColor="rgba(34, 211, 238, 0.05)" stopOpacity={1} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" hide />
            <YAxis domain={[0, 100]} hide />
            <Tooltip
              content={({ payload }) =>
                payload?.[0] ? (
                  <span className="heatmap-graph-tooltip">
                    {payload[0].payload.time} — {payload[0].payload.activity.toFixed(0)}%
                  </span>
                ) : null
              }
            />
            <Area type="monotone" dataKey="activity" stroke="rgba(34, 211, 238, 0.9)" strokeWidth={1.5} fill="url(#heatmapActivityGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
