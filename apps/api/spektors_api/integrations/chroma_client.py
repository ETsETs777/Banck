"""HTTP-клиент Chroma (если задан `CHROMA_URL`)."""
from __future__ import annotations

import os
from typing import TYPE_CHECKING, Any
from urllib.parse import urlparse

if TYPE_CHECKING:
    pass

_client: Any = None


def get_chroma_http_client() -> Any | None:
    """Singleton HttpClient или None, если RAG не сконфигурирован."""
    global _client
    raw = os.environ.get("CHROMA_URL", "").strip()
    if not raw:
        return None
    if _client is not None:
        return _client
    import chromadb

    p = urlparse(raw)
    host = p.hostname or "127.0.0.1"
    port = p.port or (443 if p.scheme == "https" else 8000)
    if p.scheme == "https":
        _client = chromadb.HttpClient(host=host, port=port, ssl=True)
    else:
        _client = chromadb.HttpClient(host=host, port=port)
    return _client


def reset_chroma_client_for_tests() -> None:
    global _client
    _client = None
