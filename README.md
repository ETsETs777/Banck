# Spektors

Монорепозиторий платформы Spektors: **FastAPI-бэкенд**, несколько **Next.js**-приложений, общие **npm-пакеты**, **Docker Compose** (PostgreSQL, Ollama, Chroma) и **десктоп-лаунчер** для локальной разработки.

**Репозиторий на GitHub:** [github.com/ETsETs777/Banck](https://github.com/ETsETs777/Banck)

## Требования

| Инструмент | Назначение |
|------------|------------|
| **Node.js** (LTS) + npm | workspaces, фронты, скрипты |
| **Python 3** + `py` launcher (Windows) или `python3` | API, Alembic, pytest |
| **Docker Desktop** (или Docker Engine) | Postgres, Ollama, Chroma, образ API |

## Быстрый старт

```bash
git clone https://github.com/ETsETs777/Banck.git
cd Banck
npm install
```

Скопируйте окружение из примера в корне репозитория (если есть `.env.example`):

```bash
copy .env.example .env   # Windows
# cp .env.example .env   # macOS / Linux
```

Поднимите инфраструктуру и при необходимости API через Compose (из **корня** репо):

```bash
docker compose up -d postgres          # только БД
docker compose up -d                   # полный стек (см. docker-compose.yml)
```

Локальный API без Docker-образа API:

```bash
npm run dev:api
```

Откройте Swagger: [http://localhost:8000/docs](http://localhost:8000/docs).

## Структура репозитория

| Путь | Описание |
|------|----------|
| `apps/api` | FastAPI (`spektors_api`), Alembic, интеграции Ollama / Chroma |
| `apps/web-client` | Next.js, порт **3000** |
| `apps/web-lite` | Next.js, порт **3001** |
| `apps/web-admin` | Next.js, порт **3002** |
| `apps/web-dev` | Next.js (панель разработчика), порт **3003** |
| `apps/spektors-desktop` | Electron + React: Docker, `.env`, миграции, ссылки на сервисы |
| `packages/*` | `@spektors/api-client`, `chat-ui`, `ui-shell`, `next-i18n`, `ui-tokens`, `messages` |
| `config/apps.yaml` | Конфиг приложений (CORS и др.), путь от корня монорепо |
| `docker-compose.yml` | Postgres, Ollama, Chroma, сервис `api` |
| `docs/` | ТЗ лаунчера, снимки OpenAPI, прочая документация |

## Скрипты (корень `package.json`)

| Команда | Действие |
|---------|----------|
| `npm run dev:api` | Uvicorn API с reload, порт 8000 |
| `npm run dev:web-client` | web-client |
| `npm run dev:web-lite` | web-lite |
| `npm run dev:web-admin` | web-admin |
| `npm run dev:web-dev` | web-dev |
| `npm run dev:desktop` | десктоп-лаунчер (Electron) |
| `npm run build:all` | сборка всех workspace с полем `build` |
| `npm run test:api` | pytest API |
| `npm run test:e2e` | Playwright |
| `npm run check:openapi` | проверка OpenAPI |
| `npm run openapi:snapshot` | обновить `docs/openapi.snapshot.json` |
| `npm run check:i18n` | проверка ключей i18n |

После `npm install` автоматически собираются пакеты `@spektors/api-client`, `@spektors/next-i18n`, `@spektors/chat-ui`, `@spektors/ui-shell` (см. `postinstall`).

## API и база данных

Подробности по переменным окружения, health, rate limit и миграциям: [**apps/api/README.md**](apps/api/README.md).

Ручные миграции из каталога `apps/api`:

```bash
cd apps/api
py -3 -m alembic upgrade head
```

## Десктоп-лаунчер

Цели и план развития: [**docs/DESKTOP_LAUNCHER_TZ.md**](docs/DESKTOP_LAUNCHER_TZ.md).

```bash
npm run dev:desktop
```

## Публикация в GitHub (уже настроено локально)

После клонирования на новой машине:

```bash
git remote -v
git push -u origin main
```

Для HTTPS-пуша GitHub попросит аутентификацию (**Personal Access Token** вместо пароля или **SSH-ключ**). Пустой репозиторий на GitHub: создайте `Banck` без README, затем выполните первый `git push` из этой копии проекта.