"""Чат с историей в PostgreSQL + прокси в Ollama."""
from __future__ import annotations

import json
from typing import Annotated, Any, AsyncIterator

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from spektors_api.common.path_ids import HexIdPath
from spektors_api.database import chat_repository
from spektors_api.integrations.ollama_common import model_for_app
from spektors_api.integrations.ollama_http import get_ollama_http
from spektors_api.schemas import ThreadMessagesResponse
from spektors_api.security.app_id import require_app_id

router = APIRouter(tags=["chat"])


class ChatRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "content": "Привет",
                "stream": True,
                "session_id": "a1b2c3d4e5f6789012345678abcdef01",
                "thread_id": "fedcba0987654321fedcba0987654321",
            }
        }
    )

    content: str = Field(..., min_length=1, max_length=32000)
    stream: bool = True
    session_id: str | None = Field(
        None,
        description="Опционально; hex 8–64, без дефисов. Продолжить существующую сессию.",
    )
    thread_id: str | None = Field(
        None,
        description="Опционально; hex 8–64. Продолжить существующий тред в рамках сессии.",
    )

    @field_validator("session_id", "thread_id", mode="before")
    @classmethod
    def normalize_hex_ids(cls, v: object) -> str | None:
        if v is None or v == "":
            return None
        if not isinstance(v, str):
            raise ValueError("invalid_id_type")
        s = v.strip()
        if len(s) < 8 or len(s) > 64:
            raise ValueError("invalid_id_length")
        if not all(c in "0123456789abcdefABCDEF" for c in s):
            raise ValueError("invalid_id_chars")
        return s.lower()


@router.post(
    "/api/v1/chat",
    response_model=None,
    summary="Сообщение в чат (Ollama + PostgreSQL)",
    description=(
        "Сохраняет реплику пользователя, вызывает модель для текущего `app_id` "
        "и пишет ответ ассистента в БД.\n\n"
        "**Заголовок `X-App-Id`** обязателен (см. Authorize в Swagger).\n\n"
        "- `stream: false` — ответ `application/json` с полями `session_id`, `thread_id`, `message`.\n"
        "- `stream: true` — `text/event-stream` (SSE); `session_id` и `thread_id` в заголовках ответа "
        "`X-Session-Id` и `X-Thread-Id`.\n\n"
        "Опциональные `session_id` / `thread_id` в теле — **hex 8–64** (как UUID без дефисов); иначе **422**."
    ),
    responses={
        200: {
            "description": "JSON (stream=false) или SSE (stream=true)",
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "required": ["session_id", "thread_id", "message"],
                        "properties": {
                            "session_id": {"type": "string"},
                            "thread_id": {"type": "string"},
                            "message": {
                                "type": "object",
                                "additionalProperties": True,
                                "description": "Ответ Ollama в формате OpenAI chat/completions",
                            },
                        },
                    }
                },
                "text/event-stream": {
                    "schema": {
                        "type": "string",
                        "format": "binary",
                        "description": "События в формате OpenAI streaming",
                    }
                },
            },
        },
        400: {"description": "Нет тела, неверный JSON или нет X-App-Id"},
        403: {"description": "Неизвестный app_id или несовпадение session/thread"},
        422: {"description": "Ошибка валидации (в т.ч. формат session_id/thread_id: hex 8–64)"},
        502: {"description": "Ollama недоступен"},
    },
)
async def post_chat(
    body: ChatRequest,
    app: Annotated[dict, Depends(require_app_id)],
):
    app_id = app["app_id"]
    try:
        sid = await chat_repository.ensure_session(app_id, body.session_id)
        tid = await chat_repository.ensure_thread(sid, body.thread_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e

    await chat_repository.add_message(tid, "user", body.content, msg_source="user")
    messages = await chat_repository.list_messages_for_llm(tid)
    model = model_for_app(app)
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": body.stream,
    }
    client = get_ollama_http()

    if not body.stream:
        try:
            r = await client.post("/v1/chat/completions", json=payload)
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502, detail=f"ollama_unreachable: {e}"
            ) from e
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail=r.text[:2000])
        data = r.json()
        text = ""
        for choice in data.get("choices") or []:
            msg = choice.get("message") or {}
            text = msg.get("content") or ""
            break
        if text:
            await chat_repository.add_message(
                tid, "assistant", text, msg_source="model"
            )
        return JSONResponse(
            content={
                "session_id": sid,
                "thread_id": tid,
                "message": data,
            }
        )

    async def sse_with_save() -> AsyncIterator[bytes]:
        parts: list[str] = []
        try:
            try:
                async with client.stream("POST", "/v1/chat/completions", json=payload) as r:
                    if r.status_code != 200:
                        err = (await r.aread()).decode("utf-8", errors="replace")[
                            :2000
                        ]
                        yield f"data: {json.dumps({'error': err})}\n\n".encode()
                        return
                    async for line in r.aiter_lines():
                        if line is None:
                            continue
                        yield (line + "\n").encode("utf-8")
                        if not line.startswith("data: "):
                            continue
                        raw = line[6:].strip()
                        if raw == "[DONE]":
                            break
                        try:
                            obj = json.loads(raw)
                        except json.JSONDecodeError:
                            continue
                        for choice in obj.get("choices") or []:
                            delta = (choice.get("delta") or {}).get("content")
                            if delta:
                                parts.append(delta)
            except httpx.RequestError as e:
                yield f"data: {json.dumps({'error': f'ollama_unreachable: {e!s}'})}\n\n".encode()
        finally:
            if parts:
                await chat_repository.add_message(
                    tid, "assistant", "".join(parts), msg_source="model"
                )

    return StreamingResponse(
        sse_with_save(),
        media_type="text/event-stream",
        headers={
            "X-Session-Id": sid,
            "X-Thread-Id": tid,
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.get(
    "/api/v1/sessions/{session_id}/threads/{thread_id}/messages",
    response_model=ThreadMessagesResponse,
    summary="История сообщений треда",
    description=(
        "**Заголовок `X-App-Id`** обязателен. "
        "Проверяется, что тред принадлежит указанной сессии и приложению (`app_id`). "
        "Идентификаторы в пути — hex 8–64, без дефисов."
    ),
    responses={
        404: {"description": "Тред не найден или не принадлежит приложению"},
        400: {"description": "Нет или пустой X-App-Id"},
        403: {"description": "Неизвестный X-App-Id"},
        422: {"description": "Неверный формат session_id или thread_id в пути"},
    },
)
async def get_thread_messages(
    session_id: HexIdPath,
    thread_id: HexIdPath,
    app: Annotated[dict, Depends(require_app_id)],
):
    app_id = app["app_id"]
    sid = session_id.lower()
    tid = thread_id.lower()
    if not await chat_repository.verify_thread_in_app_session(app_id, sid, tid):
        raise HTTPException(status_code=404, detail="thread_not_found")
    items = await chat_repository.list_messages_public(tid)
    return {"session_id": sid, "thread_id": tid, "messages": items}
