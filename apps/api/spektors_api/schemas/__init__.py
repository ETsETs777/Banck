"""Pydantic-схемы ответов и тел запросов (OpenAPI)."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class HealthOk(BaseModel):
    status: str = Field(examples=["ok"])
    service: str = Field(examples=["spektors-api"])


class HealthWithRole(HealthOk):
    role: str = Field(examples=["admin"])


class HealthDb(BaseModel):
    ok: bool
    backend: str = Field(examples=["postgresql"])


class HealthLlm(BaseModel):
    ok: bool
    llm_base: str | None = None
    models: list[str] = Field(default_factory=list)
    detail: str | None = None


class HealthRag(BaseModel):
    ok: bool
    chroma_url: str | None = None
    detail: str | None = None


class RagQueryRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {"query": "Как подключить карту?", "top_k": 5}
        }
    )

    query: str = Field(..., min_length=1, max_length=8000)
    top_k: int = Field(default=5, ge=1, le=50)


class RagHit(BaseModel):
    id: str | int | None = None
    document: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    distance: float | None = None


class RagQueryResponse(BaseModel):
    collection: str
    hits: list[RagHit]


class MetaConfigCheck(BaseModel):
    apps_loaded: int
    app_ids: list[str | None]


class ChatMessageRow(BaseModel):
    id: int
    role: str
    content: str
    msg_source: str = Field(
        default="model",
        description="user | model | human | system",
    )
    author_label: str | None = None
    created_at: str | None = None


class HumanReplyResponse(BaseModel):
    ok: bool
    message_id: int
    app_id: str
    session_id: str
    thread_id: str


class AdminInboxThreadRow(BaseModel):
    """Строка списка тредов для инбокса оператора."""

    thread_id: str
    session_id: str
    app_id: str
    last_preview: str | None = None
    updated_at: str | None = None
    message_count: int = 0


class AdminThreadsListResponse(BaseModel):
    items: list[AdminInboxThreadRow]
    limit: int
    offset: int


class ThreadMessagesResponse(BaseModel):
    session_id: str
    thread_id: str
    messages: list[ChatMessageRow]


class AppMetaPublic(BaseModel):
    """Публичные настройки приложения (без CORS, chroma и прочих внутренних полей)."""

    app_id: str
    display_name: str | None = None
    features: dict[str, bool] = Field(default_factory=dict)
    tools: dict[str, bool] = Field(default_factory=dict)
    rag_enabled: bool = False
    ollama_model: str = ""
    prompt_version: str = ""


class ChatSyncResponse(BaseModel):
    """Ответ POST /api/v1/chat при stream=false."""

    session_id: str
    thread_id: str
    message: dict[str, Any] = Field(
        description="Тело ответа OpenAI-совместного chat/completions от Ollama"
    )
