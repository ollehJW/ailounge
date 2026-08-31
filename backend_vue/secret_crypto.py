from __future__ import annotations

import base64
import hashlib
import os
import re

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_ENCRYPTED_VALUE = re.compile(r"^ENC\(([^()]+)\)$")
_IV_LENGTH = 12
_TAG_LENGTH = 16


def _derive_key(crypt_key: str) -> bytes:
    if not crypt_key:
        raise RuntimeError("DB_CRYPT_KEY is required for an encrypted database password")
    return hashlib.sha256(crypt_key.encode("utf-8")).digest()


def encrypt_value(value: str, crypt_key: str) -> str:
    iv = os.urandom(_IV_LENGTH)
    encrypted = AESGCM(_derive_key(crypt_key)).encrypt(iv, value.encode("utf-8"), None)
    ciphertext, tag = encrypted[:-_TAG_LENGTH], encrypted[-_TAG_LENGTH:]
    encoded = base64.b64encode(iv + tag + ciphertext).decode("ascii")
    return f"ENC({encoded})"


def decrypt_value(value: str, crypt_key: str | None) -> str:
    match = _ENCRYPTED_VALUE.fullmatch(value.strip())
    if match is None:
        return value
    try:
        payload = base64.b64decode(match.group(1), validate=True)
        if len(payload) <= _IV_LENGTH + _TAG_LENGTH:
            raise ValueError("encrypted payload is too short")
        iv = payload[:_IV_LENGTH]
        tag = payload[_IV_LENGTH : _IV_LENGTH + _TAG_LENGTH]
        ciphertext = payload[_IV_LENGTH + _TAG_LENGTH :]
        plaintext = AESGCM(_derive_key(crypt_key or "")).decrypt(iv, ciphertext + tag, None)
        return plaintext.decode("utf-8")
    except (InvalidTag, UnicodeDecodeError, ValueError) as exc:
        raise RuntimeError("Failed to decrypt DB_PASSWORD") from exc
