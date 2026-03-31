"""Поведение INTERNAL_AUTH_STRICT и открытого режима без токена."""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from spektors_api.security import internal_auth


def test_strict_without_token_returns_503(monkeypatch):
    monkeypatch.setenv("INTERNAL_AUTH_STRICT", "1")
    monkeypatch.delenv("INTERNAL_ADMIN_TOKEN", raising=False)
    with pytest.raises(HTTPException) as ei:
        internal_auth._check_bearer(None, "INTERNAL_ADMIN_TOKEN", "admin")
    assert ei.value.status_code == 503
    assert ei.value.detail == "internal_auth_not_configured"


def test_no_strict_no_token_allows(monkeypatch):
    monkeypatch.delenv("INTERNAL_AUTH_STRICT", raising=False)
    monkeypatch.delenv("INTERNAL_ADMIN_TOKEN", raising=False)
    internal_auth._check_bearer(None, "INTERNAL_ADMIN_TOKEN", "admin")
