"""Сравнение API-токенов без утечки по времени."""
from __future__ import annotations

import hashlib
import hmac


def constant_time_api_token_eq(received: str, expected: str) -> bool:
    """SHA-256 + hmac.compare_digest по дайджестам строк."""
    if not received or not expected:
        return False
    dr = hashlib.sha256(received.encode("utf-8")).digest()
    de = hashlib.sha256(expected.encode("utf-8")).digest()
    return hmac.compare_digest(dr, de)
