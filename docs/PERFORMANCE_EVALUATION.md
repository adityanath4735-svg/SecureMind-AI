# Performance Evaluation (Final-Year Level)

Use this section in **Chapter 5 – Results** to show detection accuracy, false positives/negatives, response time, and scalability.

---

## 1. Metrics to Measure

| Metric | Description | Target |
|--------|-------------|--------|
| **Detection accuracy %** | % of true attack-like behaviors correctly flagged as high/critical risk | Report with test data |
| **False positive rate (FPR)** | % of normal sessions wrongly flagged as high risk | Keep low (e.g. < 10%) |
| **False negative rate (FNR)** | % of attack-like sessions missed (risk stays low) | Keep low |
| **System response time** | Time from event to risk score (e.g. `/api/events` latency) | e.g. < 200 ms |
| **Scalability** | Events per second or concurrent users (optional) | Basic load test |

---

## 2. Test Data (Example)

Create a small test matrix:

| Scenario | Expected behavior | Risk level | Count |
|----------|-------------------|------------|--------|
| Normal typing + mouse | Low risk | Low | 20 |
| Paste in password field | High risk | High | 10 |
| 5 failed login attempts | High risk | High | 5 |
| New device (first-time fingerprint) | Elevated | Medium | 5 |
| IP change mid-session | Elevated | Medium | 5 |

- **True positives (TP):** Paste-in-password and rapid logins correctly flagged as High/Critical.
- **False positives (FP):** Normal sessions incorrectly flagged as High/Critical.
- **False negatives (FN):** Attack-like scenarios not flagged.

Then:

- **Accuracy** = (TP + TN) / (TP + TN + FP + FN)
- **FPR** = FP / (FP + TN)
- **FNR** = FN / (FN + TP)

---

## 3. System Response Time

- Use browser DevTools or a tool (e.g. `curl -w "%{time_total}"`) to measure:
  - `POST /api/events` from request send to response receive.
- Report average and max (e.g. “Average 85 ms, max 120 ms”).

---

## 4. Scalability (Optional)

- Run a simple load test (e.g. 50–100 requests to `/api/events` in sequence or parallel).
- Report: requests per second, any errors, and average latency.

---

## 5. Where to Put This in the Report

- **Chapter 5 – Results**: Add a subsection “Performance evaluation” with:
  - Table of test scenarios and outcomes
  - Detection accuracy, FPR, FNR
  - Response time (and scalability if done)
- Mention that the system is designed for **behavioral detection** and that metrics depend on threshold tuning (e.g. risk ≥ 50 for “High”).

---

## 6. Code Support (Optional)

You can add a small script or API endpoint that:

- Runs a set of predefined events (normal vs attack-like)
- Counts how many were classified as High/Critical vs Low/Medium
- Outputs accuracy, FPR, FNR

Example: `backend/scripts/evaluate_risk.py` that calls the risk engine with test payloads and compares results to expected labels.

Use this structure to show that the project is **evaluated** and not only implemented.
