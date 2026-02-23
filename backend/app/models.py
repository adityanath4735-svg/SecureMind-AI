from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class AlertLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class EventType(str, Enum):
    TYPING = "typing"
    MOUSE = "mouse"
    LOGIN_ATTEMPT = "login_attempt"
    COPY_PASTE = "copy_paste"
    TAB_CHANGE = "tab_change"
    SESSION = "session"
    IDLE = "idle"
    FOCUS = "focus"


# Incoming behavior events from frontend
class BehaviorEvent(BaseModel):
    event_type: EventType
    session_id: str
    user_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    payload: dict[str, Any] = Field(default_factory=dict)


# Typing-specific payload
class TypingPayload(BaseModel):
    keystroke_interval_ms: Optional[float] = None
    words_per_minute: Optional[float] = None
    backspace_ratio: Optional[float] = None
    field_type: Optional[str] = None  # "password", "email", "username"
    stress_indicator: Optional[float] = None  # variance in typing speed


# Mouse payload
class MousePayload(BaseModel):
    x: float
    y: float
    movement_speed: Optional[float] = None
    movement_angle: Optional[float] = None
    click_count: int = 0


# Risk assessment result
class RiskAssessment(BaseModel):
    session_id: str
    risk_score: float  # 0-100
    alert_level: AlertLevel
    factors: list[str] = Field(default_factory=list)
    trust_score: float = 100.0  # decays with suspicious activity
    session_hijack_probability: float = 0.0
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    requires_reauth: bool = False  # when True, frontend should force re-login
    account_locked_until: Optional[str] = None  # ISO datetime if temporarily locked


# Activity log for dashboard
class ActivityLogEntry(BaseModel):
    id: str
    session_id: str
    event_type: str
    description: str
    risk_impact: float
    alert_level: AlertLevel
    timestamp: datetime
    metadata: dict[str, Any] = Field(default_factory=dict)


# Auth request/response
class RegisterRequest(BaseModel):
    email: str
    password: str
    username: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    company_domain: Optional[str] = None


class LoginRequest(BaseModel):
    email: str  # can be email or username
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str
    username: Optional[str] = None


class UserProfileResponse(BaseModel):
    id: int
    email: str
    username: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    company_domain: Optional[str] = None
    email_verified: bool = False
    phone_verified: bool = False
    role: str = "user"
