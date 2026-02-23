import { useState, useCallback } from 'react'

const API = '/api'

function authHeaders() {
  const token = localStorage.getItem('securemind_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function useActivityLog() {
  const [logs, setLogs] = useState([])

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`${API}/activity?limit=80`, { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        setLogs(data)
      }
    } catch (_) {
      setLogs([])
    }
  }, [])

  return { logs, fetchLogs }
}
