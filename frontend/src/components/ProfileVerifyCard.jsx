import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import './ProfileVerifyCard.css'

const API = '/api'

export function ProfileVerifyCard() {
  const { token, getAuthHeaders } = useAuth()
  const [profile, setProfile] = useState(null)
  const [emailVerifyResult, setEmailVerifyResult] = useState(null)
  const [companyVerifyResult, setCompanyVerifyResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [verifyEmailLoading, setVerifyEmailLoading] = useState(false)
  const [verifyCompanyLoading, setVerifyCompanyLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchProfile = useCallback(async () => {
    if (!token) {
      setProfile(null)
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/me`, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
      } else {
        setProfile(null)
        setError('Session expired or invalid. Please sign in again.')
      }
    } catch (_) {
      setProfile(null)
      setError('Could not load profile.')
    } finally {
      setLoading(false)
    }
  }, [token, getAuthHeaders])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const handleVerifyEmail = async () => {
    setVerifyEmailLoading(true)
    setEmailVerifyResult(null)
    try {
      const res = await fetch(`${API}/verify/email`, { method: 'POST', headers: getAuthHeaders() })
      const data = await res.json()
      setEmailVerifyResult(data)
      if (res.ok && data.verified) {
        setProfile((p) => (p ? { ...p, email_verified: true } : null))
      }
    } catch (_) {
      setEmailVerifyResult({ verified: false, message: 'Request failed' })
    } finally {
      setVerifyEmailLoading(false)
    }
  }

  const handleVerifyCompany = async () => {
    setVerifyCompanyLoading(true)
    setCompanyVerifyResult(null)
    try {
      const res = await fetch(`${API}/verify/company`, { method: 'POST', headers: getAuthHeaders() })
      const data = await res.json()
      setCompanyVerifyResult(data)
    } catch (_) {
      setCompanyVerifyResult({ verified: false, message: 'Request failed' })
    } finally {
      setVerifyCompanyLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="profile-verify-loading">
        <span className="profile-verify-spinner" aria-hidden="true" />
        <p>Loading profile…</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="profile-verify-empty-wrap">
        <p className="profile-verify-empty">
          {error || 'Sign in to view and verify your profile (email, company domain).'}
        </p>
        {!token && (
          <p className="profile-verify-empty-hint">Use the header to sign in or register.</p>
        )}
      </div>
    )
  }

  return (
    <div className="profile-verify-card">
      <h3 className="profile-verify-title">Profile &amp; verification</h3>
      <div className="profile-fields">
        <div className="profile-row">
          <span className="profile-label">Email</span>
          <span className="profile-value">{profile.email}</span>
          {profile.email_verified ? (
            <span className="profile-badge verified">Verified</span>
          ) : (
            <button
              type="button"
              className="profile-btn"
              onClick={handleVerifyEmail}
              disabled={verifyEmailLoading}
            >
              {verifyEmailLoading ? '…' : 'Verify email'}
            </button>
          )}
        </div>
        {emailVerifyResult && !profile.email_verified && (
          <p className={`profile-result ${emailVerifyResult.verified ? 'ok' : 'warn'}`}>
            {emailVerifyResult.message}
          </p>
        )}
        {profile.username && (
          <div className="profile-row">
            <span className="profile-label">Username</span>
            <span className="profile-value">{profile.username}</span>
          </div>
        )}
        {profile.phone && (
          <div className="profile-row">
            <span className="profile-label">Phone</span>
            <span className="profile-value">{profile.phone}</span>
            {profile.phone_verified && <span className="profile-badge verified">Verified</span>}
          </div>
        )}
        {(profile.company_name || profile.company_domain) && (
          <>
            {profile.company_name && (
              <div className="profile-row">
                <span className="profile-label">Company</span>
                <span className="profile-value">{profile.company_name}</span>
              </div>
            )}
            {profile.company_domain && (
              <div className="profile-row">
                <span className="profile-label">Domain</span>
                <span className="profile-value">{profile.company_domain}</span>
                <button
                  type="button"
                  className="profile-btn"
                  onClick={handleVerifyCompany}
                  disabled={verifyCompanyLoading}
                >
                  {verifyCompanyLoading ? '…' : 'Verify domain'}
                </button>
              </div>
            )}
            {companyVerifyResult && (
              <p className={`profile-result ${companyVerifyResult.verified ? 'ok' : 'warn'}`}>
                {companyVerifyResult.message}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
