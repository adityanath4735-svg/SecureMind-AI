# Mathematical Risk Model (for Final-Year Report)

Use this section in **Chapter 3 – System Design** and **Chapter 4 – Implementation** to show a research-based, formula-driven risk score.

---

## Risk Score Formula

The overall **risk score** \( R \) (0–100) is:

\[
R = (w_1 \times T) + (w_2 \times M) + (w_3 \times F) + (w_4 \times D) + \text{ML\_Score}
\]

Where:

| Symbol | Meaning | Range / Unit |
|--------|--------|---------------|
| **T** | Typing anomaly score | 0–1 (normalized) |
| **M** | Mouse movement deviation score | 0–1 (normalized) |
| **F** | Failed login / rapid attempt score | 0–1 (normalized) |
| **D** | Device anomaly (new device / IP change) | 0–1 (normalized) |
| **ML_Score** | Output from ML module (Isolation Forest + Z-score + baseline) | 0–25 (scaled to contribute to R) |
| **w₁, w₂, w₃, w₄** | Weighted coefficients | \(\sum w_i = 1\); tuned from threat model |

---

## Component Definitions (for report)

- **T (Typing anomaly):** Derived from keystroke intervals and WPM. High variance → stress/coercion; very low variance → bot-like; unnaturally fast WPM → automation. Normalized to [0, 1].
- **M (Mouse deviation):** Based on movement speed and pattern. Near-zero movement over time → automated session; deviation from user’s typical mouse behavior → anomaly. Normalized to [0, 1].
- **F (Failed login count):** Number of failed or rapid login attempts in a time window. Normalized to [0, 1] (e.g. 2 attempts → 0.4, 5+ → 1.0).
- **D (Device anomaly):** Combines (1) new device fingerprint (first time seen for this user) and (2) IP change mid-session. Each contributes; combined normalized to [0, 1].
- **ML_Score:** From the Risk Intelligence Engine: Isolation Forest anomaly score + Z-score deviation + (optional) time-series and user-baseline comparison. Scaled so that maximum ML contribution is cap (e.g. 25) so that \( R \leq 100 \).

---

## Weighted Coefficients (implementation)

Default weights used in code (can be tuned):

| Coefficient | Value | Component |
|-------------|--------|-----------|
| w₁ | 0.25 | T (typing) |
| w₂ | 0.20 | M (mouse) |
| w₃ | 0.25 | F (failed logins) |
| w₄ | 0.15 | D (device anomaly) |
| — | remainder | ML_Score (capped) |

So the rule-based part is \( (w_1 T + w_2 M + w_3 F + w_4 D) \times 100 \) (to get 0–100 scale), then ML_Score is added and the total is capped at 100.

---

## Alert Level Mapping (for report)

| Risk score \( R \) | Alert level | Action |
|--------------------|-------------|--------|
| 0–24 | Low | Normal monitoring |
| 25–49 | Medium | Warning on dashboard |
| 50–74 | High | Force re-auth, optional OTP, account lock |
| 75–100 | Critical | Lock, email alert, OTP required |

---

## Reference to Code

- **Formula implementation:** `backend/app/risk_engine.py` — `compute_risk()` builds T, M, F, D and calls the ML module for ML_Score, then applies the weighted sum and cap.
- **ML_Score:** `backend/app/anomaly.py` — Isolation Forest, Z-score, time-series, and user baseline (when enabled) produce a single anomaly score that is scaled to ML_Score.

Use this mathematical model and the table in your report to show that the system is **research-based** and not simple if-else logic.
