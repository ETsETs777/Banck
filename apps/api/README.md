# Spektors API

FastAPI-приложение монорепозитория. Запуск из этой директории:

```bash
py -3 -m uvicorn spektors_api.main:app --reload --port 8000
```

### Окружение

- **PostgreSQL** обязателен при старте: пул создаётся в `lifespan`. Если БД недоступна по `DATABASE_URL`, в логе будет строка `lifespan: не удалось подключиться к PostgreSQL…`, затем traceback. Поднять сервис: из корня монорепо **`docker compose up -d postgres`** (или свой инстанс).
- **Ollama** нужен для чата/LLM: после БД открывается HTTP-клиент к `LLM_BASE_URL`. При ошибке — сообщение про Ollama в логе.
- **`RATE_LIMIT_PER_MINUTE`** — лимит POST к `/api/v1/chat`, `/api/v1/rag/query`, `/api/v1/chat/completions` на минуту (ключ: IP + `X-App-Id`). По умолчанию **120**; **`0`** отключает лимит. Ответ **429** с заголовком **`Retry-After`**.
- **`INTERNAL_AUTH_STRICT=1`** — без заданного **`INTERNAL_ADMIN_TOKEN`** / **`INTERNAL_DEV_TOKEN`** соответствующие маршруты отвечают **503** `internal_auth_not_configured` (прод).
- **Health:** `GET /api/v1/health/live` (без БД), `GET /api/v1/health/ready` (БД; **503** если недоступна).

Пример без секретов: **`.env.example`** в корне монорепо.

На **Windows** для читаемой кириллицы в консоли при старте вызывается `reconfigure(encoding="utf-8")` для stdout/stderr (см. `spektors_api/main.py`).

Docker: контекст сборки — **корень репозитория** (`docker compose` из корня), см. `Dockerfile`.

## Структура пакета `spektors_api`

| Путь | Назначение |
|------|------------|
| `main.py` | Экземпляр `app`, lifespan, CORS/GZip/RequestId, health/meta, подключение роутеров |
| `openapi.py` | Описание API для Swagger/ReDoc, постобработка схемы |
| `config/apps.py` | Загрузка `config/apps.yaml`, CORS origins, валидация при старте |
| `database/pool.py` | Пул asyncpg, DDL и миграции |
| `database/chat_repository.py` | Сессии, треды, сообщения |
| `integrations/` | Ollama (HTTP-клиент, эмбеддинги), клиент Chroma |
| `security/` | `X-App-Id`, internal Bearer, сравнение токенов |
| `middleware/request_id.py` | `X-Request-ID` |
| `middleware/rate_limit.py` | Лимит частоты для тяжёлых POST |
| `routers/` | Маршруты: `chat`, `llm`, `rag`, `admin_chat` |
| `schemas/` | Pydantic-модели ответов/запросов |
| `common/path_ids.py` | Типы путей (hex id) |

Конфиг приложений по-прежнему в репозитории: **`config/apps.yaml`** (путь считается от корня монорепо).

## Миграции БД (Alembic)

DDL чата больше не зашит в `pool.py`: при **`init_db`** после создания пула вызывается **`alembic upgrade head`** (через psycopg2, в потоке из async lifespan).

Ручной запуск из **`apps/api`** (нужны зависимости из `pyproject.toml`):

```bash
alembic upgrade head
alembic revision -m "описание"   # новая ревизия
```

Файлы: **`alembic.ini`**, каталог **`alembic/versions/`**. Журнал изменений API для интеграторов — **`docs/API_CHANGELOG.md`** в корне монорепо.

### Тесты API

Из **корня монорепо**: `npm run test:api` (использует venv в `apps/api` или `py -3`). Локально: `cd apps/api && pip install ".[dev]" && python -m pytest`.

Снимок OpenAPI (набор путей): **`docs/openapi.snapshot.json`**. Обновить после изменения маршрутов: **`npm run openapi:snapshot`** (нужен Python с зависимостями API).

### Ошибки и Accept-Language

Для строкового **`detail`** в **HTTPException** ответ может содержать **`message`** (ru / nl / en по **`Accept-Language`**) и заголовок **`Content-Language`**. Коды и тексты — **`spektors_api/api_errors.py`**.

Интеграция с Postgres (создаёт строки в БД): **`SPEKTORS_INTEGRATION=1`** и доступный **`DATABASE_URL`**, затем `pytest tests/test_integration_chat.py -v`.
