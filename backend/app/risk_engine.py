"""
SecureMind AI Risk Scoring Engine – Research-based mathematical model.

Risk Score Formula (for final-year report):
  R = (w1×T) + (w2×M) + (w3×F) + (w4×D) + ML_Score

  T = Typing anomaly score [0-1]
  M = Mouse movement deviation [0-1]
  F = Failed login / rapid attempt score [0-1]
  D = Device anomaly (new device + IP change) [0-1]
  ML_Score = Scaled output from Isolation Forest + Z-score + baseline (0-25)
  w1..w4 = Weighted coefficients (sum = 1)

  Final R is capped to [0, 100]; rule-based part contributes 0-75, ML contributes 0-25.
"""
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from app.models import AlertLevel, EventType


# Weighted coefficients for the risk formula (research-based; tunable)
W1_TYPING = 0.25
W2_MOUSE = 0.20
W3_FAILED_LOGIN = 0.25
W4_DEVICE = 0.15
# Rule-based part scaled to 0-75; ML_Score scaled to 0-25 so R in [0, 100]
RULE_WEIGHT = 75.0
ML_WEIGHT = 25.0


class RiskEngine:
    """Computes risk score using R = (w1×T)+(w2×M)+(w3×F)+(w4×D) + ML_Score."""

    def __init__(self, window_minutes: int = 15):
        self.window = timedelta(minutes=window_minutes)
        self.session_events: Dict[str, List[Dict[str, Any]]] = {}
        self.login_attempts: Dict[str, List[datetime]] = {}
        self.typing_history: Dict[str, List[float]] = {}
        self.mouse_history: Dict[str, List[float]] = {}
        self.trust_scores: Dict[str, float] = {}
        self._anomaly_model = None

    def _get_or_init_session(self, session_id: str) -> List[Dict]:
        if session_id not in self.session_events:
            self.session_events[session_id] = []
            self.trust_scores[session_id] = 100.0
        return self.session_events[session_id]

    def _decay_trust(self, session_id: str, risk_delta: float) -> None:
        if session_id not in self.trust_scores:
            self.trust_scores[session_id] = 100.0
        self.trust_scores[session_id] = max(0, self.trust_scores[session_id] - risk_delta * 0.5)
        self.trust_scores[session_id] = min(100, self.trust_scores[session_id])

    def _recover_trust(self, session_id: str, amount: float = 0.5) -> None:
        if session_id in self.trust_scores:
            self.trust_scores[session_id] = min(100, self.trust_scores[session_id] + amount)

    # --- T: Typing anomaly [0-1] ---
    def _score_typing_anomaly(self, session_id: str, payload: dict) -> float:
        interval = payload.get("keystroke_interval_ms")
        wpm = payload.get("words_per_minute")
        if interval is None and wpm is None:
            return 0.0
        if session_id not in self.typing_history:
            self.typing_history[session_id] = []
        history = self.typing_history[session_id]
        val = interval if interval is not None else (60000 / (wpm * 5)) if wpm else None
        if val is not None:
            history.append(val)
            if len(history) > 50:
                history.pop(0)
        if len(history) < 5:
            return 0.0
        mean_val = sum(history) / len(history)
        variance = sum((x - mean_val) ** 2 for x in history) / len(history)
        if mean_val < 30:
            return min(1.0, 0.3 + (30 - mean_val) / 100)
        if variance < 10 and mean_val < 100:
            return 0.7
        return min(1.0, variance / 5000) * 0.5

    def _score_stress_typing(self, payload: dict) -> float:
        stress = payload.get("stress_indicator")
        if stress is None:
            return 0.0
        return min(1.0, stress / 2.0)

    # --- F: Failed login / rapid attempts [0-1] ---
    def _score_rapid_logins(self, session_id: str) -> float:
        if session_id not in self.login_attempts:
            return 0.0
        attempts = self.login_attempts[session_id]
        now = datetime.utcnow()
        recent = [t for t in attempts if now - t < self.window]
        if len(recent) >= 5:
            return 1.0
        if len(recent) >= 3:
            return 0.7
        if len(recent) >= 2:
            return 0.4
        return 0.0

    # --- M: Mouse deviation [0-1] ---
    def _score_mouse_anomaly(self, session_id: str, payload: dict) -> float:
        speed = payload.get("movement_speed")
        if speed is None:
            return 0.0
        if session_id not in self.mouse_history:
            self.mouse_history[session_id] = []
        self.mouse_history[session_id].append(speed)
        hist = self.mouse_history[session_id]
        if len(hist) > 100:
            hist.pop(0)
        if len(hist) < 10:
            return 0.0
        if sum(1 for s in hist[-20:] if s < 0.1) >= 15:
            return 0.8
        return 0.0

    def _score_copy_paste_password(self, payload: dict) -> float:
        return 1.0 if payload.get("pasted_in_password") is True else 0.0

    def _score_time_anomaly(self, payload: dict) -> float:
        hour = datetime.utcnow().hour
        if 2 <= hour <= 5:
            return 0.3
        return 0.0

    def _score_multi_tab(self, payload: dict) -> float:
        tab_count = payload.get("tab_count", 0)
        if tab_count > 3:
            return 0.6
        if tab_count > 1:
            return 0.2
        return 0.0

    # --- D: Device anomaly [0-1] ---
    def _score_new_device(self, payload: dict) -> float:
        return 0.8 if payload.get("new_device") is True else 0.0

    def _score_ip_change(self, payload: dict) -> float:
        return 0.7 if payload.get("ip_change") is True else 0.0

    def _session_hijack_probability(self, risk_score: float, factors: List[str]) -> float:
        hijack_indicators = {"copy_paste_password", "rapid_logins", "typing_anomaly", "mouse_anomaly", "new_device", "ip_change"}
        overlap = hijack_indicators & set(factors)
        base = risk_score / 100.0
        return min(0.95, base * (1 + 0.3 * len(overlap)))

    def record_login_attempt(self, session_id: str, success: bool) -> None:
        if session_id not in self.login_attempts:
            self.login_attempts[session_id] = []
        self.login_attempts[session_id].append(datetime.utcnow())

    def get_component_scores(self, session_id: str, event_type: str, payload: dict) -> Tuple[float, float, float, float, List[str]]:
        """
        Returns (T, M, F, D, factors) for the risk formula.
        T=typing, M=mouse, F=failed login, D=device anomaly; each in [0, 1].
        """
        factors: List[str] = []
        T = 0.0
        M = 0.0
        F = 0.0
        D = 0.0

        if event_type == EventType.TYPING:
            T = max(T, self._score_typing_anomaly(session_id, payload))
            if T > 0:
                factors.append("typing_anomaly")
            stress = self._score_stress_typing(payload)
            if stress > 0:
                T = max(T, stress)
                factors.append("stress_typing")

        if event_type == EventType.LOGIN_ATTEMPT:
            F = self._score_rapid_logins(session_id)
            if F > 0:
                factors.append("rapid_logins")

        if event_type == EventType.MOUSE:
            M = self._score_mouse_anomaly(session_id, payload)
            if M > 0:
                factors.append("mouse_anomaly")

        if event_type == EventType.COPY_PASTE:
            cp = self._score_copy_paste_password(payload)
            if cp > 0:
                factors.append("copy_paste_password")
            T = max(T, cp * 0.5)

        F = max(F, self._score_rapid_logins(session_id))
        D = max(
            self._score_new_device(payload),
            self._score_ip_change(payload),
            self._score_time_anomaly(payload) * 0.5,
            self._score_multi_tab(payload) * 0.5,
        )
        if self._score_new_device(payload) > 0:
            factors.append("new_device")
        if self._score_ip_change(payload) > 0:
            factors.append("ip_change")
        if self._score_time_anomaly(payload) > 0:
            factors.append("time_anomaly")
        if self._score_multi_tab(payload) > 0:
            factors.append("multi_tab")

        return T, M, F, min(1.0, D), factors

    def compute_risk(
        self,
        session_id: str,
        event_type: str,
        payload: dict,
        ml_score: Optional[float] = None,
    ) -> Tuple[float, List[str], float, float, Dict[str, float]]:
        """
        Risk formula: R = (w1*T + w2*M + w3*F + w4*D) * RULE_WEIGHT/100 + ml_score * ML_WEIGHT/25.
        Returns (risk_score 0-100, factors, trust_score, session_hijack_probability, component_scores for report).
        """
        T, M, F, D, factors = self.get_component_scores(session_id, event_type, payload)
        ml = (ml_score if ml_score is not None else 0.0)
        ml = max(0, min(1, ml))

        rule_part = (W1_TYPING * T + W2_MOUSE * M + W3_FAILED_LOGIN * F + W4_DEVICE * D)
        rule_part = min(1.0, rule_part)
        risk_score = (rule_part * RULE_WEIGHT) + (ml * ML_WEIGHT)
        risk_score = min(100.0, max(0.0, risk_score))

        events = self._get_or_init_session(session_id)
        events.append({"risk": risk_score, "ts": datetime.utcnow(), "factors": factors})
        cutoff = datetime.utcnow() - self.window
        self.session_events[session_id] = [e for e in events if e["ts"] > cutoff]
        recent_risks = [e["risk"] for e in self.session_events[session_id][-20:]]
        avg_risk = sum(recent_risks) / len(recent_risks) if recent_risks else risk_score
        risk_score = round(0.6 * risk_score + 0.4 * avg_risk, 1)
        risk_score = min(100.0, max(0.0, risk_score))

        self._decay_trust(session_id, risk_score / 20.0)
        if risk_score < 20:
            self._recover_trust(session_id)

        trust = self.trust_scores.get(session_id, 100.0)
        hijack_p = self._session_hijack_probability(risk_score, factors)

        component_scores = {
            "T_typing": T, "M_mouse": M, "F_failed_login": F, "D_device": D,
            "rule_part": rule_part, "ml_score": ml,
        }
        return round(risk_score, 1), factors, round(trust, 1), round(hijack_p, 2), component_scores

    def get_alert_level(self, risk_score: float) -> AlertLevel:
        if risk_score >= 75:
            return AlertLevel.CRITICAL
        if risk_score >= 50:
            return AlertLevel.HIGH
        if risk_score >= 25:
            return AlertLevel.MEDIUM
        return AlertLevel.LOW


risk_engine = RiskEngine()
