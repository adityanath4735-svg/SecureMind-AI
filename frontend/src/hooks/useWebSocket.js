import { useState, useEffect, useCallback } from 'react'

export function useWebSocket() {
  const [ws, setWs] = useState(null)
  const [lastMessage, setLastMessage] = useState(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const port = window.location.port === '5173' ? '8000' : window.location.port
    const url = port ? `${protocol}//${host}:${port}/ws/dashboard` : `${protocol}//${host}/ws/dashboard`
    const socket = new WebSocket(url)

    socket.onopen = () => setConnected(true)
    socket.onclose = () => setConnected(false)
    socket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        setLastMessage(data)
      } catch (_) {}
    }

    setWs(socket)
    return () => socket.close()
  }, [])

  const sendMessage = useCallback((msg) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }, [ws])

  return { lastMessage, sendMessage, connected }
}
