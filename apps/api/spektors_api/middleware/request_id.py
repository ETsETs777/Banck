"""Проброс X-Request-ID для корреляции логов клиент ↔ API."""
from __future__ import annotations

import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

_HEADER = "X-Request-ID"


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        incoming = request.headers.get(_HEADER)
        rid = (
            incoming.strip()
            if incoming and incoming.strip()
            else uuid.uuid4().hex
        )
        request.state.request_id = rid
        response = await call_next(request)
        response.headers[_HEADER] = rid
        return response
