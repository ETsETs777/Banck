# ТЗ: Spektors Desktop — лаунчер разработки

**Версия:** 0.1 · **Март 2026**

## 1. Назначение

Небольшое **десктоп-приложение** для разработчиков: ускорить **развёртывание** монорепозитория Spektors (Docker, API, фронты), **править окружение** (`.env`), выполнять типовые операции с **PostgreSQL** (миграции, psql, просмотр без тяжёлого DBeaver на первом шаге).

Целевая аудитория: разработчик на **Windows / macOS / Linux** с установленными **Node.js**, **Docker Desktop** (или аналог), **Python 3** для локального API.

## 2. Стек (визуал и платформа)

| Слой | Выбор | Обоснование |
|------|--------|----------------|
| Оболочка | **Electron** | Кроссплатформа, один `npm run dev`, без Rust; доступ к ФС и `child_process`. |
| UI | **React 19 + TypeScript + Vite** | Тот же экосистемный стек, что у веб-приложений монорепо. |
| Стили | **Tailwind CSS** | Быстрая полировка; тёмная тема и «стеклянные» панели в духе Spektors (`ui-tokens`: акцент, blur, скругления). |
| Состояние | **React state + localStorage** (MVP) | Путь к репозиторию и последние команды; позже — `electron-store`. |

Альтернатива на будущее: **Tauri** (меньше размер бинарника), если появится требование к минимальному дистрибутиву.

## 3. Функциональные требования

### 3.1 MVP (текущий этап)

1. **Проект**
   - Выбор **корня монорепо** (диалог + сохранение в `localStorage`).
   - Проверка: наличие `package.json`, `docker-compose.yml`, `apps/api`.

2. **Сервисы (Docker Compose)**
   - Кнопки: **Поднять Postgres**, **Поднять стек** (`docker compose up -d postgres` / `...` без api при желании — отдельные пресеты).
   - Кнопка **Остановить** (compose down / stop — уточнить в UX: `docker compose stop` vs `down`).
   - Вывод **stdout/stderr** в панель логов в окне.

3. **API (локально)**
   - Кнопка **Запустить API** (`py -3 -m uvicorn ...` или `npm run dev:api` из корня) — отдельный процесс, логи в UI.
   - Кнопка **Открыть Swagger** (внешний браузер `http://localhost:8000/docs`).

4. **Фронты**
   - Быстрые ссылки: web-client 3000, web-lite 3001, web-admin 3002, web-dev 3003 (открыть в браузере).

5. **Окружение**
   - Редактор текстового файла **`.env` в корне репо** (создать из `.env.example`, если нет — предложить копирование).
   - Подсказка: `DATABASE_URL`, `INTERNAL_*`, `NEXT_PUBLIC_API_URL`.

6. **База данных**
   - Отображение **строки подключения** (из `.env` или дефолт compose).
   - Кнопка **Скопировать команду psql** (`docker compose exec -it postgres psql -U spektors -d spektors`).
   - Кнопка **Alembic upgrade** (`cd apps/api && ... alembic upgrade head` или вызов уже описанного в README сценария через `py -3`).

### 3.2 Следующие версии

- Встроенный **минимальный просмотр таблиц** (read-only): IPC → main → `docker compose exec postgres psql -t -c "SELECT ..."` с лимитом строк.
- Пресеты: «только БД», «БД + Ollama», «полный compose».
- Индикаторы **health** API (`/api/v1/health`, `/ready`) с polling.
- Упаковка **electron-builder** (installer / portable для Windows).

## 4. Нефункциональные требования

- Окно по умолчанию **960×720**, минимальный размер **800×600**.
- Не хранить секреты вне выбранного `.env` пользователя.
- Все shell-команды с **cwd = корень репо** (или явно `apps/api` для Alembic).
- Ошибки команд показывать в логах **красным** / иконкой.

## 5. Структура в монорепо

```
apps/spektors-desktop/
  src/
    main/            # Electron main (IPC, spawn, FS)
    preload/         # contextBridge API
    renderer/        # React + Vite UI (index.html, App.tsx)
  electron.vite.config.ts
  package.json
```

Корневой `package.json`: скрипт `dev:desktop` → `npm run dev -w spektors-desktop`.

## 6. Критерии приёмки MVP

- `npm run dev -w spektors-desktop` открывает окно с выбором пути и работающими кнопками Docker/API при валидном окружении.
- Редактирование и сохранение `.env` в корне репо.
- ТЗ (этот файл) и код согласованы по именам сервисов compose (`postgres`, и т.д.).

---

*Документ дополняется по мере реализации.*

**Итерация улучшений (v0.2):** см. [SPEKTORS_DESKTOP_IMPROVEMENTS_TZ.md](./SPEKTORS_DESKTOP_IMPROVEMENTS_TZ.md).
