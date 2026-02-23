import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Optional
from uuid import uuid4

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import io
import csv
import random
import string

from app.auth import create_access_token, decode_access_token, hash_password, verify_password
from app.config import settings
from app.database import (
    create_otp,
    create_user,
    get_activity_log as db_get_activity_log,
    get_ip_counts,
    get_risk_trend,
    get_user_by_email,
    get_user_by_id,
    get_user_by_username,
    get_known_fingerprints,
    get_session_ips,
    init_db,
    insert_activity,
    is_user_locked,
    lock_user,
    record_session_ip,
    record_user_device,
    update_user_verification,
    verify_otp,
)
from app.email_alerts import send_high_risk_alert
from app.image_scan import scan_image
from app.models import (
    ActivityLogEntry,
    AlertLevel,
    BehaviorEvent,
    EventType,
    LoginRequest,
    RegisterRequest,
    RiskAssessment,
    TokenResponse,
    UserProfileResponse,
)
from app.risk_engine import risk_engine
from app.anomaly import anomaly_detector
from app.verification import verify_email_domain, verify_email_format, verify_company_domain

connected_dashboards: list[WebSocket] = []
security = HTTPBearer(auto_error=False)
_baseline_update_count: dict = {}


def log_activity(
    session_id: str,
    event_type: str,
    description: str,
    risk_impact: float,
    alert_level: AlertLevel,
    metadata: dict,
    user_id: Optional[int] = None,
) -> ActivityLogEntry:
    entry_id = str(uuid4())
    insert_activity(
        id=entry_id,
        session_id=session_id,
        event_type=event_type,
        description=description,
        risk_impact=risk_impact,
        alert_level=alert_level.value,
        metadata=metadata,
        user_id=user_id,
    )
    return ActivityLogEntry(
        id=entry_id,
        session_id=session_id,
        event_type=event_type,
        description=description,
        risk_impact=risk_impact,
        alert_level=alert_level,
        timestamp=datetime.utcnow(),
        metadata=metadata,
    )


async def broadcast_to_dashboards(data: dict):
    for ws in connected_dashboards[:]:
        try:
            await ws.send_json(data)
        except Exception:
            connected_dashboards.remove(ws)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----- Health (for deployment / architecture verification) -----
@app.get("/api/health")
async def health():
    """Health check: confirms API is up. Used to verify architecture implementation."""
    try:
        # Lightweight DB check (init_db is idempotent; or just open a connection)
        from app.database import get_conn
        conn = get_conn()
        conn.execute("SELECT 1")
        conn.close()
        return {"status": "ok", "service": "SecureMind AI", "layers": ["api_gateway", "database"]}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {e}")


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[dict]:
    if not credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        return None
    user_id = int(payload["sub"])
    user = get_user_by_id(user_id)
    if not user:
        return None
    if is_user_locked(user_id):
        raise HTTPException(status_code=403, detail="Account temporarily locked. Try again later.")
    return user


async def get_current_user_required(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    user = await get_current_user_optional(credentials)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def require_roles(*allowed: str):
    async def _dep(current_user: dict = Depends(get_current_user_required)):
        role = current_user.get("role") or "user"
        if role not in allowed:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return _dep


# ----- Auth (Phase 2) -----


@app.post("/api/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    if not verify_email_format(req.email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    if get_user_by_email(req.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    username = (req.username or "").strip() or None
    if username and get_user_by_username(username):
        raise HTTPException(status_code=400, detail="Username already taken")
    user_id = create_user(
        req.email,
        hash_password(req.password),
        username=username,
        phone=(req.phone or "").strip() or None,
        company_name=(req.company_name or "").strip() or None,
        company_domain=(req.company_domain or "").strip() or None,
    )
    if not user_id:
        raise HTTPException(status_code=400, detail="Registration failed")
    user = get_user_by_id(user_id)
    token = create_access_token(
        data={
            "sub": str(user_id),
            "email": user["email"],
            "role": user.get("role", "user"),
            "username": user.get("username"),
        }
    )
    return TokenResponse(
        access_token=token,
        user_id=user_id,
        email=user["email"],
        username=user.get("username"),
    )


@app.post("/api/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    # Login with email or username
    identifier = (req.email or "").strip()
    user = get_user_by_email(identifier) if "@" in identifier else get_user_by_username(identifier)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email/username or password")
    if is_user_locked(user["id"]):
        raise HTTPException(status_code=403, detail="Account temporarily locked. Try again later.")
    token = create_access_token(
        data={
            "sub": str(user["id"]),
            "email": user["email"],
            "role": user.get("role", "user"),
            "username": user.get("username"),
        }
    )
    return TokenResponse(
        access_token=token,
        user_id=user["id"],
        email=user["email"],
        username=user.get("username"),
    )


# ----- Behavior & Risk (Phase 3–4) -----


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""


@app.post("/api/events", response_model=RiskAssessment)
async def ingest_behavior_event(
    request: Request,
    event: BehaviorEvent,
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    user_id = current_user["id"] if current_user else None
    client_ip = _get_client_ip(request)
    payload = dict(event.payload)

    # Device fingerprinting: new device if fingerprint not seen for this user
    fingerprint = (payload.get("device_fingerprint") or payload.get("fingerprint") or "").strip()[:64]
    if user_id and fingerprint:
        known = get_known_fingerprints(user_id)
        payload["new_device"] = fingerprint not in known
        record_user_device(user_id, fingerprint)
    else:
        payload["new_device"] = False

    # IP anomaly: IP change mid-session
    record_session_ip(event.session_id, client_ip or "unknown", user_id)
    session_ips = get_session_ips(event.session_id)
    payload["ip_change"] = len(session_ips) > 1

    # ML_Score: Isolation Forest + Z-score (fast path); baseline updated every 5th event to reduce latency
    event_for_ml = [{"event_type": event.event_type.value, "payload": payload}]
    ml_score = anomaly_detector.score_anomaly(event_for_ml, user_id)
    if user_id:
        _baseline_update_count[user_id] = _baseline_update_count.get(user_id, 0) + 1
        if _baseline_update_count[user_id] % 5 == 0:
            anomaly_detector.update_user_baseline(user_id, event_for_ml)

    risk_score, factors, trust_score, hijack_p, component_scores = risk_engine.compute_risk(
        event.session_id, event.event_type, payload, ml_score=ml_score
    )
    alert_level = risk_engine.get_alert_level(risk_score)

    desc_map = {
        EventType.TYPING: "Typing pattern analyzed",
        EventType.MOUSE: "Mouse movement recorded",
        EventType.LOGIN_ATTEMPT: "Login attempt",
        EventType.COPY_PASTE: "Copy-paste detected in password field",
        EventType.TAB_CHANGE: "Tab/session change",
        EventType.SESSION: "Session activity",
        EventType.IDLE: "Idle period",
        EventType.FOCUS: "Focus change",
    }
    description = desc_map.get(event.event_type, event.event_type)
    if factors:
        description += f" — Triggers: {', '.join(factors)}"

    metadata = {
        "factors": factors,
        "trust_score": trust_score,
        "hijack_probability": hijack_p,
        "component_scores": component_scores,
    }
    entry = log_activity(
        event.session_id,
        event.event_type.value,
        description,
        risk_score,
        alert_level,
        metadata,
        user_id=user_id,
    )

    requires_reauth = False
    account_locked_until = None
    if user_id and alert_level in (AlertLevel.HIGH, AlertLevel.CRITICAL):
        locked_until = datetime.utcnow() + timedelta(minutes=15)
        lock_user(user_id, locked_until, reason="high_risk")
        requires_reauth = True
        account_locked_until = locked_until.isoformat()
        user = get_user_by_id(user_id)
        if user and getattr(settings, "resend_api_key", None):
            asyncio.create_task(send_high_risk_alert(
                user["email"],
                risk_score,
                factors,
                locked_minutes=15,
                api_key=settings.resend_api_key,
                from_email=getattr(settings, "from_email", "alerts@securemind.local"),
            ))

    assessment = RiskAssessment(
        session_id=event.session_id,
        risk_score=risk_score,
        alert_level=alert_level,
        factors=factors,
        trust_score=trust_score,
        session_hijack_probability=hijack_p,
        requires_reauth=requires_reauth,
        account_locked_until=account_locked_until,
    )

    await broadcast_to_dashboards({"type": "risk_update", "payload": assessment.model_dump(mode="json")})
    await broadcast_to_dashboards({"type": "activity", "payload": entry.model_dump(mode="json")})
    return assessment


@app.post("/api/login_attempt")
async def record_login(session_id: str, success: bool = False):
    risk_engine.record_login_attempt(session_id, success)
    return {"ok": True}


# ----- Dashboard (Phase 5) — optional auth -----


@app.get("/api/activity", response_model=list[ActivityLogEntry])
async def get_activity_log(
    limit: int = 100,
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    user_id = current_user["id"] if current_user else None
    rows = db_get_activity_log(limit=limit, user_id=user_id)
    def parse_ts(s: str):
        s = (s or "").replace("Z", "+00:00").replace(" ", "T")
        try:
            return datetime.fromisoformat(s)
        except Exception:
            return datetime.utcnow()

    return [
        ActivityLogEntry(
            id=r["id"],
            session_id=r["session_id"],
            event_type=r["event_type"],
            description=r["description"],
            risk_impact=r["risk_impact"],
            alert_level=AlertLevel(r["alert_level"]),
            timestamp=parse_ts(r["timestamp"]),
            metadata=r.get("metadata") or {},
        )
        for r in rows
    ]


@app.get("/api/stats")
async def get_stats(current_user: Optional[dict] = Depends(get_current_user_optional)):
    user_id = current_user["id"] if current_user else None
    rows = db_get_activity_log(limit=1000, user_id=user_id)
    by_level = {}
    sessions = []
    for r in rows:
        by_level[r["alert_level"]] = by_level.get(r["alert_level"], 0) + 1
        sessions.append(r["session_id"])
    return {
        "total_events": len(rows),
        "by_alert_level": by_level,
        "sessions": list(set(sessions)),
    }


@app.get("/api/me", response_model=Optional[UserProfileResponse])
async def get_me(current_user: Optional[dict] = Depends(get_current_user_optional)):
    if not current_user:
        return None
    return UserProfileResponse(
        id=current_user["id"],
        email=current_user["email"],
        username=current_user.get("username"),
        phone=current_user.get("phone"),
        company_name=current_user.get("company_name"),
        company_domain=current_user.get("company_domain"),
        email_verified=current_user.get("email_verified", False),
        phone_verified=current_user.get("phone_verified", False),
        role=current_user.get("role", "user"),
    )


# ----- Email & company verification -----
@app.post("/api/verify/email")
async def verify_email(current_user: dict = Depends(get_current_user_required)):
    email = current_user.get("email") or ""
    if not verify_email_format(email):
        return {"verified": False, "message": "Invalid email format"}
    ok = verify_email_domain(email)
    update_user_verification(current_user["id"], email_verified=ok)
    return {"verified": ok, "message": "Email domain verified" if ok else "Domain could not be verified"}


@app.post("/api/verify/company")
async def verify_company(current_user: dict = Depends(get_current_user_required)):
    domain = (current_user.get("company_domain") or "").strip()
    if not domain:
        return {"verified": False, "message": "No company domain set"}
    ok = verify_company_domain(domain)
    return {"verified": ok, "message": "Company domain verified" if ok else "Domain could not be resolved"}


# ----- Image malware scan -----
@app.post("/api/scan/image")
async def scan_image_upload(
    file: UploadFile = File(...),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """Scan uploaded image for malware / suspicious content. Max 10 MB. Accepts JPEG, PNG, GIF, WebP."""
    try:
        content = await file.read()
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to read file")
    result = scan_image(content, file.filename or "")
    return {
        "safe": result["safe"],
        "message": result["message"],
        "detail": result.get("detail", ""),
        "filename": file.filename,
    }


# ----- OTP (MFA when high risk) -----
@app.post("/api/otp/request")
async def otp_request(current_user: dict = Depends(get_current_user_required)):
    code = "".join(random.choices(string.digits, k=6))
    expires = datetime.utcnow() + timedelta(minutes=10)
    create_otp(current_user["id"], code, expires)
    if getattr(settings, "debug", False):
        return {"message": "OTP generated (demo)", "code": code, "expires_in_minutes": 10}
    return {"message": "OTP sent to your email", "expires_in_minutes": 10}


@app.post("/api/otp/verify")
async def otp_verify(code: str, current_user: dict = Depends(get_current_user_required)):
    if verify_otp(current_user["id"], code):
        return {"verified": True}
    raise HTTPException(status_code=400, detail="Invalid or expired OTP")


# ----- Session hijack simulation (demo / lab only) -----
@app.post("/api/demo/session-hijack-simulation")
async def session_hijack_simulation(
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """For demonstration in lab: simulates a session-hijack scenario (IP change + new device + high risk)."""
    return {
        "message": "Simulation mode: trigger high risk by pasting in password field or multiple failed logins.",
        "triggers": ["paste_in_password", "rapid_failed_logins", "new_device", "ip_change"],
    }


# ----- Device & network context (IP, for dashboard) -----
@app.get("/api/context")
async def get_context(request: Request):
    """Returns client IP and request metadata for device/network panel. No auth required."""
    ip = _get_client_ip(request)
    return {
        "ip": ip or "unknown",
        "user_agent": request.headers.get("user-agent", "")[:200],
    }


# ----- Analytics (risk trend, IP heatmap) -----
@app.get("/api/analytics/risk_trend")
async def analytics_risk_trend(
    limit: int = 50,
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    user_id = current_user["id"] if current_user else None
    return get_risk_trend(limit=limit, user_id=user_id)


@app.get("/api/analytics/ip_heatmap")
async def analytics_ip_heatmap(
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    user_id = current_user["id"] if current_user else None
    return get_ip_counts(user_id=user_id)


# ----- Admin / Analyst (RBAC) -----
@app.get("/api/admin/stats")
async def admin_stats(current_user: dict = Depends(require_roles("admin", "analyst"))):
    """Aggregate stats across all users (Admin or Analyst role)."""
    rows = db_get_activity_log(limit=5000, user_id=None)
    by_level = {}
    sessions = []
    for r in rows:
        by_level[r["alert_level"]] = by_level.get(r["alert_level"], 0) + 1
        sessions.append(r["session_id"])
    return {
        "total_events": len(rows),
        "by_alert_level": by_level,
        "sessions": list(set(sessions)),
        "role": current_user.get("role"),
    }


# ----- Export (CSV / PDF) -----


@app.get("/api/export/activity")
async def export_activity(
    format: str = "csv",
    limit: int = 500,
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """Export activity log as CSV or PDF. Requires auth for user-scoped data."""
    user_id = current_user["id"] if current_user else None
    rows = db_get_activity_log(limit=limit, user_id=user_id)
    if format == "csv":
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["id", "session_id", "event_type", "description", "risk_impact", "alert_level", "timestamp"])
        for r in rows:
            w.writerow([
                r["id"], r["session_id"], r["event_type"], r["description"],
                r["risk_impact"], r["alert_level"], r["timestamp"],
            ])
        buf.seek(0)
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=securemind_activity.csv"},
        )
    if format == "pdf":
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import inch
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=letter, rightMargin=inch, leftMargin=inch, topMargin=inch, bottomMargin=inch)
        styles = getSampleStyleSheet()
        story = [Paragraph("SecureMind AI – Activity Export", styles["Title"]), Spacer(1, 12)]
        data = [["Time", "Session", "Event", "Risk", "Level", "Description"]]
        for r in rows[:100]:
            data.append([
                (r["timestamp"] or "")[:19],
                (r["session_id"] or "")[:12],
                r.get("event_type", ""),
                str(r.get("risk_impact", "")),
                r.get("alert_level", ""),
                (r.get("description", "") or "")[:40],
            ])
        t = Table(data, colWidths=[1.2 * inch, 1 * inch, 0.8 * inch, 0.5 * inch, 0.6 * inch, 2.2 * inch])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
            ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#0f172a")),
            ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor("#e2e8f0")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#334155")),
        ]))
        story.append(t)
        doc.build(story)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=securemind_activity.pdf"},
        )
    raise HTTPException(status_code=400, detail="format must be csv or pdf")


@app.websocket("/ws/dashboard")
async def dashboard_websocket(websocket: WebSocket):
    await websocket.accept()
    connected_dashboards.append(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        connected_dashboards.remove(websocket)


@app.get("/")
async def root():
    return {"app": settings.app_name, "version": "1.0.0"}
