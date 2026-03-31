"""RAG: Chroma + эмбеддинги Ollama."""
from __future__ import annotations

import asyncio
import os
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException

from spektors_api.integrations.chroma_client import get_chroma_http_client
from spektors_api.integrations.embed_ollama import ollama_embedding
from spektors_api.schemas import HealthRag, RagHit, RagQueryRequest, RagQueryResponse
from spektors_api.security.app_id import require_app_id

router = APIRouter(tags=["rag"])


@router.get(
    "/api/v1/health/rag",
    response_model=HealthRag,
    summary="Проверка Chroma",
    description="Требуется переменная окружения `CHROMA_URL` (например `http://chroma:8000`).",
)
async def health_rag() -> HealthRag:
    url = os.environ.get("CHROMA_URL", "").strip() or None
    client = get_chroma_http_client()
    if client is None:
        return HealthRag(
            ok=False,
            chroma_url=url,
            detail="chroma_url_not_set",
        )

    def ping() -> int:
        return client.heartbeat()

    try:
        await asyncio.to_thread(ping)
        return HealthRag(ok=True, chroma_url=url, detail=None)
    except Exception as e:
        return HealthRag(ok=False, chroma_url=url, detail=str(e)[:500])


def _normalize_chroma_query(results: dict[str, Any], collection: str) -> RagQueryResponse:
    ids = results.get("ids") or [[]]
    docs = results.get("documents") or [[]]
    metas = results.get("metadatas") or [[]]
    dists = results.get("distances") or [[]]
    row_ids = ids[0] if ids else []
    row_docs = docs[0] if docs else []
    row_meta = metas[0] if metas else []
    row_dist = dists[0] if dists else []
    hits: list[RagHit] = []
    for i, doc in enumerate(row_docs):
        if doc is None:
            continue
        rid = row_ids[i] if i < len(row_ids) else None
        meta = row_meta[i] if i < len(row_meta) and row_meta[i] else {}
        dist = row_dist[i] if i < len(row_dist) else None
        if not isinstance(meta, dict):
            meta = {}
        hits.append(
            RagHit(
                id=rid,
                document=str(doc),
                metadata=meta,
                distance=float(dist) if dist is not None else None,
            )
        )
    return RagQueryResponse(collection=collection, hits=hits)


@router.post(
    "/api/v1/rag/query",
    response_model=RagQueryResponse,
    summary="Поиск по коллекции RAG",
    description=(
        "**Заголовок `X-App-Id`** обязателен. "
        "Строит эмбеддинг запроса через Ollama (`OLLAMA_EMBED_MODEL`), "
        "затем поиск в коллекции `chroma_collection` из конфига приложения. "
        "Нужны `rag_enabled: true` и непустая коллекция в `apps.yaml`."
    ),
    responses={
        400: {"description": "Нет X-App-Id"},
        403: {"description": "RAG отключён для приложения (`rag_disabled`)"},
        404: {"description": "Ошибка коллекции Chroma"},
        502: {"description": "Сбой эмбеддинга Ollama или запроса к Chroma"},
        503: {"description": "Chroma не настроен или недоступен"},
        422: {"description": "Ошибка валидации query/top_k"},
    },
)
async def rag_query(
    body: RagQueryRequest,
    app: Annotated[dict, Depends(require_app_id)],
) -> RagQueryResponse:
    if not app.get("rag_enabled"):
        raise HTTPException(status_code=403, detail="rag_disabled")
    coll = (app.get("chroma_collection") or "").strip()
    if not coll:
        raise HTTPException(status_code=503, detail="chroma_collection_not_configured")

    client = get_chroma_http_client()
    if client is None:
        raise HTTPException(status_code=503, detail="chroma_unavailable")

    try:
        embedding = await ollama_embedding(body.query)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    def run_query() -> dict[str, Any]:
        try:
            collection = client.get_collection(name=coll)
        except Exception as e:
            raise LookupError(str(e)) from e
        return collection.query(
            query_embeddings=[embedding],
            n_results=body.top_k,
            include=["documents", "metadatas", "distances"],
        )

    try:
        raw = await asyncio.to_thread(run_query)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=f"collection_error: {e!s}") from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"chroma_query_failed: {e!s}") from e

    return _normalize_chroma_query(raw, coll)
