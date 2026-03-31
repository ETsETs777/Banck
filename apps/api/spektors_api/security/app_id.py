"""Заголовок X-App-Id и зависимость FastAPI."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import APIKeyHeader

from spektors_api.config.apps import CONFIG, find_app

APP_ID_HEADER = APIKeyHeader(
    name="X-App-Id",
    auto_error=False,
    description=(
        "Идентификатор приложения из `config/apps.yaml` "
        "(например `web_client`, `web_lite`, `web_admin`). "
        "Обязателен для чата, RAG-query и `POST /api/v1/chat/completions`. "
        "В Swagger: кнопка **Authorize** → API Key."
    ),
)


async def require_app_id(
    x_app_id: Annotated[str | None, Depends(APP_ID_HEADER)] = None,
) -> dict:
    if not x_app_id:
        raise HTTPException(status_code=400, detail="x_app_id_required")
    app = find_app(CONFIG, x_app_id)
    if app is None:
        raise HTTPException(status_code=403, detail="unknown_app")
    return app
