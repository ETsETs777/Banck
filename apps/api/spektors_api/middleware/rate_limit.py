"""Простой лимит частоты POST к чату / RAG / completions по IP и X-App-Id."""
from __future__ import annotations

import asyncio
import os
import time
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

_LIMITED_POST_PATHS = frozenset(
    {
        "/api/v1/chat",
        "/api/v1/rag/query",
        "/api/v1/chat/completions",
    }
)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    if request.client:
        return request.client.host
    return "unknown"


def _rate_limit_per_minute() -> int:
    raw = os.environ.get("RATE_LIMIT_PER_MINUTE", "120").strip()
    try:
        return max(0, int(raw))
    except ValueError:
        return 120


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Скользящее окно ~60 с; ключ ip + app_id. При RATE_LIMIT_PER_MINUTE=0 отключено."""

    def __init__(self, app):
        super().__init__(app)
        self._lock = asyncio.Lock()
        self._hits: dict[str, list[float]] = defaultdict(list)

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        limit = _rate_limit_per_minute()
        if (
            limit <= 0
            or request.method != "POST"
            or request.url.path not in _LIMITED_POST_PATHS
        ):
            return await call_next(request)

        ip = _client_ip(request)
        app_hdr = (request.headers.get("x-app-id") or "").strip() or "no_app"
        key = f"{ip}:{app_hdr}"
        now = time.monotonic()
        window = 60.0

        async with self._lock:
            bucket = self._hits[key]
            while bucket and bucket[0] < now - window:
                bucket.pop(0)
            if len(bucket) >= limit:
                retry = int(max(1, bucket[0] + window - now + 0.5)) if bucket else 60
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "rate_limit_exceeded",
                        "retry_after_sec": retry,
                    },
                    headers={"Retry-After": str(retry)},
                )
            bucket.append(now)

        return await call_next(request)
