"""
Точка входа FastAPI: конфиг приложений, CORS, PostgreSQL, LLM, чат.
Запуск: ``uvicorn spektors_api.main:app``
"""
from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager


def _configure_stdio_utf8() -> None:
    """Windows: консоль часто в OEM/ANSI — без UTF-8 русские log.info превращаются в кракозябры."""
    if sys.platform != "win32":
        return
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8")
            except (OSError, ValueError, AttributeError):
                pass


_configure_stdio_utf8()

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.gzip import GZipMiddleware
from starlette.requests import Request

from spektors_api.api_errors import localized_message, pick_locale
from spektors_api.config.apps import CONFIG, collect_cors_origins, find_app, log_config_issues
from spektors_api.database.pool import close_db, init_db, ping_db
from spektors_api.integrations.ollama_http import close_ollama_http, open_ollama_http
from spektors_api.middleware.rate_limit import RateLimitMiddleware
from spektors_api.middleware.request_id import RequestIdMiddleware
from spektors_api.openapi import API_DESCRIPTION, OPENAPI_TAGS, attach_custom_openapi
from spektors_api.routers import admin_chat, chat, llm, rag
from spektors_api.schemas import AppMetaPublic, HealthDb, HealthOk, HealthWithRole, MetaConfigCheck
from spektors_api.security.internal_auth import require_internal_admin, require_internal_dev

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
log = logging.getLogger("spektors.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("lifespan: проверка конфигурации приложений")
    log_config_issues(CONFIG)
    try:
        await init_db()
    except Exception:
        log.exception(
            "lifespan: не удалось подключиться к PostgreSQL. "
            "Проверьте DATABASE_URL и что сервис запущен (например: docker compose up -d postgres)."
        )
        raise
    try:
        await open_ollama_http()
    except Exception:
        log.exception(
            "lifespan: не удалось открыть HTTP-клиент Ollama. Проверьте LLM_BASE_URL и доступность Ollama."
        )
        raise
    log.info("lifespan: БД и HTTP-клиент Ollama готовы")
    try:
        yield
    finally:
        log.info("lifespan: остановка Ollama HTTP и пула БД")
        await close_ollama_http()
        await close_db()


cors_origins = collect_cors_origins(CONFIG) or ["http://localhost:3000"]

_openapi_on = os.environ.get("DISABLE_OPENAPI", "").strip().lower() not in (
    "1",
    "true",
    "yes",
)

app = FastAPI(
    title="Spektors API",
    description=API_DESCRIPTION,
    version="0.1.0",
    lifespan=lifespan,
    openapi_tags=OPENAPI_TAGS,
    docs_url="/docs" if _openapi_on else None,
    redoc_url="/redoc" if _openapi_on else None,
    openapi_url="/openapi.json" if _openapi_on else None,
)
attach_custom_openapi(app)
app.include_router(llm.router)
app.include_router(chat.router)
app.include_router(rag.router)
app.include_router(admin_chat.router)


@app.exception_handler(HTTPException)
async def _http_exception_localized(request: Request, exc: HTTPException) -> JSONResponse:
    """Стабильный `detail` + человекочитаемое `message` по Accept-Language (ru | en | nl)."""
    hdrs = dict(exc.headers) if exc.headers else {}
    if isinstance(exc.detail, str):
        msg = localized_message(exc.detail, request.headers.get("accept-language"))
        if msg:
            hdrs.setdefault("Content-Language", pick_locale(request.headers.get("accept-language")))
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": exc.detail, "message": msg},
                headers=hdrs,
            )
    if isinstance(exc.detail, (list, dict)):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=hdrs,
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=hdrs,
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-Session-Id",
        "X-Thread-Id",
        "X-Request-ID",
        "Retry-After",
        "Content-Language",
    ],
)
app.add_middleware(GZipMiddleware, minimum_size=800)
app.add_middleware(RequestIdMiddleware)
app.add_middleware(RateLimitMiddleware)


@app.get(
    "/api/v1/health",
    response_model=HealthOk,
    tags=["health"],
    summary="Публичный health",
)
async def health_public():
    return {"status": "ok", "service": "spektors-api"}


@app.get(
    "/api/v1/health/live",
    response_model=HealthOk,
    tags=["health"],
    summary="Liveness (без БД)",
    description="Для оркестраторов: процесс жив, без проверки зависимостей.",
)
async def health_live():
    return {"status": "ok", "service": "spektors-api"}


@app.get(
    "/api/v1/health/ready",
    response_model=HealthDb,
    tags=["health"],
    summary="Readiness (PostgreSQL)",
    description="Проверка пула БД; при недоступности Postgres — **503**.",
)
async def health_ready():
    ok = await ping_db()
    if not ok:
        raise HTTPException(
            status_code=503,
            detail={"detail": "database_unavailable"},
        )
    return {"ok": True, "backend": "postgresql"}


@app.get(
    "/api/v1/health/db",
    response_model=HealthDb,
    tags=["health"],
    summary="Проверка PostgreSQL",
)
async def health_db():
    ok = await ping_db()
    return {"ok": ok, "backend": "postgresql"}


@app.get(
    "/internal/admin/v1/health",
    response_model=HealthWithRole,
    tags=["internal"],
    summary="Health админки",
    description=(
        "Если задан **`INTERNAL_ADMIN_TOKEN`**, нужен **`Authorization: Bearer`**. "
        "В Swagger — схема **HTTP Bearer**."
    ),
    responses={
        401: {"description": "Токен обязателен, но не передан"},
        403: {"description": "Неверный токен"},
    },
    dependencies=[Depends(require_internal_admin)],
)
def health_admin():
    return {"status": "ok", "service": "spektors-api", "role": "admin"}


@app.get(
    "/internal/dev/v1/health",
    response_model=HealthWithRole,
    tags=["internal"],
    summary="Health dev-панели",
    description=(
        "Если задан **`INTERNAL_DEV_TOKEN`**, нужен **`Authorization: Bearer`**. "
        "В Swagger — схема **HTTP Bearer**."
    ),
    responses={
        401: {"description": "Токен обязателен, но не передан"},
        403: {"description": "Неверный токен"},
    },
    dependencies=[Depends(require_internal_dev)],
)
def health_dev():
    return {"status": "ok", "service": "spektors-api", "role": "dev"}


@app.get(
    "/api/v1/meta/config-check",
    response_model=MetaConfigCheck,
    tags=["meta"],
    summary="Проверка загрузки apps.yaml",
)
def meta_config_check():
    apps = CONFIG.get("apps") or {}
    return {
        "apps_loaded": len(apps),
        "app_ids": [a.get("app_id") for a in apps.values()],
    }


@app.get(
    "/api/v1/meta/app/{app_id}",
    response_model=AppMetaPublic,
    tags=["meta"],
    summary="Публичные настройки приложения",
    description=(
        "Флаги возможностей и инструментов для указанного `app_id` из `config/apps.yaml`. "
        "Имя коллекции Chroma и CORS в ответ не попадают."
    ),
    responses={404: {"description": "Неизвестный app_id"}},
)
def meta_app_public(app_id: str) -> AppMetaPublic:
    app = find_app(CONFIG, app_id)
    if app is None:
        raise HTTPException(status_code=404, detail="unknown_app")
    feats = app.get("features") or {}
    tools = app.get("tools") or {}
    return AppMetaPublic(
        app_id=str(app.get("app_id") or app_id),
        display_name=app.get("display_name"),
        features={k: bool(v) for k, v in feats.items() if isinstance(v, bool)},
        tools={k: bool(v) for k, v in tools.items() if isinstance(v, bool)},
        rag_enabled=bool(app.get("rag_enabled")),
        ollama_model=str(app.get("ollama_model") or ""),
        prompt_version=str(app.get("prompt_version") or ""),
    )
