# SecureMind AI

**Behavioral Threat Intelligence Platform** — we detect suspicious user behavior **before** an attack happens.

- **Problem:** Traditional security (malware, vulns, network) misses **account takeover**, **insider threats**, **bot impersonation**, **credential stuffing**. Companies lose millions.
- **Solution:** Lightweight, API-first behavior analysis (typing, mouse, session, device) → real-time risk score → alerts and protection.
- **Target:** EdTech, SaaS, FinTech, online exams, remote work, small banks — teams that need behavioral security but can’t afford enterprise tools.

📄 **Startup positioning, market, SaaS model, MVP, roadmap, pitch:** see **[docs/STARTUP.md](docs/STARTUP.md)**.

---

## What It Does

SecureMind AI monitors **behavioral signals** to assign a **risk score** and surface alerts:

| Signal | Description |
|--------|-------------|
| **Typing patterns** | Speed changes, uniformity (bot-like), stress indicators |
| **Rapid logins** | Multiple failed or rapid login attempts |
| **Mouse movement** | Suspicious or robotic movement, lack of natural variation |
| **Copy-paste in password** | Strong indicator of credential stuffing or shared passwords |
| **Time-based access** | Unusual hours (e.g. late-night access) |
| **Multi-tab / session** | Multiple tabs or sessions for the same flow |
| **Behavioral fingerprint** | Consistency of interaction style over time |

The system then:

- **Assigns a Risk Score** (0–100)
- **Displays it** on a real-time dashboard
- **Triggers alert levels**: Low / Medium / High / Critical
- **Trust score over time** — decays with suspicious activity, recovers with normal behavior
- **Session hijack probability** — heuristic from risk factors

---

## Features

- **Dark / Light theme** — auto from system preference or manual toggle (☀/☽); persists across sessions
- **Real-time risk meter** and **trust score**
- **Live graphs** of risk over time
- **Suspicious activity log** with event type and impact
- **User interaction heatmap** (mouse activity)
- **Alert notifications** for High/Critical risk
- **Admin security analytics** — events by alert level, session count
- **Stress typing detection** — high variance in keystroke timing
- **Session hijack prediction** — likelihood from current signals

---

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Recharts
- **Backend**: Python, FastAPI, SQLite
- **Auth**: JWT, bcrypt password hashing
- **Real-time**: WebSockets
- **Behavior tracking**: JavaScript (typing, mouse, paste, focus)
- **Risk logic**: Custom weighted scoring + optional ML (Isolation Forest) for anomaly detection

---

## Architecture (Phases)

```
Frontend → API → Database (SQLite)
Frontend → Behavior Tracker → POST /api/events → Risk Engine → Alert System
```

- **Phase 2**: Register, Login, JWT, bcrypt — users stored in SQLite.
- **Phase 3–4**: Behavior events (typing, mouse, copy-paste, tab) stored; risk scoring (rule-based + optional ML).
- **Phase 5**: Admin dashboard — risk meter, activity timeline, heatmap, trust score, analytics.
- **Phase 6**: **Alert & protection** — Medium risk → warning; **High/Critical** → force re-authentication + **temporary account lock** (15 min).
- **Phase 7 (advanced)**:
  - **Email alerts**: Optional Resend API — send email to user when account is locked (set `RESEND_API_KEY` and `FROM_EMAIL` in env).
  - **Device fingerprinting**: Client sends a fingerprint (screen, timezone, language, user agent); backend flags **new device** and adds to risk.
  - **IP anomaly**: Client IP is stored per session; **IP change mid-session** is flagged and increases risk (session hijack signal).
  - **Export**: Admin can download activity as **CSV** or **PDF** from the Security Analytics card (`/api/export/activity?format=csv|pdf`).
  - **Demo mode**: On the login page, “View dashboard in demo mode” shows the dashboard without signing in (no user-scoped data).

---

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. **Register** or **log in**, or use **“View dashboard in demo mode”** to see the dashboard without login.

- **Dashboard**: Risk meter, trust score, session hijack probability, activity log, heatmap, analytics, **Export (CSV/PDF)**.
- **Real time**: Type, move the mouse, or paste into the demo password field to see risk change.
- **High risk**: Triggers force re-login and a 15-minute account lock; optionally sends an **email alert** if `RESEND_API_KEY` is set.

### 3. Trigger Risk Signals (Demo)

- **Type** in the email/password demo fields — typing patterns are analyzed
- **Paste** into the password field — raises risk (copy-paste password behavior)
- Click **“Simulate failed login attempt”** — multiple rapid logins increase risk and alerts

---

## Project Layout

```
SecureMind-AI/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, auth, /api/events, WebSocket
│   │   ├── models.py        # Pydantic models, enums
│   │   ├── auth.py          # JWT, bcrypt
│   │   ├── database.py      # SQLite (users, activity_logs, user_locks)
│   │   ├── risk_engine.py   # Risk scoring, trust decay, hijack heuristic
│   │   └── anomaly.py       # Optional ML anomaly detection
│   ├── securemind.db        # Created on first run
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/      # RiskMeter, LiveGraph, ActivityLog, Heatmap, etc.
│   │   ├── hooks/           # useWebSocket, useActivityLog, useStats
│   │   └── lib/
│   │       └── behaviorTracker.js   # Client-side behavior collection
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## API Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/register` | POST | Register (JSON: `email`, `password`); returns JWT |
| `/api/login` | POST | Login (JSON: `email`, `password`); returns JWT |
| `/api/events` | POST | Ingest behavior event (optional `Authorization: Bearer <token>`); returns risk assessment |
| `/api/login_attempt` | POST | Record login attempt (query: `session_id`, `success`) |
| `/api/activity` | GET | Activity log (query: `limit`); optional auth for user-scoped data |
| `/api/stats` | GET | Aggregate stats for admin panel |
| `/api/me` | GET | Current user (requires auth) |
| `/api/export/activity?format=csv\|pdf` | GET | Download activity log as CSV or PDF (optional auth) |
| `/ws/dashboard` | WebSocket | Live risk/activity updates for dashboard |

---

## Enterprise & Report (Final-Year)

- **Architecture diagram** (6 layers): see `docs/ARCHITECTURE.md` — draw in your report.
- **Mathematical risk model**: \( R = (w_1 \times T) + (w_2 \times M) + (w_3 \times F) + (w_4 \times D) + \text{ML\_Score} \) — see `docs/RISK_MODEL.md`.
- **ML component**: Isolation Forest + Z-score + time-series + per-user baseline (see `backend/app/anomaly.py`).
- **RBAC**: roles `admin`, `analyst`, `user`; `/api/admin/stats` for admin/analyst only.
- **MFA/OTP**: `POST /api/otp/request`, `POST /api/otp/verify` when high risk.
- **Session hijack simulation**: `POST /api/demo/session-hijack-simulation` (lab demo).
- **Report structure** (Ch 1–6): `docs/REPORT_STRUCTURE.md`.
- **Performance evaluation**: `docs/PERFORMANCE_EVALUATION.md`.
- **Future scope**: `docs/FUTURE_SCOPE.md` (deep learning, blockchain, SIEM, Zero Trust).

---

## How to Present It (e.g. GitHub / Viva / Pitch)

> **SecureMind AI** is a **behavioral threat detection platform** that continuously analyzes user interaction patterns to **prevent account takeovers and insider threats in real time.** We detect suspicious behavior *before* an attack happens — that’s predictive security.
>
> Technical: weighted risk formula + **ML** (Isolation Forest, Z-score, user baseline), RBAC, OTP on high risk, enterprise-style architecture. See **docs/STARTUP.md** for market, SaaS model, MVP, and roadmap.

---

## License

MIT (or your choice).
