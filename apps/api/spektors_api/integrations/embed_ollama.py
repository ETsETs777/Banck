"""Эмбеддинги через Ollama `/api/embeddings`."""
from __future__ import annotations

import os

import httpx

from spektors_api.integrations.ollama_http import get_ollama_http


def default_embed_model() -> str:
    return os.environ.get("OLLAMA_EMBED_MODEL", "nomic-embed-text")


async def ollama_embedding(text: str, model: str | None = None) -> list[float]:
    m = (model or "").strip() or default_embed_model()
    client = get_ollama_http()
    try:
        r = await client.post("/api/embeddings", json={"model": m, "prompt": text})
    except httpx.RequestError as e:
        raise RuntimeError(f"ollama_embed_unreachable: {e}") from e
    if r.status_code != 200:
        raise RuntimeError(f"ollama_embed_http_{r.status_code}: {r.text[:500]}")
    data = r.json()
    emb = data.get("embedding")
    if not isinstance(emb, list) or not emb:
        raise RuntimeError("ollama_embed_invalid_response")
    return [float(x) for x in emb]
