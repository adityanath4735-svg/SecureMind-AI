"""
Email and company domain verification helpers.
"""
from __future__ import annotations

import re
import socket
from typing import Tuple


# Basic email format (RFC 5322 simplified)
EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


def verify_email_format(email: str) -> bool:
    if not email or not isinstance(email, str):
        return False
    return bool(EMAIL_RE.match(email.strip()))


def verify_email_domain(email: str) -> bool:
    """Check that the domain has MX or A record (domain exists)."""
    if not verify_email_format(email):
        return False
    try:
        domain = email.strip().split("@")[-1]
        if not domain:
            return False
        # Try MX first, then A
        try:
            socket.getaddrinfo(domain, None)
            return True
        except socket.gaierror:
            pass
        socket.gethostbyname(domain)
        return True
    except Exception:
        return False


def verify_company_domain(domain: str) -> bool:
    """Check that company domain resolves (has A or AAAA record)."""
    if not domain or not isinstance(domain, str):
        return False
    domain = domain.strip().lower()
    # Remove protocol if present
    for prefix in ("https://", "http://", "www."):
        if domain.startswith(prefix):
            domain = domain[len(prefix) :]
    domain = domain.split("/")[0].strip()
    if not domain:
        return False
    try:
        socket.gethostbyname(domain)
        return True
    except socket.gaierror:
        return False


def verify_phone_format(phone: str) -> bool:
    """Basic E.164-ish: digits, optional + at start, 10–15 digits."""
    if not phone or not isinstance(phone, str):
        return False
    cleaned = re.sub(r"[\s\-\(\)]", "", phone.strip())
    if cleaned.startswith("+"):
        cleaned = cleaned[1:]
    return bool(re.match(r"^\d{10,15}$", cleaned))
