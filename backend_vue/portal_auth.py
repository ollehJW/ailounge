from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any


class PortalTokenError(ValueError):
    pass


def _decode_segment(segment: str) -> bytes:
    try:
        padding = "=" * (-len(segment) % 4)
        return base64.urlsafe_b64decode(segment + padding)
    except (ValueError, TypeError) as exc:
        raise PortalTokenError("토큰 형식이 올바르지 않습니다.") from exc


def verify_portal_access_token(token: str, *, now: float | None = None) -> dict[str, Any]:
    secret = os.getenv("PORTAL_JWT_SECRET", "")
    if not secret:
        raise RuntimeError("PORTAL_JWT_SECRET must be provided through backend/.env")

    parts = token.split(".")
    if len(parts) != 3 or not all(parts):
        raise PortalTokenError("토큰 형식이 올바르지 않습니다.")

    header_segment, payload_segment, signature_segment = parts
    try:
        header = json.loads(_decode_segment(header_segment))
        payload = json.loads(_decode_segment(payload_segment))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise PortalTokenError("토큰 형식이 올바르지 않습니다.") from exc
    if not isinstance(header, dict) or not isinstance(payload, dict):
        raise PortalTokenError("토큰 형식이 올바르지 않습니다.")
    if header.get("alg") != "HS256":
        raise PortalTokenError("허용되지 않은 토큰 서명 방식입니다.")

    signing_input = f"{header_segment}.{payload_segment}".encode("ascii")
    expected_signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    actual_signature = _decode_segment(signature_segment)
    if not hmac.compare_digest(expected_signature, actual_signature):
        raise PortalTokenError("토큰 서명이 올바르지 않습니다.")

    current_time = time.time() if now is None else now
    try:
        expires_at = float(payload["exp"])
        not_before = float(payload["nbf"]) if "nbf" in payload else None
    except (KeyError, TypeError, ValueError) as exc:
        raise PortalTokenError("토큰 만료 정보가 올바르지 않습니다.") from exc
    if current_time >= expires_at:
        raise PortalTokenError("로그인 토큰이 만료되었습니다.")
    if not_before is not None and current_time < not_before:
        raise PortalTokenError("아직 사용할 수 없는 토큰입니다.")

    user_id = str(payload.get("user_id") or "").strip()
    subject = str(payload.get("sub") or "").strip()
    if not user_id or not subject or not hmac.compare_digest(user_id, subject):
        raise PortalTokenError("토큰 사용자 정보가 올바르지 않습니다.")
    return payload
