import { useState, useEffect, useCallback } from 'react'
import { getDeviceFingerprint } from '../lib/behaviorTracker'
import './DeviceNetworkPanel.css'

const API = '/api'

const STATUS = {
  idle: '—',
  checking: 'Checking…',
  granted: 'Granted',
  denied: 'Denied',
  unsupported: 'Unsupported',
  error: 'Error',
  unavailable: 'Unavailable',
}

export function DeviceNetworkPanel() {
  const [ip, setIp] = useState('—')
  const [deviceId, setDeviceId] = useState('—')
  const [cameraStatus, setCameraStatus] = useState(STATUS.idle)
  const [micStatus, setMicStatus] = useState(STATUS.idle)
  const [location, setLocation] = useState(null)
  const [locationError, setLocationError] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchContext = useCallback(async () => {
    try {
      const res = await fetch(`${API}/context`)
      if (res.ok) {
        const data = await res.json()
        setIp(data.ip || '—')
      }
    } catch (_) {
      setIp(STATUS.unavailable)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchContext()
    try {
      const fp = getDeviceFingerprint()
      setDeviceId(fp || '—')
    } catch (_) {
      setDeviceId(STATUS.unavailable)
    }
  }, [fetchContext])

  const checkCamera = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraStatus(STATUS.unsupported)
      return
    }
    setCameraStatus(STATUS.checking)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach((t) => t.stop())
      setCameraStatus(STATUS.granted)
    } catch (e) {
      setCameraStatus(e?.name === 'NotAllowedError' ? STATUS.denied : STATUS.error)
    }
  }, [])

  const checkMic = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMicStatus(STATUS.unsupported)
      return
    }
    setMicStatus(STATUS.checking)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      setMicStatus(STATUS.granted)
    } catch (e) {
      setMicStatus(e?.name === 'NotAllowedError' ? STATUS.denied : STATUS.error)
    }
  }, [])

  const checkLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError('Geolocation not supported')
      return
    }
    setLocation(null)
    setLocationError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude.toFixed(5),
          lng: pos.coords.longitude.toFixed(5),
          accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null,
        })
      },
      (err) => {
        setLocationError(err.code === 1 ? 'Permission denied' : err.message || 'Unavailable')
      },
      { timeout: 10000, maximumAge: 60000 }
    )
  }, [])

  return (
    <div className="device-network-panel">
      <h3 className="panel-title">Device &amp; Network</h3>

      <div className="dn-row">
        <span className="dn-label">IP Address</span>
        <span className="dn-value dn-value-ip">
          {loading ? '…' : ip}
        </span>
      </div>

      <div className="dn-row">
        <span className="dn-label">Device ID</span>
        <span className="dn-value dn-value-mono" title="Browser fingerprint (hash)">
          {deviceId}
        </span>
      </div>

      <div className="dn-row">
        <span className="dn-label">MAC Address</span>
        <span className="dn-value dn-value-muted" title="Not sent over HTTP; browser cannot read it">
          Not available (browser)
        </span>
      </div>

      <div className="dn-divider" />

      <div className="dn-row dn-row-media">
        <span className="dn-label">Camera</span>
        <span className={`dn-value dn-status dn-status-${cameraStatus === STATUS.granted ? 'ok' : cameraStatus === STATUS.denied ? 'denied' : 'neutral'}`}>
          {cameraStatus}
        </span>
        <button type="button" className="dn-btn" onClick={checkCamera} disabled={cameraStatus === STATUS.checking}>
          {cameraStatus === STATUS.checking ? '…' : 'Check'}
        </button>
      </div>

      <div className="dn-row dn-row-media">
        <span className="dn-label">Microphone</span>
        <span className={`dn-value dn-status dn-status-${micStatus === STATUS.granted ? 'ok' : micStatus === STATUS.denied ? 'denied' : 'neutral'}`}>
          {micStatus}
        </span>
        <button type="button" className="dn-btn" onClick={checkMic} disabled={micStatus === STATUS.checking}>
          {micStatus === STATUS.checking ? '…' : 'Check'}
        </button>
      </div>

      <div className="dn-row dn-row-media">
        <span className="dn-label">Location</span>
        <div className="dn-location-wrap">
          {location ? (
            <span className="dn-value dn-value-mono">
              {location.lat}, {location.lng}
              {location.accuracy != null && (
                <span className="dn-accuracy"> ±{location.accuracy}m</span>
              )}
            </span>
          ) : locationError ? (
            <span className="dn-value dn-value-muted">{locationError}</span>
          ) : (
            <span className="dn-value dn-value-muted">—</span>
          )}
          <button type="button" className="dn-btn" onClick={checkLocation}>
            Check
          </button>
        </div>
      </div>
    </div>
  )
}
