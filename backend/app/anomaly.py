"""
ML-based anomaly detection for behavioral features (research-based).
- Isolation Forest
- Z-score deviation
- Time-series anomaly (rolling deviation)
- User baseline profiling (normal behavior profile per user; compare session to baseline)
"""
from __future__ import annotations

import math
from collections import deque
from typing import Any, Dict, List, Optional

import numpy as np
from sklearn.ensemble import IsolationForest

FEATURE_HISTORY_LEN = 100
BASELINE_MIN_SAMPLES = 20


class BehavioralAnomalyDetector:
    """Isolation Forest + Z-score + time-series + per-user baseline."""

    def __init__(self, contamination: float = 0.1):
        self.contamination = contamination
        self.model: Optional[IsolationForest] = None
        self.feature_history: List[List[float]] = []
        self._fitted = False
        self.user_baselines: Dict[int, List[List[float]]] = {}

    def _extract_features(self, events: List[Dict]) -> List[float]:
        typing_intervals = []
        mouse_speeds = []
        for e in events:
            p = e.get("payload", {})
            if p.get("keystroke_interval_ms") is not None:
                typing_intervals.append(float(p["keystroke_interval_ms"]))
            if p.get("movement_speed") is not None:
                mouse_speeds.append(float(p["movement_speed"]))
        mean_typing = float(np.mean(typing_intervals)) if typing_intervals else 0.0
        std_typing = float(np.std(typing_intervals)) if len(typing_intervals) > 1 else 0.0
        mean_mouse = float(np.mean(mouse_speeds)) if mouse_speeds else 0.0
        login_c = sum(1 for e in events if e.get("event_type") == "login_attempt")
        return [mean_typing, std_typing, mean_mouse, float(login_c)]

    def _zscore_anomaly(self, feats: List[float], history: List[List[float]]) -> float:
        """Z-score deviation: how many std devs the current vector is from history mean."""
        if len(history) < 5:
            return 0.0
        arr = np.array(history)
        mean = np.mean(arr, axis=0)
        std = np.std(arr, axis=0)
        std[std < 1e-6] = 1e-6
        z = np.abs((np.array(feats) - mean) / std)
        return float(min(1.0, np.mean(z) / 3.0))

    def _timeseries_anomaly(self, feats: List[float], history: List[List[float]]) -> float:
        """Rolling deviation: compare to recent window (time-series)."""
        if len(history) < 10:
            return 0.0
        recent = np.array(history[-15:])
        mean = np.mean(recent, axis=0)
        diff = np.abs(np.array(feats) - mean)
        return float(min(1.0, np.mean(diff) / (np.mean(recent) + 1e-6) / 2.0))

    def add_sample(self, events: List[Dict]) -> None:
        feats = self._extract_features(events)
        self.feature_history.append(feats)
        if len(self.feature_history) > FEATURE_HISTORY_LEN:
            self.feature_history.pop(0)

    def update_user_baseline(self, user_id: int, events: List[Dict]) -> None:
        """Append to user's normal behavior profile (for adaptive per-user detection)."""
        feats = self._extract_features(events)
        if user_id not in self.user_baselines:
            self.user_baselines[user_id] = []
        self.user_baselines[user_id].append(feats)
        if len(self.user_baselines[user_id]) > 200:
            self.user_baselines[user_id].pop(0)

    def fit(self, events_list: List[List[Dict]]) -> None:
        X = np.array([self._extract_features(evs) for evs in events_list])
        if len(X) < 10:
            return
        self.model = IsolationForest(contamination=self.contamination, random_state=42)
        self.model.fit(X)
        self._fitted = True

    def score_anomaly(
        self,
        events: List[Dict],
        user_id: Optional[int] = None,
    ) -> float:
        """
        Combined anomaly score [0, 1]: Isolation Forest + Z-score + time-series + user baseline.
        Higher = more anomalous.
        """
        feats = self._extract_features(events)
        self.add_sample(events)

        scores = []

        if self._fitted and self.model is not None:
            pred = self.model.decision_function([feats])[0]
            min_d, max_d = -0.2, 0.2
            normalized = (pred - min_d) / (max_d - min_d) if max_d > min_d else 0.5
            if_score = float(np.clip(1.0 - normalized, 0, 1))
            scores.append(if_score)

        if len(self.feature_history) >= 5:
            z = self._zscore_anomaly(feats, self.feature_history)
            scores.append(z)
        if len(self.feature_history) >= 10:
            ts = self._timeseries_anomaly(feats, self.feature_history)
            scores.append(ts)

        if user_id is not None and user_id in self.user_baselines and len(self.user_baselines[user_id]) >= BASELINE_MIN_SAMPLES:
            base = self.user_baselines[user_id]
            dev = self._zscore_anomaly(feats, base)
            scores.append(dev)

        if not scores:
            return 0.0
        return float(min(1.0, sum(scores) / len(scores) * 1.2))


anomaly_detector = BehavioralAnomalyDetector()
