# Changelog публичного API (Spektors)

Краткая история ломающих и заметных изменений для интеграторов. Версия в OpenAPI — поле `version` у приложения FastAPI (`spektors_api.main`).

## 0.1.x

- Добавлены **`GET /api/v1/health/live`**, **`GET /api/v1/health/ready`** (readiness при недоступной БД — HTTP 503).
- Добавлен **`GET /internal/admin/v1/threads`** (список тредов для инбокса; Bearer при заданном `INTERNAL_ADMIN_TOKEN`).
- Публичные POST к чату / RAG / completions могут отвечать **429** при превышении **`RATE_LIMIT_PER_MINUTE`** (заголовок **`Retry-After`**).
- Переменная **`INTERNAL_AUTH_STRICT`**: в строгом режиме без заданного internal-токена — **503** `internal_auth_not_configured`.
- Ошибки с текстовым **`detail`**: при **`Accept-Language`** добавляется **`message`** и заголовок **`Content-Language`** (ru / nl / en).
- В репозитории закреплён **`docs/openapi.snapshot.json`**; тест проверяет совпадение набора путей OpenAPI.
- Схема PostgreSQL для чата версионируется через **Alembic** (`apps/api/alembic`); при старте API выполняется `upgrade head`.
