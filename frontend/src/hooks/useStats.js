import { useState, useEffect } from 'react'

const API = '/api'

function authHeaders() {
  const token = localStorage.getItem('securemind_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function useStats() {
  const [stats, setStats] = useState({ total_events: 0, by_alert_level: {}, sessions: [] })

  useEffect(() => {
    let cancelled = false
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API}/stats`, { headers: authHeaders() })
        if (res.ok && !cancelled) {
          const data = await res.json()
          setStats(data)
        }
      } catch (_) {}
    }
    fetchStats()
    const t = setInterval(fetchStats, 10000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  return stats
}
