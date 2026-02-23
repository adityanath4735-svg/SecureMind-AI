import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import './ProfileVerifyCard.css'

const API = '/api'

export function ProfileVerifyCard() {
  const { getAuthHeaders } = useAuth()
  const [profile, setProfile] = useState(null)
  const [emailVerifyResult, setEmailVerifyResult] = useState(null)
  const [companyVerifyResult, setCompanyVerifyResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [verifyEmailLoading, setVerifyEmailLoading] = useState(false)
  const [verifyCompanyLoading, setVerifyCompanyLoading] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      const res = await fetch(`${API}/me`, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
      }
    }
    fetchProfile()
  }, [getAuthHeaders])

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

  if (!profile) {
    return (
      <p className="profile-verify-empty">Sign in to view and verify your profile (email, company domain).</p>
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
