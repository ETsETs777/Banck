"""Защита маршрутов `/internal/*` через Bearer (опционально)."""
from __future__ import annotations

import os
from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from spektors_api.security.tokens import constant_time_api_token_eq

_internal_bearer = HTTPBearer(auto_error=False)


def _internal_auth_strict() -> bool:
    """В проде задайте `INTERNAL_AUTH_STRICT=1` и оба токена — иначе internal вернёт 503."""
    return os.environ.get("INTERNAL_AUTH_STRICT", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def _check_bearer(
    cred: HTTPAuthorizationCredentials | None,
    env_name: str,
    role: str,
) -> None:
    expected = os.environ.get(env_name, "").strip()
    if _internal_auth_strict() and not expected:
        raise HTTPException(
            status_code=503,
            detail="internal_auth_not_configured",
        )
    if not expected:
        return
    if cred is None or cred.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail=f"bearer_required_for_{role}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not constant_time_api_token_eq(cred.credentials, expected):
        raise HTTPException(status_code=403, detail="invalid_token")


async def require_internal_admin(
    cred: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(_internal_bearer),
    ] = None,
) -> None:
    _check_bearer(cred, "INTERNAL_ADMIN_TOKEN", "admin")


async def require_internal_dev(
    cred: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(_internal_bearer),
    ] = None,
) -> None:
    _check_bearer(cred, "INTERNAL_DEV_TOKEN", "dev")
