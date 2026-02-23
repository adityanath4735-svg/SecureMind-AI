# SecureMind AI – Full Project Guide

Complete step-by-step documentation: what the project does, how it’s built, and how to run and use it.

---

## Startup / Product Version

SecureMind AI is positioned as a **behavioral threat intelligence platform** (not just a project):

- **Problem:** Traditional security misses account takeover, insider threats, bot impersonation, credential stuffing — companies lose millions.
- **Solution:** API-first behavior analysis → real-time risk score → predictive security *before* an attack.
- **Target market:** EdTech, SaaS, FinTech, online exams, remote work, small banks.
- **Business model:** Subscription SaaS (e.g. $29–$99/mo) or per-session pricing; MVP = SDK + Risk API + dashboard + webhook.
- **USP:** “We detect suspicious user behavior before an attack happens.”

Full startup doc: **[docs/STARTUP.md](docs/STARTUP.md)** (market, SaaS model, MVP, roadmap, pitch, long-term vision).

---

## Enterprise Additions (Final-Year)

- **Architecture**: 6-layer diagram and description → `docs/ARCHITECTURE.md`
- **Risk formula**: \( R = (w_1 \times T) + (w_2 \times M) + (w_3 \times F) + (w_4 \times D) + \text{ML\_Score} \) → `docs/RISK_MODEL.md`
- **ML**: Isolation Forest, Z-score, time-series, user baseline → `backend/app/anomaly.py`
- **RBAC**: Admin / Analyst / User; `require_roles("admin", "analyst")` for admin endpoints
- **OTP**: `/api/otp/request`, `/api/otp/verify` for MFA when high risk
- **Report structure (Ch 1–6)**: `docs/REPORT_STRUCTURE.md`
- **Performance evaluation**: `docs/PERFORMANCE_EVALUATION.md`
- **Future scope**: `docs/FUTURE_SCOPE.md`

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [What Problem It Solves](#2-what-problem-it-solves)
3. [Tech Stack (Detailed)](#3-tech-stack-detailed)
4. [Architecture & Data Flow](#4-architecture--data-flow)
5. [Project Structure](#5-project-structure)
6. [Step-by-Step Setup](#6-step-by-step-setup)
7. [Features (Step-by-Step)](#7-features-step-by-step)
8. [API Reference](#8-api-reference)
9. [Configuration](#9-configuration)
10. [How to Demo / Present](#10-how-to-demo--present)

---

## 1. Project Overview

**SecureMind AI** is a **behavior-based cybersecurity system** that:

- Tracks how users interact (typing speed, mouse movement, copy-paste, tabs, etc.).
- Computes a **risk score (0–100)** and **trust score** in real time.
- Detects possible **bots**, **credential stuffing**, **session hijacking**, and **suspicious behavior**.
- Shows everything on an **admin dashboard** with live graphs, activity log, and heatmap.
- Can **lock accounts** and **force re-login** when risk is high, and optionally **send email alerts**.

It combines **cybersecurity**, **behavioral analysis**, and **AI/ML-style anomaly detection** into one app.

---

## 2. What Problem It Solves

| Problem | How SecureMind AI Helps |
|--------|---------------------------|
| Bots or scripts logging in | Unnatural typing (too uniform/fast) and mouse patterns increase risk. |
| Stolen passwords (credential stuffing) | Pasting into password field is a strong risk signal. |
| Session hijacking | New device fingerprint or IP change mid-session increases risk and can trigger lock. |
| Multiple failed logins | Rapid/failed login attempts are counted and increase risk. |
| No visibility into user behavior | Dashboard shows risk over time, activity log, and analytics. |
| Need to act on high risk | High/Critical risk → temporary lock, force re-login, optional email alert. |

---

## 3. Tech Stack (Detailed)

### Backend
- **Python 3.9+**
- **FastAPI** – REST API, WebSockets
- **SQLite** – users, activity logs, locks, device fingerprints, session IPs
- **JWT** (python-jose) – auth tokens
- **bcrypt** – password hashing
- **Pydantic** – request/response models
- **httpx** – async HTTP (for Resend email API)
- **reportlab** – PDF export
- **scikit-learn** – optional Isolation Forest for anomaly detection

### Frontend
- **React 18**
- **Vite** – build and dev server
- **Tailwind CSS** – styling
- **Recharts** – risk-over-time graph
- **Vanilla JS** – behavior tracker (no framework dependency)

### Optional / External
- **Resend** – transactional email when account is locked (set `RESEND_API_KEY`)

---

## 4. Architecture & Data Flow

### High-level

```
┌─────────────────┐     POST /api/events      ┌─────────────────┐     ┌──────────────┐
│  Browser        │ ────────────────────────► │  FastAPI        │ ──► │  SQLite      │
│  (React +       │     (typing, mouse,        │  Backend        │     │  (users,     │
│   behavior      │      paste, fingerprint)   │  Risk Engine    │     │   logs,      │
│   tracker)      │                            │  Alerts         │     │   locks)     │
└────────┬────────┘                            └────────┬────────┘     └──────────────┘
         │                                              │
         │  WebSocket /ws/dashboard                     │  High risk?
         │  (live risk updates)                         │  → Lock user
         │  ◄──────────────────────────────────────────┤  → Email (optional)
         │                                              │
         ▼                                              ▼
┌─────────────────┐                            ┌─────────────────┐
│  Dashboard      │                            │  Export CSV/PDF  │
│  (risk meter,   │                            │  /api/export/    │
│   graph, log,   │                            │  activity        │
│   heatmap)      │                            └─────────────────┘
└─────────────────┘
```

### Request flow (one behavior event)

1. User types/moves mouse/pastes in the app.
2. **behaviorTracker.js** sends `POST /api/events` with `event_type`, `session_id`, `payload` (e.g. keystroke interval, mouse speed, `device_fingerprint`).
3. Backend reads **client IP** from the request.
4. Backend **records** session IP and (if logged in) device fingerprint in SQLite.
5. Backend checks **new_device** (fingerprint first time for this user) and **ip_change** (multiple IPs this session).
6. **Risk engine** computes risk from: typing, mouse, copy-paste, rapid logins, time, multi-tab, stress typing, new_device, ip_change.
7. **Trust score** and **session hijack probability** are updated.
8. Activity row is **inserted** into `activity_logs`.
9. If risk is **High/Critical** and user is logged in: **lock** user (15 min), set `requires_reauth`, optionally **send email**.
10. Response returns **RiskAssessment** (risk_score, alert_level, trust_score, etc.).
11. **WebSocket** broadcasts the update to all connected dashboards so the UI updates in real time.

---

## 5. Project Structure

```
SecureMind-AI/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py           # FastAPI app: routes, auth, events, export, WebSocket
│   │   ├── config.py         # Settings (CORS, JWT secret, Resend)
│   │   ├── models.py         # Pydantic: BehaviorEvent, RiskAssessment, Auth, etc.
│   │   ├── auth.py           # JWT create/decode, bcrypt hash/verify
│   │   ├── database.py       # SQLite: init, users, activity_logs, user_locks, devices, IPs
│   │   ├── risk_engine.py    # Risk scoring, trust decay, alert level, hijack probability
│   │   ├── anomaly.py        # Optional: Isolation Forest for anomaly detection
│   │   └── email_alerts.py   # Optional: Resend API for high-risk email
│   ├── requirements.txt
│   └── securemind.db         # Created on first run (do not commit)
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js        # Proxy /api and /ws to backend
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.jsx          # React root + AuthProvider
│       ├── App.jsx            # Login/Register vs Dashboard; demo mode
│       ├── App.css
│       ├── index.css         # Tailwind + globals
│       ├── context/
│       │   └── AuthContext.jsx   # Token, user, login, register, logout
│       ├── hooks/
│       │   ├── index.js
│       │   ├── useWebSocket.js
│       │   ├── useActivityLog.js
│       │   └── useStats.js
│       ├── lib/
│       │   └── behaviorTracker.js   # Typing, mouse, paste, tab, device fingerprint
│       └── components/
│           ├── LoginPage.jsx
│           ├── RegisterPage.jsx
│           ├── RiskMeter.jsx
│           ├── TrustScore.jsx
│           ├── LiveGraph.jsx
│           ├── ActivityLog.jsx
│           ├── Heatmap.jsx
│           ├── AlertTray.jsx
│           ├── AdminStats.jsx
│           ├── ExportButton.jsx
│           └── DemoPanel.jsx
│
├── README.md
└── PROJECT_GUIDE.md          # This file
```

---

## 6. Step-by-Step Setup

### Prerequisites
- **Node.js** 18+ and **npm**
- **Python** 3.9+

### Step 1: Clone / open the project
```bash
cd /path/to/SecureMind-AI
```

### Step 2: Backend setup
```bash
cd backend
python3 -m venv venv
```
- **Windows:** `venv\Scripts\activate`
- **macOS/Linux:** `source venv/bin/activate`

```bash
pip install -r requirements.txt
```
This installs FastAPI, uvicorn, pydantic, python-jose, bcrypt, httpx, reportlab, scikit-learn, etc.

### Step 3: (Optional) Backend environment
Create `backend/.env` if you want to override defaults:
```env
JWT_SECRET=your-secret-key
RESEND_API_KEY=re_xxxx
FROM_EMAIL=alerts@yourdomain.com
```
If you skip this, the app still runs with defaults (no email alerts).

### Step 4: Run the backend
```bash
# From backend/ with venv activated
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- API: `http://localhost:8000`
- Docs: `http://localhost:8000/docs`
- On first request, `securemind.db` is created and tables are initialized.

### Step 5: Frontend setup
Open a **new terminal**:
```bash
cd frontend
npm install
```

### Step 6: Run the frontend
```bash
npm run dev
```
- App: **http://localhost:5173**
- Vite proxies `/api` and `/ws` to `http://localhost:8000`.

### Step 7: Verify
1. Open **http://localhost:5173**.
2. You should see the **login** page.
3. Click **“View dashboard in demo mode (no login)”** → dashboard loads.
4. Or **Register** with email + password → then you see the dashboard when logged in.

---

## 7. Features (Step-by-Step)

### 7.1 Authentication (Register / Login)
- **Register:** `POST /api/register` with `{ "email", "password" }` → user created in SQLite, password hashed with bcrypt, JWT returned.
- **Login:** `POST /api/login` with `{ "email", "password" }` → JWT returned. If account is locked (high risk), returns 403.
- Frontend stores JWT in `localStorage` and sends `Authorization: Bearer <token>` on API calls.
- **Logout:** Frontend clears token and user from storage.

### 7.2 Behavior Tracking (Frontend)
- **behaviorTracker.js** runs after login or in demo mode.
- **Typing:** On keydown, sends intervals and derives WPM and “stress” variance; field type (e.g. password) is included.
- **Mouse:** Mousemove is sampled; every 3 seconds it sends average movement speed.
- **Paste:** Paste event is captured; if target is a password field, `pasted_in_password: true` is sent.
- **Tab:** Visibility change and blur increment a tab count; tab count is sent with events.
- **Device fingerprint:** A hash of userAgent, language, screen size, timezone, etc. is sent as `device_fingerprint` in every event payload.

### 7.3 Risk Scoring (Backend)
- **risk_engine.py** uses **weights** per factor (e.g. copy_paste_password 0.22, typing_anomaly 0.18, new_device 0.06, ip_change 0.05).
- Each event type contributes: typing → typing_anomaly + stress_typing; mouse → mouse_anomaly; paste → copy_paste_password; etc.
- **new_device:** True if the current `device_fingerprint` was never seen for this user before.
- **ip_change:** True if the session has seen more than one client IP.
- Risk is a weighted sum (0–100). **Trust score** starts at 100 and decays when risk is high, recovers when risk is low. **Session hijack probability** is a heuristic from risk and factors (e.g. copy_paste, new_device, ip_change).
- **Alert level:** Low (&lt;25), Medium (25–50), High (50–75), Critical (≥75).

### 7.4 Alerts & Protection
- **Medium risk:** Only the dashboard warning (AlertTray) is shown.
- **High/Critical risk (and user logged in):**
  - Row inserted into `user_locks` (locked for 15 minutes).
  - Response includes `requires_reauth: true` and `account_locked_until`.
  - Frontend clears token and shows login with “Session locked…”.
  - If `RESEND_API_KEY` is set, **email_alerts.send_high_risk_alert** is called (Resend API).

### 7.5 Dashboard
- **Risk meter:** Current risk score and alert level (color-coded).
- **Trust score:** Ring showing trust; “Session hijack risk” from backend.
- **Risk over time:** Recharts line chart; data from `/api/activity` (risk_impact per row).
- **Interaction heatmap:** Grid that fills by mouse position over time (client-side).
- **Security analytics:** Counts by alert level, total events, sessions; **Export** buttons for CSV/PDF.
- **Suspicious activity log:** List of recent activity rows (time, description, risk, level).
- **WebSocket:** Dashboard connects to `/ws/dashboard`; backend broadcasts risk_update and new activity so the UI updates live.

### 7.6 Export
- **CSV:** `GET /api/export/activity?format=csv` → streamed CSV download.
- **PDF:** `GET /api/export/activity?format=pdf` → Reportlab-generated PDF (table of activity).
- With auth: export is scoped to that user’s activity. Without auth (e.g. demo): all activity (if your backend allows).

### 7.7 Demo Mode
- On the login page, “View dashboard in demo mode (no login)” sets `demoMode` in App state.
- Dashboard is shown without a token; banner says “Viewing in demo mode…”.
- Behavior tracker still runs; events are sent without `Authorization`; backend stores them with `user_id = null`. Good for demos and testing.

---

## 8. API Reference

| Method | Endpoint | Body/Query | Description |
|--------|----------|------------|-------------|
| POST | `/api/register` | `{ "email", "password" }` | Create user, return JWT. |
| POST | `/api/login` | `{ "email", "password" }` | Return JWT; 403 if locked. |
| POST | `/api/events` | `BehaviorEvent` (event_type, session_id, payload, …) | Ingest event; return RiskAssessment. Optional `Authorization: Bearer <token>`. |
| POST | `/api/login_attempt` | Query: `session_id`, `success` | Record a login attempt for risk (e.g. failed logins). |
| GET | `/api/activity` | Query: `limit` (default 100) | List activity log. With auth: user-scoped; without: all. |
| GET | `/api/stats` | — | Aggregates: total_events, by_alert_level, sessions. |
| GET | `/api/me` | Header: `Authorization: Bearer <token>` | Current user id and email. |
| GET | `/api/export/activity` | Query: `format=csv` or `pdf`, `limit` | Download CSV or PDF. |
| WebSocket | `/ws/dashboard` | — | Connect for live risk_update and activity messages. |
| GET | `/` | — | Health/info: app name and version. |

### Example: POST /api/events
```json
{
  "event_type": "typing",
  "session_id": "sess_abc123",
  "user_id": null,
  "timestamp": "2025-02-23T12:00:00Z",
  "payload": {
    "keystroke_interval_ms": 120,
    "words_per_minute": 45,
    "field_type": "email",
    "stress_indicator": 0.3,
    "device_fingerprint": "k3j2h4"
  }
}
```
Response: `RiskAssessment` with `risk_score`, `alert_level`, `trust_score`, `session_hijack_probability`, `requires_reauth`, `account_locked_until`, etc.

---

## 9. Configuration

### Backend (env or `config.py`)

| Variable | Default | Purpose |
|----------|---------|--------|
| `JWT_SECRET` | `securemind-dev-secret-...` | Signing key for JWT. |
| `CORS_ORIGINS` | `["http://localhost:5173", ...]` | Allowed origins for browser. |
| `RESEND_API_KEY` | `""` | Resend API key for email alerts; empty = no email. |
| `FROM_EMAIL` | `alerts@securemind.local` | Sender address for alerts. |

### Frontend
- **Vite proxy** in `vite.config.js`: `/api` and `/ws` → `http://127.0.0.1:8000` (backend).
- **WebSocket URL** in `useWebSocket.js`: when port is 5173, connects to port 8000 for `/ws/dashboard`.

---

## 10. How to Demo / Present

### Short pitch (1–2 sentences)
“SecureMind AI is a behavior-based security system. It watches how you type and move the mouse, scores risk in real time, and can lock the session and force re-login when it detects things like pasted passwords or too many failed logins.”

### Demo script (about 5 minutes)
1. **Start** backend and frontend (see Step 6).
2. **Demo mode:** Open app → “View dashboard in demo mode” → show risk meter, graph, log, heatmap.
3. **Interact:** Type in the demo fields, move the mouse → point out risk/trust changing.
4. **High risk:** Paste into the password field; click “Simulate failed login attempt” a few times → show alert and (if logged in) lock + redirect to login.
5. **Auth:** Register → dashboard with your email; show Export CSV/PDF.
6. **One-liner:** “So we’re not just blocking IPs or passwords—we’re looking at *how* the user behaves to catch bots and hijacking.”

### For GitHub / portfolio
- **Repo title:** SecureMind AI – Behavior-Based Security Intelligence
- **Description:** Analyzes user interaction patterns to detect bots, credential stuffing, and session hijacking; real-time risk scoring, trust score, and admin dashboard with export.
- **Topics:** `cybersecurity`, `behavior-analysis`, `react`, `fastapi`, `python`, `jwt`, `sqlite`, `anomaly-detection`

---

## Quick Command Reference

```bash
# Backend
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

Then open **http://localhost:5173** and use **Register** or **Demo mode** to explore the dashboard.
