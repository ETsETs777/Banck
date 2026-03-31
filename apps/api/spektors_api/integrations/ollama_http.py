"""Общий async HTTP-клиент к Ollama: keep-alive и пул соединений."""
from __future__ import annotations

import httpx

from spektors_api.integrations.ollama_common import llm_base

_client: httpx.AsyncClient | None = None


async def open_ollama_http() -> None:
    global _client
    if _client is not None:
        return
    base = llm_base().rstrip("/")
    _client = httpx.AsyncClient(
        base_url=base,
        timeout=httpx.Timeout(120.0, connect=15.0),
        limits=httpx.Limits(max_keepalive_connections=32, max_connections=100),
    )


async def close_ollama_http() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def get_ollama_http() -> httpx.AsyncClient:
    if _client is None:
        raise RuntimeError("Ollama HTTP client not initialized (lifespan)")
    return _client
