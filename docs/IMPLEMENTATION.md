# SecureMind AI – Implementation Map

This document maps the **architecture layers** (see [ARCHITECTURE.md](ARCHITECTURE.md)) to the actual codebase so you can verify and run the implementation.

---

## 1. Presentation Layer

| Component | Location | Description |
|-----------|----------|-------------|
| React Dashboard | `frontend/src/App.jsx` | Main layout, routing, dashboard grid |
| Risk Meter | `frontend/src/components/RiskMeter.jsx` | Real-time risk score (0–100) |
| Trust Score | `frontend/src/components/TrustScore.jsx` | User trust + session hijack probability |
| Activity Log | `frontend/src/components/ActivityLog.jsx` | Suspicious activity list (IST timestamps) |
| Heatmaps | `frontend/src/components/Heatmap.jsx` | Mouse interaction heatmap |
| Export CSV/PDF | `frontend/src/components/ExportButton.jsx` | Download activity log |
| Alerts UI | `frontend/src/components/AlertTray.jsx` | Risk-level alerts |
| Profile & Verification | `frontend/src/components/ProfileVerifyCard.jsx` | Email/company verification |
| Image Malware Checker | `frontend/src/components/ImageMalwareScanner.jsx` | Upload and scan images |
| Device & Network | `frontend/src/components/DeviceNetworkPanel.jsx` | IP, device ID, camera/mic/location |
| Admin / Analyst views | `frontend/src/components/AdminStats.jsx` | Stats by role (RBAC) |

---

## 2. Behavior Collection Layer

| Component | Location | Description |
|-----------|----------|-------------|
| JS Tracking Engine | `frontend/src/lib/behaviorTracker.js` | Batched/throttled event sending |
| Typing (WPM, intervals) | Same file | `event_type: typing`, payload with intervals |
| Mouse movement | Same file | Mouse events, movement speed |
| Paste / Tab / Focus | Same file | `copy_paste`, `tab_change`, `focus` |
| Device fingerprint | Same file | `getDeviceFingerprint()` (exported) |
| Session identity | Same file | `getSessionId()` (sessionStorage) |

---

## 3. API Gateway Layer

| Endpoint / Feature | Location | Description |
|--------------------|----------|-------------|
| `POST /api/register` | `backend/app/main.py` | Register (email, password, username, phone, company) |
| `POST /api/login` | `backend/app/main.py` | Login with email or username |
| `POST /api/events` | `backend/app/main.py` | Ingest behavior events, return risk |
| `GET /api/activity` | `backend/app/main.py` | Activity log (optional auth) |
| `GET /api/me` | `backend/app/main.py` | Current user profile (auth) |
| `GET /api/export/activity?format=csv\|pdf` | `backend/app/main.py` | Export activity |
| `POST /api/verify/email` | `backend/app/main.py` | Verify email domain (auth) |
| `POST /api/verify/company` | `backend/app/main.py` | Verify company domain (auth) |
| `POST /api/scan/image` | `backend/app/main.py` | Image malware scan (optional auth) |
| `GET /api/context` | `backend/app/main.py` | Client IP, user-agent |
| `GET /api/health` | `backend/app/main.py` | Health check for deployment |
| `WS /ws/dashboard` | `backend/app/main.py` | Live risk/activity updates |
| JWT Auth | `backend/app/auth.py` | Token create/decode, password hash/verify |
| RBAC | `backend/app/main.py` | `require_roles("admin", "analyst")` |

---

## 4. Risk Intelligence Engine

| Component | Location | Description |
|-----------|----------|-------------|
| Risk formula | `backend/app/risk_engine.py` | R = (w1×T)+(w2×M)+(w3×F)+(w4×D) + ML_Score |
| Rule engine | Same file | Typing, mouse, failed login, device, etc. |
| Trust decay / hijack | Same file | Trust score, session hijack probability |
| Alert level | Same file | `get_alert_level(risk_score)` |
| ML (Isolation Forest, etc.) | `backend/app/anomaly.py` | `score_anomaly()`, `update_user_baseline()` |

---

## 5. Database Layer

| Table / Data | Location | Description |
|--------------|----------|-------------|
| `users` | `backend/app/database.py` | id, email, password_hash, role, username, phone, company_name, company_domain, email_verified, phone_verified |
| `activity_logs` | Same file | Events with risk_impact, alert_level, metadata |
| `user_locks` | Same file | Temporary account lock |
| `user_devices` | Same file | Device fingerprints per user |
| `session_ips` | Same file | IPs per session (hijack detection) |
| `otp_codes` | Same file | OTP for MFA |
| ML baselines | `backend/app/anomaly.py` | In-memory per-user baseline (no separate table) |

---

## 6. Alert & Response System

| Component | Location | Description |
|-----------|----------|-------------|
| Email (Resend) | `backend/app/email_alerts.py` | `send_high_risk_alert()` |
| Dashboard notifications | `backend/app/main.py` | WebSocket broadcast to dashboards |
| Account auto-lock | `backend/app/main.py` | `lock_user()` on high/critical risk |
| OTP / MFA | `backend/app/main.py` | `/api/otp/request`, `/api/otp/verify` |
| Session hijack simulation | `backend/app/main.py` | `/api/demo/session-hijack-simulation` |

---

## Verification (Implement It)

1. **Backend**
   ```bash
   cd backend && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   - Open `http://localhost:8000/api/health` → `{"status":"ok", ...}`

2. **Frontend**
   ```bash
   cd frontend && npm install && npm run dev
   ```
   - Open `http://localhost:5173` → Register/Login, use dashboard, Profile & verification, Image malware checker, Device & network.

3. **Optional env**
   - `RESEND_API_KEY`, `FROM_EMAIL` for email alerts (see `backend/app/config.py`).

This is the implementation that matches [ARCHITECTURE.md](ARCHITECTURE.md).
