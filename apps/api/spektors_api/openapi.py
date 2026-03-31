"""Метаданные OpenAPI (Swagger UI / ReDoc)."""
from __future__ import annotations

import os

from fastapi.openapi.utils import get_openapi

OPENAPI_TAGS = [
    {
        "name": "health",
        "description": "Проверка живости сервиса и зависимостей.",
    },
    {
        "name": "llm",
        "description": (
            "Прокси к Ollama (`POST /api/v1/chat/completions`). "
            "Требуется **`X-App-Id`**; модель задаётся конфигом приложения (`ollama_model`), не телом запроса."
        ),
    },
    {
        "name": "chat",
        "description": (
            "Чат с сохранением истории в PostgreSQL. "
            "**Обязательный заголовок `X-App-Id`** — идентификатор приложения из `config/apps.yaml` "
            "(например `web_client`, `web_lite`)."
        ),
    },
    {
        "name": "meta",
        "description": "Служебные метаданные (загрузка конфигурации приложений).",
    },
    {
        "name": "rag",
        "description": (
            "RAG: векторный поиск в Chroma. Эмбеддинги считаются в Ollama (`OLLAMA_EMBED_MODEL`). "
            "Требуется `CHROMA_URL` и коллекция в конфиге приложения."
        ),
    },
    {
        "name": "internal",
        "description": (
            "Внутренние маршруты админки и dev-панели. "
            "Если заданы `INTERNAL_ADMIN_TOKEN` / `INTERNAL_DEV_TOKEN`, нужен заголовок "
            "`Authorization: Bearer <токен>`."
        ),
    },
]

API_DESCRIPTION = """
## Spektors API

Бэкенд веб-банка и локальной LLM: PostgreSQL для чата, Ollama для инференса, опционально Chroma (RAG).

### Документация
- Журнал изменений API (черновик): **`docs/API_CHANGELOG.md`** в репозитории.
- **Swagger UI**: [`/docs`](/docs)
- **ReDoc**: [`/redoc`](/redoc)
- **OpenAPI JSON**: [`/openapi.json`](/openapi.json)

При переменной окружения **`DISABLE_OPENAPI`** = `1` / `true` / `yes` эти конечные точки отключены (см. `docs/SECURITY.md` в репозитории).

### Authorize в Swagger
1. **API Key `X-App-Id`** — *Authorize* → API Key, значение из `config/apps.yaml` (`web_client`, `web_lite`, …). Нужен для чата, RAG и **`POST /api/v1/chat/completions`**.
2. **HTTP Bearer** — для маршрутов **`/internal/*`** вставьте **`INTERNAL_ADMIN_TOKEN`** (admin) или **`INTERNAL_DEV_TOKEN`** (dev), если переменные заданы на сервере (описание у схемы в UI).

### Заголовок X-App-Id
Публичные маршруты чата, **`POST /api/v1/rag/query`** и **`POST /api/v1/chat/completions`** требуют заголовок **`X-App-Id`**
из реестра приложений. CORS-источники задаются в `config/apps.yaml` для каждого приложения.

### Идентификаторы сессии и треда
В теле **`POST /api/v1/chat`** и в пути **`GET .../messages`**: `session_id` и `thread_id` — строка **hex** длиной **8–64** символов
(как у `uuid.uuid4().hex`), **без дефисов**. Несоответствие формату даёт ответ **422**.

### Internal API
При заданных переменных **`INTERNAL_ADMIN_TOKEN`** и **`INTERNAL_DEV_TOKEN`** соответствующие маршруты
требуют **`Authorization: Bearer …`**. Если токен не задан — доступ открыт (только для разработки).
При **`INTERNAL_AUTH_STRICT=1`** (или `true` / `yes`) без заданного токена для роли маршрут отвечает **503** `internal_auth_not_configured` — закрывает «открытый internal» в проде.

### Производительность (обзор)
Запросы к **Ollama** (чат, прокси completions, эмбеддинги RAG) идут через **один async HTTP-клиент на процесс**
с keep-alive и лимитом соединений — меньше накладных расходов, чем при новом клиенте на каждый запрос.
PostgreSQL — через **asyncpg pool** (`spektors_api.database.pool`), размер пула: **`DB_POOL_MIN`** / **`DB_POOL_MAX`**.

### Корреляция запросов
Заголовок **`X-Request-ID`**: клиент может прислать свой; иначе API сгенерирует id и вернёт его в ответе (также в **`Access-Control-Expose-Headers`** для браузера).
**`text/event-stream`** (SSE) не сжимается gzip middleware.

### Ошибки и Accept-Language
Для ряда ответов **HTTPException** с текстовым **`detail`** (код вроде `unknown_app`, `thread_not_found`) тело JSON дополняется полем **`message`** — человекочитаемая строка на языке из **`Accept-Language`** (**ru**, **nl**, иначе **en**). Заголовок ответа **`Content-Language`** дублирует выбранную локаль. Код в **`detail`** для клиентской логики сохраняется.

### Логи
Уровень логирования: переменная **`LOG_LEVEL`** (по умолчанию `INFO`).

### Лимит частоты
Для **POST** к **`/api/v1/chat`**, **`/api/v1/rag/query`**, **`/api/v1/chat/completions`** действует лимит запросов в минуту на пару **IP + `X-App-Id`**
(скользящее окно ~60 с). Переменная **`RATE_LIMIT_PER_MINUTE`** (по умолчанию **120**); **`0`** — отключить.
Ответ **429** содержит JSON с `detail: rate_limit_exceeded` и заголовок **`Retry-After`** (секунды); заголовок продублирован в **`Access-Control-Expose-Headers`** для браузера.

### Kubernetes
- **`GET /api/v1/health/live`** — liveness без проверки БД.
- **`GET /api/v1/health/ready`** — readiness; при недоступности Postgres ответ **503**.
"""


def build_openapi_schema(app) -> dict:
    """Расширяет автогенерацию: servers, единое описание."""
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        openapi_version=getattr(app, "openapi_version", "3.1.0"),
        description=app.description,
        routes=app.routes,
        tags=getattr(app, "openapi_tags", None),
    )
    public_url = os.environ.get("PUBLIC_API_URL", "").strip()
    servers = []
    if public_url:
        servers.append({"url": public_url.rstrip("/"), "description": "Публичный базовый URL"})
    servers.append({"url": "/", "description": "Текущий хост (как в браузере)"})
    openapi_schema["servers"] = servers

    schemes = openapi_schema.get("components", {}).get("securitySchemes") or {}
    http_bearer = schemes.get("HTTPBearer")
    if isinstance(http_bearer, dict):
        http_bearer["description"] = (
            "Для **`/internal/admin/*`** — значение **`INTERNAL_ADMIN_TOKEN`**; "
            "для **`/internal/dev/*`** — **`INTERNAL_DEV_TOKEN`**, если переменная задана на сервере. "
            "Иначе заголовок не требуется (только разработка). "
            "При **`INTERNAL_AUTH_STRICT`** без настроенного токена — **503**."
        )

    return openapi_schema


def attach_custom_openapi(app):
    """Подключает кэшируемый генератор схемы."""

    def custom_openapi():
        if app.openapi_schema:
            return app.openapi_schema
        app.openapi_schema = build_openapi_schema(app)
        return app.openapi_schema

    app.openapi = custom_openapi
