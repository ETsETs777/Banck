"""
Прокси к Ollama (OpenAI-совместимый /v1/chat/completions) + проверка доступности.
"""
from __future__ import annotations

import json
from typing import Annotated, Any, AsyncIterator

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

from spektors_api.integrations.ollama_common import llm_base, model_for_app
from spektors_api.integrations.ollama_http import get_ollama_http
from spektors_api.schemas import HealthLlm
from spektors_api.security.app_id import require_app_id

router = APIRouter(tags=["llm"])

_CHAT_COMPLETIONS_OPENAPI_EXTRA = {
    "requestBody": {
        "required": True,
        "content": {
            "application/json": {
                "schema": {
                    "type": "object",
                    "required": ["messages"],
                    "description": (
                        "Формат OpenAI Chat Completions. Заголовок **X-App-Id** обязателен (Authorize в Swagger). "
                        "Поле **model** в теле **игнорируется** — подставляется из `ollama_model` приложения в "
                        "`config/apps.yaml` (или `DEFAULT_OLLAMA_MODEL`)."
                    ),
                    "properties": {
                        "messages": {
                            "type": "array",
                            "description": "История в формате OpenAI",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "role": {"type": "string"},
                                    "content": {"type": "string"},
                                },
                            },
                        },
                        "stream": {
                            "type": "boolean",
                            "default": False,
                            "description": "true — ответ `text/event-stream` (SSE)",
                        },
                        "model": {
                            "type": "string",
                            "deprecated": True,
                            "description": "Игнорируется сервером; оставлено для совместимости с OpenAI SDK",
                        },
                    },
                },
                "example": {
                    "messages": [{"role": "user", "content": "Привет"}],
                    "stream": False,
                },
            }
        },
    }
}


@router.get(
    "/api/v1/health/llm",
    response_model=HealthLlm,
    summary="Проверка Ollama",
    description="Запрос списка моделей через `GET {llm_base}/api/tags`.",
)
async def health_llm() -> dict[str, Any]:
    base = llm_base()
    try:
        client = get_ollama_http()
        r = await client.get("/api/tags", timeout=4.0)
    except httpx.RequestError as e:
        return {
            "ok": False,
            "llm_base": base,
            "detail": f"{type(e).__name__}: {e!s}",
            "models": [],
        }
    if r.status_code != 200:
        return {
            "ok": False,
            "llm_base": base,
            "detail": r.text[:300],
            "models": [],
        }
    try:
        data = r.json()
    except json.JSONDecodeError:
        return {"ok": False, "llm_base": base, "detail": "invalid_json", "models": []}
    names = [m.get("name", "") for m in data.get("models", []) if m.get("name")]
    return {"ok": True, "llm_base": base, "models": names}


@router.post(
    "/api/v1/chat/completions",
    response_model=None,
    summary="Прокси OpenAI chat/completions → Ollama",
    description=(
        "Пробрасывает JSON в `{llm_base}/v1/chat/completions`. "
        "Требуется заголовок **`X-App-Id`** (как у `/api/v1/chat`). "
        "Модель принудительно берётся из конфига приложения (`ollama_model` / дефолт окружения), "
        "поле `model` в теле игнорируется — защита от произвольного выбора модели.\n\n"
        "При `stream: true` возвращает `text/event-stream` (как у OpenAI). "
        "Тело запроса — в формате OpenAI Chat Completions."
    ),
    openapi_extra=_CHAT_COMPLETIONS_OPENAPI_EXTRA,
    responses={
        200: {
            "description": "JSON при stream=false; SSE при stream=true",
            "content": {
                "application/json": {
                    "schema": {"type": "object", "additionalProperties": True},
                },
                "text/event-stream": {
                    "schema": {
                        "type": "string",
                        "format": "binary",
                    }
                },
            },
        },
        400: {"description": "Нет JSON, нет messages или нет X-App-Id"},
        403: {"description": "Неизвестный X-App-Id"},
        502: {"description": "Ollama недоступен или ошибка прокси"},
    },
)
async def chat_completions(
    request: Request,
    app: Annotated[dict, Depends(require_app_id)],
) -> StreamingResponse | JSONResponse:
    try:
        body: dict[str, Any] = await request.json()
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="invalid_json") from None

    if not isinstance(body.get("messages"), list):
        raise HTTPException(status_code=400, detail="messages_required")

    body["model"] = model_for_app(app)

    stream = bool(body.get("stream", False))
    client = get_ollama_http()

    if not stream:
        try:
            r = await client.post("/v1/chat/completions", json=body)
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"ollama_unreachable: {e}") from e
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail=r.text[:2000])
        return JSONResponse(content=r.json())

    async def bytes_stream() -> AsyncIterator[bytes]:
        try:
            async with client.stream("POST", "/v1/chat/completions", json=body) as r:
                if r.status_code != 200:
                    err = (await r.aread()).decode("utf-8", errors="replace")[:2000]
                    payload = json.dumps({"error": err})
                    yield f"data: {payload}\n\n".encode()
                    return
                async for chunk in r.aiter_bytes():
                    yield chunk
        except httpx.RequestError as e:
            payload = json.dumps({"error": f"ollama_unreachable: {e!s}"})
            yield f"data: {payload}\n\n".encode()

    return StreamingResponse(bytes_stream(), media_type="text/event-stream")
