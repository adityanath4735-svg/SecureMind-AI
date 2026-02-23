# Final-Year Project Report Structure

Use this outline for your **project report / thesis**. Fill in each chapter with your content and results.

---

## Chapter 1 – Introduction

- **1.1 Background of cybersecurity threats**
  - Rise of credential stuffing, bot attacks, session hijacking
  - Limitations of traditional security (passwords, IP blocking alone)
- **1.2 Human factor in cyber attacks**
  - Insider threats, stolen credentials, behavioral differences between humans and bots
- **1.3 Problem statement**
  - Need for behavior-based detection that complements existing security
- **1.4 Objectives**
  - Build a system that analyzes user interaction patterns (typing, mouse, device, IP) to assign risk and trigger alerts
- **1.5 Scope and organization of the report**

---

## Chapter 2 – Literature Review

- **2.1 Behavioral biometrics**
  - Keystroke dynamics, mouse movement, device fingerprinting; references to research papers
- **2.2 Insider threat detection**
  - User and Entity Behavior Analytics (UEBA); anomaly-based approaches
- **2.3 Anomaly detection systems**
  - Rule-based vs ML (Isolation Forest, Z-score, time-series); user baseline profiling
- **2.4 Risk scoring in security**
  - Risk formulas, weighted models, alert thresholds
- **2.5 Gap identification**
  - How this project combines behavior collection + mathematical risk model + ML + alerts

---

## Chapter 3 – System Design

- **3.1 Architecture**
  - **Draw the 6-layer diagram** (see `docs/ARCHITECTURE.md`):
    - Presentation Layer (React Dashboard)
    - Behavior Collection Layer (JS Tracking Engine)
    - API Gateway Layer (FastAPI)
    - Risk Intelligence Engine (ML + Rule Engine)
    - Database Layer (SQLite)
    - Alert & Response System
- **3.2 Database schema**
  - Tables: users (id, email, password_hash, role, created_at), activity_logs, user_locks, user_devices, session_ips, otp_codes
  - ER diagram
- **3.3 Risk model**
  - **Mathematical formula** (see `docs/RISK_MODEL.md`):
    - \( R = (w_1 \times T) + (w_2 \times M) + (w_3 \times F) + (w_4 \times D) + \text{ML\_Score} \)
  - Definition of T, M, F, D, ML_Score and weights
  - Alert level mapping (Low / Medium / High / Critical)
- **3.4 Role-Based Access Control**
  - Roles: Admin, Analyst, User; which endpoints each can access

---

## Chapter 4 – Implementation

- **4.1 Tech stack**
  - Frontend: React, Vite, Tailwind, Recharts
  - Backend: FastAPI, SQLite, JWT, bcrypt
  - ML: scikit-learn (Isolation Forest), Z-score, time-series, user baseline
- **4.2 API structure**
  - List of endpoints (register, login, events, activity, stats, export, OTP, admin)
  - Request/response examples
- **4.3 Behavior collection**
  - What is tracked (typing, mouse, paste, tab, device fingerprint) and how
- **4.4 ML training and scoring**
  - How the anomaly detector is fitted; how ML_Score is combined with rule-based R
- **4.5 Security features**
  - MFA/OTP when high risk; account lock; email alerts; session hijack simulation (demo)

---

## Chapter 5 – Results

- **5.1 Test cases**
  - Normal login vs paste-in-password vs rapid failed logins; expected risk and alerts
- **5.2 Risk detection accuracy**
  - Use performance metrics (see `docs/PERFORMANCE_EVALUATION.md`): detection accuracy %, false positive rate, false negative rate
- **5.3 System response time**
  - Latency of `/api/events` and dashboard load
- **5.4 Screenshots**
  - Dashboard, risk meter, activity log, export, alerts

---

## Chapter 6 – Conclusion & Future Scope

- **6.1 Summary**
  - What was built and how it meets the objectives
- **6.2 Limitations**
  - E.g. single-browser tracking, lab environment for hijack simulation
- **6.3 Future scope** (see `docs/FUTURE_SCOPE.md`)
  - Deep learning for behavioral modeling
  - Blockchain-based identity validation
  - Integration with enterprise SIEM
  - Zero Trust Architecture

---

## Viva one-liner

> “Unlike traditional vulnerability scanners, this system focuses on **behavioral cybersecurity** by modeling user interaction patterns and detecting anomalies using a **weighted risk formula** and **machine learning** (Isolation Forest, Z-score, user baseline).”

Use this structure in your report and refer to the architecture diagram and risk formula in Chapters 3 and 4.
