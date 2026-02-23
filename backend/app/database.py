"""
SQLite database for users, activity logs, and account locks.
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Generator, Optional

# Default path relative to backend/
DB_PATH = Path(__file__).resolve().parent.parent / "securemind.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def db_cursor() -> Generator[sqlite3.Cursor, None, None]:
    conn = get_conn()
    try:
        cur = conn.cursor()
        yield cur
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with db_cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                role TEXT DEFAULT 'user'
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS activity_logs (
                id TEXT PRIMARY KEY,
                user_id INTEGER,
                session_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                description TEXT NOT NULL,
                risk_impact REAL NOT NULL,
                alert_level TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                metadata TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS user_locks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                locked_until TEXT NOT NULL,
                reason TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_activity_ts ON activity_logs(timestamp)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_locks_user ON user_locks(user_id)")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS user_devices (
                user_id INTEGER NOT NULL,
                fingerprint_hash TEXT NOT NULL,
                first_seen TEXT NOT NULL,
                PRIMARY KEY (user_id, fingerprint_hash),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS session_ips (
                session_id TEXT NOT NULL,
                user_id INTEGER,
                ip TEXT NOT NULL,
                first_seen TEXT NOT NULL,
                PRIMARY KEY (session_id, ip),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        for col, default in [
            ("role", "'user'"),
            ("username", "NULL"),
            ("phone", "NULL"),
            ("company_name", "NULL"),
            ("company_domain", "NULL"),
            ("email_verified", "0"),
            ("phone_verified", "0"),
        ]:
            try:
                cur.execute(f"ALTER TABLE users ADD COLUMN {col} TEXT DEFAULT {default}")
            except sqlite3.OperationalError:
                pass
        try:
            cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)")
        except Exception:
            pass
        cur.execute("""
            CREATE TABLE IF NOT EXISTS otp_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                code TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                used INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)


def create_user(
    email: str,
    password_hash: str,
    role: str = "user",
    username: Optional[str] = None,
    phone: Optional[str] = None,
    company_name: Optional[str] = None,
    company_domain: Optional[str] = None,
) -> Optional[int]:
    with db_cursor() as cur:
        try:
            cur.execute(
                """INSERT INTO users (email, password_hash, created_at, role, username, phone, company_name, company_domain)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    email,
                    password_hash,
                    datetime.utcnow().isoformat(),
                    role,
                    (username or "").strip() or None,
                    (phone or "").strip() or None,
                    (company_name or "").strip() or None,
                    (company_domain or "").strip() or None,
                ),
            )
            return cur.lastrowid
        except sqlite3.IntegrityError:
            return None


USER_COLS = "id, email, password_hash, created_at, role, username, phone, company_name, company_domain, email_verified, phone_verified"


def get_user_by_email(email: str) -> Optional[dict[str, Any]]:
    with db_cursor() as cur:
        cur.execute(f"SELECT {USER_COLS} FROM users WHERE email = ?", (email,))
        row = cur.fetchone()
        if not row:
            return None
        d = _row_to_user(row)
        return d


def get_user_by_username(username: str) -> Optional[dict[str, Any]]:
    if not (username or "").strip():
        return None
    with db_cursor() as cur:
        cur.execute(f"SELECT {USER_COLS} FROM users WHERE username = ?", (username.strip(),))
        row = cur.fetchone()
        if not row:
            return None
        return _row_to_user(row)


def _row_to_user(row) -> dict[str, Any]:
    d = dict(zip(row.keys(), row))
    if "role" not in d:
        d["role"] = "user"
    for k in ("email_verified", "phone_verified"):
        if k in d and d[k] is not None:
            d[k] = str(d[k]).lower() in ("1", "true", "yes")
        else:
            d[k] = False
    return d


def get_user_by_id(user_id: int) -> Optional[dict[str, Any]]:
    with db_cursor() as cur:
        cur.execute(f"SELECT {USER_COLS} FROM users WHERE id = ?", (user_id,))
        row = cur.fetchone()
        if not row:
            return None
        return _row_to_user(row)


def update_user_verification(user_id: int, email_verified: Optional[bool] = None, phone_verified: Optional[bool] = None) -> None:
    with db_cursor() as cur:
        if email_verified is not None:
            cur.execute("UPDATE users SET email_verified = ? WHERE id = ?", (1 if email_verified else 0, user_id))
        if phone_verified is not None:
            cur.execute("UPDATE users SET phone_verified = ? WHERE id = ?", (1 if phone_verified else 0, user_id))


def insert_activity(
    id: str,
    session_id: str,
    event_type: str,
    description: str,
    risk_impact: float,
    alert_level: str,
    metadata: dict,
    user_id: Optional[int] = None,
) -> None:
    meta_str = json.dumps(metadata) if metadata else "{}"
    with db_cursor() as cur:
        cur.execute(
            """INSERT INTO activity_logs
             (id, user_id, session_id, event_type, description, risk_impact, alert_level, timestamp, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (id, user_id, session_id, event_type, description, risk_impact, alert_level, datetime.utcnow().isoformat(), meta_str),
        )


def get_activity_log(limit: int = 100, user_id: Optional[int] = None) -> list[dict[str, Any]]:
    with db_cursor() as cur:
        if user_id is not None:
            cur.execute(
                """SELECT id, session_id, event_type, description, risk_impact, alert_level, timestamp, metadata
                   FROM activity_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?""",
                (user_id, limit),
            )
        else:
            cur.execute(
                """SELECT id, session_id, event_type, description, risk_impact, alert_level, timestamp, metadata
                   FROM activity_logs ORDER BY timestamp DESC LIMIT ?""",
                (limit,),
            )
        rows = cur.fetchall()
    out = []
    for r in rows:
        d = dict(zip(r.keys(), r))
        if d.get("metadata"):
            try:
                d["metadata"] = json.loads(d["metadata"])
            except Exception:
                d["metadata"] = {}
        else:
            d["metadata"] = {}
        out.append(d)
    return out


def lock_user(user_id: int, locked_until: datetime, reason: str = "high_risk") -> None:
    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO user_locks (user_id, locked_until, reason, created_at) VALUES (?, ?, ?, ?)",
            (user_id, locked_until.isoformat(), reason, datetime.utcnow().isoformat()),
        )


def is_user_locked(user_id: int) -> bool:
    now = datetime.utcnow().isoformat()
    with db_cursor() as cur:
        cur.execute(
            "SELECT 1 FROM user_locks WHERE user_id = ? AND locked_until > ? ORDER BY id DESC LIMIT 1",
            (user_id, now),
        )
        return cur.fetchone() is not None


# ----- Device fingerprinting -----
def record_user_device(user_id: int, fingerprint_hash: str) -> None:
    with db_cursor() as cur:
        cur.execute(
            "INSERT OR IGNORE INTO user_devices (user_id, fingerprint_hash, first_seen) VALUES (?, ?, ?)",
            (user_id, fingerprint_hash, datetime.utcnow().isoformat()),
        )


def get_known_fingerprints(user_id: int) -> list[str]:
    with db_cursor() as cur:
        cur.execute("SELECT fingerprint_hash FROM user_devices WHERE user_id = ?", (user_id,))
        rows = cur.fetchall()
    return [r[0] for r in rows] if rows else []


# ----- IP tracking -----
def record_session_ip(session_id: str, ip: str, user_id: Optional[int] = None) -> None:
    with db_cursor() as cur:
        cur.execute(
            "INSERT OR IGNORE INTO session_ips (session_id, user_id, ip, first_seen) VALUES (?, ?, ?, ?)",
            (session_id, user_id, ip, datetime.utcnow().isoformat()),
        )


def get_session_ips(session_id: str) -> list[str]:
    with db_cursor() as cur:
        cur.execute("SELECT DISTINCT ip FROM session_ips WHERE session_id = ?", (session_id,))
        rows = cur.fetchall()
    return [r[0] for r in rows] if rows else []


# ----- OTP (MFA on high risk) -----
def create_otp(user_id: int, code: str, expires_at: datetime) -> None:
    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO otp_codes (user_id, code, expires_at, used, created_at) VALUES (?, ?, ?, 0, ?)",
            (user_id, code, expires_at.isoformat(), datetime.utcnow().isoformat()),
        )


def get_risk_trend(limit: int = 50, user_id: Optional[int] = None) -> list:
    with db_cursor() as cur:
        if user_id is not None:
            cur.execute(
                "SELECT timestamp, risk_impact FROM activity_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?",
                (user_id, limit),
            )
        else:
            cur.execute(
                "SELECT timestamp, risk_impact FROM activity_logs ORDER BY timestamp DESC LIMIT ?",
                (limit,),
            )
        rows = cur.fetchall()
    return [{"timestamp": r[0], "risk": r[1]} for r in rows]


def get_ip_counts(user_id: Optional[int] = None) -> list:
    with db_cursor() as cur:
        if user_id is not None:
            cur.execute(
                "SELECT ip, COUNT(DISTINCT session_id) as cnt FROM session_ips WHERE user_id = ? GROUP BY ip",
                (user_id,),
            )
        else:
            cur.execute("SELECT ip, COUNT(DISTINCT session_id) as cnt FROM session_ips GROUP BY ip")
        rows = cur.fetchall()
    return [{"ip": r[0], "count": r[1]} for r in rows]


def verify_otp(user_id: int, code: str) -> bool:
    now = datetime.utcnow().isoformat()
    with db_cursor() as cur:
        cur.execute(
            "SELECT id FROM otp_codes WHERE user_id = ? AND code = ? AND expires_at > ? AND used = 0",
            (user_id, code, now),
        )
        row = cur.fetchone()
        if not row:
            return False
        otp_id = row[0] if hasattr(row, "__getitem__") else row["id"]
        cur.execute("UPDATE otp_codes SET used = 1 WHERE id = ?", (otp_id,))
    return True
