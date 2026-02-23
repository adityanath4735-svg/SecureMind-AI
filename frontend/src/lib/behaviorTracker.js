/**
 * SecureMind AI – Client-side behavior tracking
 * Batched & throttled for low latency and fast detection.
 */

const API_BASE = '/api'
const SESSION_KEY = 'securemind_session_id'
const TYPING_BATCH_MS = 400
const MOUSE_FLUSH_MS = 1200
const TYPING_MIN_KEYS = 2

let lastKeyTime = 0
const keyIntervals = []
let mousePoints = []
let lastMouseTime = 0
let lastMouseX = 0
let lastMouseY = 0
let typingBatchTimer = null
let pendingTypingPayload = null

function getSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = 'sess_' + Math.random().toString(36).slice(2, 14) + '_' + Date.now()
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

function getAuthHeaders() {
  const token = typeof localStorage !== 'undefined' && localStorage.getItem('securemind_token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

export function getDeviceFingerprint() {
  if (typeof window === 'undefined') return ''
  const parts = [
    navigator.userAgent,
    navigator.language,
    String(screen.width) + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || '',
    navigator.deviceMemory || '',
  ]
  let str = parts.join('|')
  let h = 0
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    h = ((h << 5) - h) + c
    h = h & h
  }
  return Math.abs(h).toString(36) + str.length.toString(36)
}

function sendEvent(eventType, payload = {}) {
  const body = {
    event_type: eventType,
    session_id: getSessionId(),
    user_id: null,
    timestamp: new Date().toISOString(),
    payload: { ...payload, device_fingerprint: getDeviceFingerprint() },
  }
  fetch(`${API_BASE}/events`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  }).catch(() => {})
}

function getWPM(intervals) {
  if (!intervals.length) return 0
  const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length
  if (avgMs <= 0) return 0
  return 60000 / (avgMs * 5)
}

function getStressIndicator(intervals) {
  if (intervals.length < 3) return 0
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length
  const variance = intervals.reduce((s, x) => s + (x - mean) ** 2, 0) / intervals.length
  return Math.sqrt(variance) / (mean || 1)
}

function flushTypingBatch() {
  typingBatchTimer = null
  if (!pendingTypingPayload) return
  sendEvent('typing', pendingTypingPayload)
  pendingTypingPayload = null
}

export function initBehaviorTracker(options = {}) {
  const sessionId = getSessionId()
  const { trackTyping = true, trackMouse = true, trackPaste = true, trackTabs = true } = options

  if (trackTyping) {
    document.addEventListener('keydown', (e) => {
      const now = Date.now()
      const interval = lastKeyTime ? now - lastKeyTime : 0
      if (interval > 0 && interval < 2000) keyIntervals.push(interval)
      lastKeyTime = now
      if (keyIntervals.length > 10) keyIntervals.shift()

      const target = e.target
      const fieldType = target.type === 'password' ? 'password' : target.name === 'email' ? 'email' : 'username'

      if (keyIntervals.length >= TYPING_MIN_KEYS) {
        pendingTypingPayload = {
          keystroke_interval_ms: interval || undefined,
          words_per_minute: getWPM(keyIntervals),
          field_type: fieldType,
          stress_indicator: getStressIndicator(keyIntervals),
        }
        if (!typingBatchTimer) {
          typingBatchTimer = setTimeout(flushTypingBatch, TYPING_BATCH_MS)
        }
      }
    })
  }

  if (trackMouse) {
    document.addEventListener('mousemove', (e) => {
      const now = Date.now()
      const dt = (now - lastMouseTime) / 1000
      let speed = 0
      if (dt > 0 && lastMouseTime) {
        const dx = e.clientX - lastMouseX
        const dy = e.clientY - lastMouseY
        speed = Math.sqrt(dx * dx + dy * dy) / dt
      }
      lastMouseX = e.clientX
      lastMouseY = e.clientY
      lastMouseTime = now
      mousePoints.push(speed)
      if (mousePoints.length > 50) mousePoints.shift()
    })

    const flushMouse = () => {
      if (mousePoints.length >= 5) {
        const avgSpeed = mousePoints.reduce((a, b) => a + b, 0) / mousePoints.length
        sendEvent('mouse', {
          x: lastMouseX,
          y: lastMouseY,
          movement_speed: avgSpeed,
        })
      }
      mousePoints = []
    }
    setInterval(flushMouse, MOUSE_FLUSH_MS)
  }

  if (trackPaste) {
    document.addEventListener('paste', (e) => {
      const target = e.target
      const isPassword = target?.type === 'password'
      sendEvent('copy_paste', {
        pasted_in_password: isPassword,
        field_type: target?.type,
      })
    })
  }

  if (trackTabs) {
    let tabCount = 1
    const visibility = () => {
      if (document.visibilityState === 'visible') {
        sendEvent('tab_change', { tab_count: tabCount })
      }
    }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('blur', () => { tabCount += 1 })
  }

  sendEvent('session', { started: true })
  return sessionId
}
