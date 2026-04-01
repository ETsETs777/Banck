"""Internal: ответ оператора в существующий тред чата."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from spektors_api.common.path_ids import HexIdPath
from spektors_api.config.apps import CONFIG, find_app
from spektors_api.database import admin_repository, chat_repository
from spektors_api.schemas import (
    AdminAuditEntry,
    AdminAuditListResponse,
    AdminInboxThreadRow,
    AdminThreadMetaResponse,
    AdminThreadsListResponse,
    HumanReplyResponse,
)
from spektors_api.security.internal_auth import require_internal_admin

router = APIRouter(
    prefix="/internal/admin/v1",
    tags=["internal"],
    dependencies=[Depends(require_internal_admin)],
)


class ThreadMetaPatchBody(BaseModel):
    workflow_status: Literal["queued", "assigned", "closed"] | None = None
    assignee_label: str | None = Field(None, max_length=128)
    tags: list[str] | None = None
    internal_note: str | None = Field(None, max_length=32000)


class HumanReplyBody(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "content": "Здравствуйте! Уточните, пожалуйста, последние 4 цифры карты.",
                "author_label": "Поддержка",
            }
        }
    )

    content: str = Field(..., min_length=1, max_length=32000)
    author_label: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Имя или роль, показываемое клиенту (например «Поддержка»)",
    )


@router.get(
    "/threads",
    response_model=AdminThreadsListResponse,
    summary="Список тредов для инбокса",
    description=(
        "Последние активные треды с превью последнего сообщения. "
        "Опциональный **`app_id`** — только известные id из `config/apps.yaml`."
    ),
    responses={
        401: {"description": "Токен обязателен, но не передан"},
        403: {"description": "Неверный Bearer-токен"},
        404: {"description": "Неизвестный app_id (если передан фильтр)"},
    },
)
async def list_threads_inbox(
    app_id: str | None = Query(
        None,
        description="Фильтр по приложению (web_client, web_lite, …)",
    ),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0, le=1_000_000),
) -> AdminThreadsListResponse:
    if app_id is not None and app_id.strip():
        aid = app_id.strip()
        if find_app(CONFIG, aid) is None:
            raise HTTPException(status_code=404, detail="unknown_app")
    else:
        aid = None
    rows = await chat_repository.list_threads_inbox(aid, limit, offset)
    items = [
        AdminInboxThreadRow(
            thread_id=r["thread_id"],
            session_id=r["session_id"],
            app_id=r["app_id"],
            last_preview=r["last_preview"],
            updated_at=r["updated_at"],
            message_count=r["message_count"],
            workflow_status=str(r.get("workflow_status") or "queued"),
            assignee_label=r.get("assignee_label"),
            tags=list(r.get("tags") or []),
        )
        for r in rows
    ]
    return AdminThreadsListResponse(items=items, limit=limit, offset=offset)


@router.get(
    "/sessions/{session_id}/threads/{thread_id}/meta",
    response_model=AdminThreadMetaResponse,
    summary="Метаданные треда (оператор)",
)
async def get_thread_meta(
    session_id: HexIdPath,
    thread_id: HexIdPath,
) -> AdminThreadMetaResponse:
    sid = session_id.lower()
    tid = thread_id.lower()
    if await chat_repository.thread_app_id(sid, tid) is None:
        raise HTTPException(status_code=404, detail="thread_not_found")
    row = await admin_repository.get_thread_meta_row(tid)
    if row is None:
        return AdminThreadMetaResponse(
            thread_id=tid,
            workflow_status="queued",
            tags=[],
        )
    return AdminThreadMetaResponse(**row)


@router.patch(
    "/sessions/{session_id}/threads/{thread_id}/meta",
    response_model=AdminThreadMetaResponse,
    summary="Обновить метаданные треда",
)
async def patch_thread_meta(
    session_id: HexIdPath,
    thread_id: HexIdPath,
    body: ThreadMetaPatchBody,
    actor_label: str | None = Query(
        None,
        max_length=128,
        description="Подпись оператора для журнала аудита",
    ),
) -> AdminThreadMetaResponse:
    sid = session_id.lower()
    tid = thread_id.lower()
    if await chat_repository.thread_app_id(sid, tid) is None:
        raise HTTPException(status_code=404, detail="thread_not_found")
    patch = body.model_dump(exclude_unset=True)
    out = await admin_repository.merge_thread_meta(tid, patch)
    await admin_repository.append_audit(
        actor_label=actor_label,
        action="thread_meta_patch",
        thread_id=tid,
        payload=patch,
    )
    return AdminThreadMetaResponse(**out)


@router.get(
    "/audit-log",
    response_model=AdminAuditListResponse,
    summary="Журнал действий операторов",
)
async def get_audit_log(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0, le=1_000_000),
) -> AdminAuditListResponse:
    rows = await admin_repository.list_audit(limit, offset)
    items = [AdminAuditEntry(**r) for r in rows]
    return AdminAuditListResponse(items=items, limit=limit, offset=offset)


@router.post(
    "/sessions/{session_id}/threads/{thread_id}/reply",
    response_model=HumanReplyResponse,
    summary="Ответ оператора в чат",
    description=(
        "Добавляет сообщение `assistant` с `msg_source=human`. "
        "Тред должен существовать. Если на сервере задан **`INTERNAL_ADMIN_TOKEN`**, "
        "нужен заголовок **`Authorization: Bearer <токен>`** (в Swagger — **HTTP Bearer**). "
        "`session_id` и `thread_id` в пути — hex 8–64, без дефисов."
    ),
    responses={
        401: {"description": "Токен обязателен, но не передан"},
        403: {"description": "Неверный Bearer-токен"},
        404: {"description": "Тред не найден"},
        422: {"description": "Ошибка валидации тела или пути"},
    },
)
async def operator_reply_to_thread(
    session_id: HexIdPath,
    thread_id: HexIdPath,
    body: HumanReplyBody,
) -> HumanReplyResponse:
    sid = session_id.lower()
    tid = thread_id.lower()
    app_id = await chat_repository.thread_app_id(sid, tid)
    if app_id is None:
        raise HTTPException(status_code=404, detail="thread_not_found")
    mid = await chat_repository.add_message(
        tid,
        "assistant",
        body.content,
        msg_source="human",
        author_label=body.author_label.strip(),
    )
    return HumanReplyResponse(
        ok=True,
        message_id=mid,
        app_id=app_id,
        session_id=sid,
        thread_id=tid,
    )
