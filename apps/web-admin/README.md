# web-admin

Operator console for Spektors: thread list and human replies via Next.js BFF or direct API (development).

## Run

From the monorepo root (`Banck/`):

```bash
npm install
npm run dev:web-admin
```

Open [http://localhost:3002](http://localhost:3002). Locales are under `/ru`, `/en`, `/nl` (see `i18n/routing.ts`).

## Environment

See [`.env.example`](./.env.example). For the thread list and **Send via BFF** to work, set `INTERNAL_ADMIN_TOKEN` in `.env.local` to the same value the API expects for internal admin routes.

- `SPEKTORS_API_URL` — API base for server-side proxy (optional; defaults to `NEXT_PUBLIC_API_URL` or `http://localhost:8000`).
- `NEXT_PUBLIC_API_URL` — used by the browser for **Direct API** mode and for Swagger links in the shell.

Start the API separately, e.g. from repo root: `npm run dev:api` (port 8000).

Operator metadata (workflow status, internal notes, audit log) and the extended thread list require PostgreSQL migration **`0002_admin_thread_meta_audit`** on the API database (`alembic upgrade head` from `apps/api` when your environment uses Alembic).

## App routes

| Path | Purpose |
| ---- | ------- |
| `/inbox` | Queue, conversation, reply, thread meta |
| `/history` | Recent threads (browser `localStorage`) |
| `/docs` | Embedded Swagger UI (iframe) |
| `/settings` | Polling interval, sound, display name, API check |
| `/supervisor` | Audit log (via BFF) |
| `/integrations` | Optional integrations roadmap |

## Scripts

| Script    | Description                    |
| --------- | ------------------------------ |
| `npm run dev`   | Next dev with Turbopack on port 3002 |
| `npm run build` | Production build                     |
| `npm run start` | Production server on port 3002       |
| `npm run lint`  | ESLint                               |

## i18n

Messages live in `@spektors/messages` (`packages/messages/locales/web-admin/`). After editing keys, run `npm run check:i18n` from the monorepo root.
