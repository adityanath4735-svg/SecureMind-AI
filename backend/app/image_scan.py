"""
Lightweight image/file scan for malware detection.
Checks magic bytes, type, size. Production would integrate VirusTotal or ClamAV.
"""
from __future__ import annotations

# Magic bytes for common image types (first few bytes)
IMAGE_SIGNATURES = [
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
    (b"RIFF", "image/webp"),  # WEBP starts with RIFF....WEBP
]
MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_SIZE_MB = 10


def scan_image(content: bytes, filename: str = "") -> dict:
    """
    Scan image content. Returns dict with keys: safe (bool), message (str), detail (str).
    """
    if not content:
        return {"safe": False, "message": "No file content", "detail": "empty"}
    if len(content) > MAX_SIZE_BYTES:
        return {
            "safe": False,
            "message": f"File too large (max {MAX_SIZE_MB} MB)",
            "detail": "size_limit",
        }
    # Check magic bytes
    detected = None
    for sig, mime in IMAGE_SIGNATURES:
        if content.startswith(sig):
            detected = mime
            break
    if not detected:
        # Check for WEBP (RIFF....WEBP)
        if content[:4] == b"RIFF" and len(content) >= 12 and content[8:12] == b"WEBP":
            detected = "image/webp"
        else:
            return {
                "safe": False,
                "message": "Not a supported image (use JPEG, PNG, GIF, or WebP)",
                "detail": "invalid_type",
            }
    # Basic heuristic: executable-like content inside image (steganography / polyglot risk)
    if b"<?php" in content or b"<script" in content[:5000]:
        return {
            "safe": False,
            "message": "Suspicious content detected in file",
            "detail": "suspicious_content",
        }
    return {
        "safe": True,
        "message": "No threats detected",
        "detail": f"type={detected}",
    }
