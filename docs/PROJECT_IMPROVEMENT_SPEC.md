# ТЗ: комплексное улучшение проекта Spektors

**Версия:** 1.4 · **Дата:** март 2026  
**Статус:** дорожная карта; ниже в §11 зафиксированы уже внедрённые пункты.

Документ задаёт целевое состояние по **фронтенду**, **бэкенду**, **переводам**, **Swagger/OpenAPI** и смежным областям. Базовая модель UI и ролей — в [`FRONTEND_TZ.md`](FRONTEND_TZ.md); требования безопасности — в [`SECURITY.md`](SECURITY.md). Настоящее ТЗ **дополняет** их и фиксирует приоритеты внедрения.

---

## 1. Цели

1. Единый продуктовый опыт: клиентский чат, lite, админка, dev-панель — согласованный UI, i18n и доступность.
2. Предсказуемый и документированный API: актуальный OpenAPI, примеры, версионирование.
3. Готовность к продакшену: безопасность, наблюдаемость, миграции БД, ограничение нагрузки.
4. Масштабируемая локализация: минимум **ru** и **en** везде, где есть пользовательский текст; задел под **дополнительные локали** (например **nl** — нидерландский, если появится бизнес-требование).

---

## 2. Фронтенд

### 2.1 Общие требования

| Область | Текущее состояние (кратко) | Целевое |
|--------|----------------------------|---------|
| Дизайн-система | `@spektors/ui-tokens`, `@spektors/ui-shell` (тема) | Вынести повторяющиеся паттерны (карточки, формы, алерты) в общие примитивы по мере роста дублирования |
| Тема | light/dark, `localStorage` | Сохранить; опционально `prefers-color-scheme` как начальное значение до первого выбора |
| Состояния UI | Частично в чате | Везде: loading / error / empty / success; не оставлять «немых» падений fetch |
| Доступность | Частично | Проверка клавиатуры, `aria-live` для ошибок чата, контраст по WCAG 2.1 AA для ключевых экранов |
| Производительность | SSG где возможно | Анализ bundle; `dynamic` для тяжёлых виджетов; изображения через `next/image` при появлении медиа |

### 2.2 По приложениям

**web-client (3000), web-lite (3001)**

- Полное покрытие строк через `@spektors/messages` + `next-intl` (новые экраны — только через ключи).
- `@spektors/chat-ui`: опционально показ **X-Request-ID** при ошибке (из заголовка ответа) для поддержки.
- Расширение «банковского» каркаса по [`FRONTEND_TZ.md`](FRONTEND_TZ.md): дашборд, продукты — по продуктовым приоритетам.

**web-admin (3002)**

- **i18n:** ввести локали **ru/en** (тот же пресет `@spektors/next-i18n`, словари `web-admin` в `@spektors/messages` или `apps/web-admin/messages`).
- **BFF:** Route Handler `app/api/.../operator-reply/route.ts`, который читает серверный секрет (`INTERNAL_ADMIN_TOKEN` из env сервера Next), а браузер шлёт только cookie/session своего origin — цель для прода (см. [`SECURITY.md`](SECURITY.md)).
- **Очередь:** после появления **read API** — список активных тредов, фильтры, пагинация; карточка треда с превью последних сообщений.
- Единый визуальный язык с `@spektors/ui-tokens` / `ui-shell`.

**web-dev (3003)**

- Панель ссылок: Swagger, ReDoc, OpenAPI JSON, health-эндпоинты с копированием URL.
- Опционально: отображение `app_id` из `config/apps.yaml` (только публичные поля через `GET /api/v1/meta/...`).

### 2.3 Пакеты

- **`@spektors/api-client`:** JSDoc к публичным методам; опционально retry для идемпотентных GET; типы для всех ответов из OpenAPI (генерация или ручная синхронизация).
- **`@spektors/chat-ui`:** проп `onRequestId?: (id: string) => void` при ошибках; сторибук или визуальные тесты — по желанию.
- **`@spektors/messages`:** правила именования ключей (`namespace.component.action`); проверка паритета **ru/en** в CI (скрипт сравнения ключей).

---

## 3. Переводы и локализация

### 3.1 Обязательный минимум

- **ru** и **en** для: `web-client`, `web-lite`; после внедрения i18n в админке — и **web-admin**.
- Любая новая пользовательская строка: сначала ключи в JSON обеих локалей, затем компонент.
- Плейсхолдеры и множественное число — через возможности `next-intl` (ICU), без склейки строк в JSX.

### 3.2 Дополнительные локали (в т.ч. nl)

- Локаль **nl** добавлена в пресет `@spektors/next-i18n` и словари **`web-client` / `web-lite` / `web-admin`**; переключатель строится по `routing.locales`.
- Новые локали: те же шаги + обновить `scripts/check-i18n-keys.mjs` (сверка всех `*.json` в каталоге приложения).

### 3.3 Бэкенд и переводы

- Для части **HTTPException** с строковым `detail` ответ дополняется **`message`** по **`Accept-Language`** (ru / nl / en) и **`Content-Language`**; код в `detail` сохраняется. Словарь — `spektors_api/api_errors.py`.

---

## 4. Swagger и OpenAPI

### 4.1 Актуальность схемы

- Каждый новый/изменённый маршрут: обновлённые `summary`, `description`, `responses` (включая 4xx/5xx типовые).
- Тела запросов — Pydantic-модели в `spektors_api/schemas` где возможно, чтобы схема генерировалась, а не только `openapi_extra`.
- Проверка в CI: `openapi.json` собирается без ошибок (`npm run check:openapi`); набор **paths** совпадает с **`docs/openapi.snapshot.json`** (`pytest` → `test_openapi_snapshot`). Обновление снимка: **`npm run openapi:snapshot`**.

### 4.2 Примеры и удобство

- Примеры (`example` / `examples`) для: `POST /api/v1/chat`, `POST /api/v1/rag/query`, internal reply.
- В описании API — ссылка на `docs/SECURITY.md` и `apps/api/README.md` (окружение, БД).

### 4.3 Окружения

- **Прод:** `DISABLE_OPENAPI=1` по умолчанию; отдельный **staging** со Swagger для интеграторов.
- Поле `servers` в OpenAPI — заполнять из `PUBLIC_API_URL` (уже есть); для нескольких стендов — документировать в README.

### 4.4 Версионирование API

- В перспективе: префикс **`/api/v2`** при ломающих изменениях; в OpenAPI — поле `version` приложения.
- Черновик журнала для интеграторов: [`docs/API_CHANGELOG.md`](API_CHANGELOG.md).

---

## 5. Бэкенд (`spektors_api`)

### 5.1 Архитектура и код

- Сохранять слоистость: `routers` → репозитории/сервисы → БД/интеграции.
- Вынести в сервисный слой повторяющуюся логику Ollama (стриминг + сохранение) при росте дублирования.

### 5.2 База данных

- **Alembic** подключён: ревизии в `apps/api/alembic/versions/`, при старте API — `upgrade head` (см. `apps/api/README.md`).
- Индексы под ожидаемые запросы (например по `created_at` для отчётов) — по нагрузочному профилю.

### 5.3 Надёжность и эксплуатация

- **Rate limiting** (middleware или proxy): лимиты на `POST /api/v1/chat`, `/api/v1/chat/completions`, `/api/v1/rag/query` по IP и/или по `X-App-Id`.
- **Readiness / liveness:** отдельные эндпоинты или разделение: liveness без БД, readiness с проверкой пула (для Kubernetes).
- **Структурированные логи** (JSON) опционально под ELK/Datadog; корреляция с `X-Request-ID` уже заложена.
- Таймауты и лимиты размера тела запроса на уровне Starlette/Uvicorn — зафиксировать в README.

### 5.4 Internal и админка

- **GET** (или POST) список тредов/сессий для инбокса: фильтр по `app_id`, пагинация, без утечки чужих данных.
- Политика **idempotency** для operator reply (опционально ключ клиента) — по продуктовым правилам.

### 5.5 Тесты

- **pytest:** unit для `security/tokens`; контракт OpenAPI на наличие критичных путей (`tests/test_openapi_contract.py`). Запуск: **`npm run test:api`**.
- Далее: репозиторий с testcontainers / CI Postgres; интеграционные сценарии chat + internal reply; снимок фрагмента схемы OpenAPI в git (опционально).

---

## 6. Безопасность и инфраструктура

- Выполнить чеклист из [`SECURITY.md`](SECURITY.md); в корне репозитория добавлен **`.env.example`** (шаблон без секретов).
- Секреты только в env / secret manager; не логировать токены и полные тела чатов в prod-логах.
- **web-admin BFF:** маршруты Next **`POST /api/internal/operator-reply`** и **`GET /api/internal/threads`** проксируют на API с **`INTERNAL_ADMIN_TOKEN`** и **`SPEKTORS_API_URL`** (или `NEXT_PUBLIC_API_URL`) только на сервере Next.

---

## 7. CI/CD и качество

- Pipeline: `npm run build --workspaces`, линт ESLint, `tsc`, сборка OpenAPI, `pytest` для API.
- Локальные проверки из корня монорепо: **`npm run check:i18n`**, **`npm run check:openapi`**, **`npm run test:api`**, при необходимости **`npm run openapi:snapshot`** после смены маршрутов API.
- E2E (первый раз: **`npm run test:e2e:install`**): **`npm run test:e2e`** — Playwright поднимает **`web-client`** если порт свободен (`reuseExistingServer` вне CI).
- Зависимости: Dependabot или аналог; pin major для Python/Node в документации.

---

## 8. Приоритизация (рекомендуемые фазы)

| Фаза | Содержание |
|------|------------|
| **P0** | Стабильный запуск стека (compose), документация окружения, паритет ключей ru/en в messages |
| **P1** | BFF для admin reply; список тредов в internal API + UI инбокса; rate limit на proxy или в API |
| **P2** | Alembic ✓; readiness/liveness ✓; примеры OpenAPI ✓; pytest + контракт путей ✓; дальше — снимок OpenAPI в git, CI |
| **P3** | i18n web-admin ✓; web-dev панель ✓; локаль **nl** ✓; далее — i18n web-dev при росте UI |
| **P4** | Структурированные логи, метрики, E2E-тесты Playwright для чата |

---

## 9. Критерии приёмки (для закрытия «этапа улучшений»)

- Все приложения собираются без ошибок; API импортируется, OpenAPI валиден.
- Нет непереведённых ключей в ru/en для экранов в scope этапа.
- Swagger на staging отражает текущие маршруты; в проде документация отключена или защищена.
- Документы `FRONTEND_TZ.md`, `SECURITY.md`, настоящее **PROJECT_IMPROVEMENT_SPEC.md** согласованы по ссылкам и не противоречат друг другу.

---

## 10. Сопровождение документации

- При смене крупных решений — обновлять соответствующий раздел этого ТЗ и версию в шапке.
- Кросс-ссылки: `apps/api/README.md` ↔ `docs/SECURITY.md` ↔ OpenAPI description.

---

## 11. Журнал внедрения (факт в коде)

**Версия ТЗ 1.1 — сделано:**

- **Бэкенд:** `GET /internal/admin/v1/threads` (фильтр `app_id`, пагинация `limit`/`offset`, превью последнего сообщения); middleware **`RATE_LIMIT_PER_MINUTE`** для POST чата / RAG / completions; **`GET /api/v1/health/live`** и **`GET /api/v1/health/ready`** (503 при недоступной БД); примеры OpenAPI для RAG-тела и ответа оператора; описание лимита и health в `openapi.py`.
- **Фронт — web-admin:** локали **ru/en** (`next-intl`, префикс в URL), словари **`@spektors/messages/web-admin`**, переключатель языка в сайдбаре; инбокс со списком тредов (через BFF) и формами BFF + прямой вызов API для разработки.
- **Фронт — web-dev:** список ссылок на Swagger, OpenAPI, health/meta с кнопкой копирования URL.
- **Пакеты:** `@spektors/chat-ui` — в текст ошибки при неуспешном SSE добавляется **`X-Request-ID`** (ключи `requestIdNote` в `web-client` / `web-lite`); `@spektors/api-client` — **`adminListThreads`**, доработан **`adminHumanReply`** (общие заголовки + request id в ошибке).
- **Репозиторий:** `scripts/check-i18n-keys.mjs`, npm-скрипты **`check:i18n`**, **`check:openapi`**.

**Версия ТЗ 1.2 — добавлено:**

- **Alembic:** `apps/api/alembic.ini`, ревизия **`0001_initial_chat_tables`** (таблицы чата + `ALTER … IF NOT EXISTS` для старых БД); `init_db` вызывает `alembic upgrade head` через `asyncio.to_thread`.
- **pytest:** `tests/test_tokens.py`, `tests/test_openapi_contract.py`; зависимость **`pytest`** в группе `dev` в `pyproject.toml`; **`npm run test:api`** → `scripts/run-pytest.mjs`.
- **Документация:** `docs/API_CHANGELOG.md`; раздел про миграции в `apps/api/README.md`; Docker-образ API копирует `alembic/` и ставит `alembic`, `sqlalchemy`, `psycopg2-binary`.

**Версия ТЗ 1.3 — добавлено:**

- **Локализация:** третья локаль **nl** (Nederlands) в `spektorsI18nPreset`, `nl.json` для трёх приложений, общий паттерн переключателя по `routing.locales`; `check:i18n` сравнивает ключи **всех** JSON в каждом каталоге локалей с эталоном `ru.json`.
- **Тема:** до первого выбора в `localStorage` учитывается **`prefers-color-scheme`** (`@spektors/ui-shell` theme script).
- **Бэкенд:** **`INTERNAL_AUTH_STRICT`** — без заданного internal-токена ответ **503** `internal_auth_not_configured`; **429** дополняется заголовком **`Retry-After`**; **`Retry-After`** в CORS `expose_headers`.
- **web-dev:** блок **`app_id`** с `GET /api/v1/meta/config-check` (SSR, `cache: no-store`).
- **Тесты:** `tests/test_internal_auth.py`; опционально **`SPEKTORS_INTEGRATION=1`** + `tests/test_integration_chat.py` (реальная Postgres); dev-зависимость **`pytest-asyncio`**.

**Версия ТЗ 1.4 — добавлено:**

- **Ошибки API:** модуль **`api_errors`**, обработчик **HTTPException** в `main.py` — поле **`message`** + **`Content-Language`**; CORS **`expose_headers`** дополнен **`Content-Language`**.
- **OpenAPI:** файл **`docs/openapi.snapshot.json`**, скрипты **`npm run openapi:snapshot`**, тест **`test_openapi_snapshot_paths_match`**.
- **E2E:** **Playwright** в корне (`playwright.config.ts`, **`e2e/web-client-smoke.spec.ts`**), скрипты **`npm run test:e2e`**, **`npm run test:e2e:install`**; артефакты отчётов в **`.gitignore`**.
- **`@spektors/chat-ui`:** опциональный колбэк **`onRequestId`** при ошибке HTTP до SSE.

**Следующие крупные шаги:** расширить словарь **`api_errors`** и покрытие кодов; CI job (API + Postgres + E2E); больше сценариев Playwright (чат при поднятом API).

---

*Конец документа.*
