"""Optional email alerts on high risk (Resend API)."""
from __future__ import annotations

# Resend API: https://resend.com/docs/api-reference/emails/send-email
RESEND_URL = "https://api.resend.com/emails"


async def send_high_risk_alert(
    to_email: str,
    risk_score: float,
    factors: list,
    locked_minutes: int = 15,
    api_key: str = "",
    from_email: str = "alerts@securemind.local",
) -> bool:
    """Send alert email when account is locked due to high risk. Returns True if sent."""
    if not api_key:
        return False
    body = (
        f"SecureMind AI Security Alert\n\n"
        f"High risk activity was detected on your account.\n\n"
        f"Risk score: {risk_score:.0f}\n"
        f"Factors: {', '.join(factors) or 'N/A'}\n\n"
        f"Your account has been temporarily locked for {locked_minutes} minutes. "
        f"Please sign in again after the lockout period.\n\n"
        f"— SecureMind AI"
    )
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            r = await client.post(
                RESEND_URL,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "from": from_email,
                    "to": [to_email],
                    "subject": "SecureMind AI: High risk detected – account temporarily locked",
                    "text": body,
                },
                timeout=10.0,
            )
            return r.status_code == 200
    except Exception:
        return False
