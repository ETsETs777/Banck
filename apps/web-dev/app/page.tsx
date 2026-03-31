import { AppIdsFromApi } from "./AppIdsFromApi";
import { CopyApiLink } from "./CopyApiLink";

const defaultBase = "http://localhost:8000";

export default function Home() {
  const base = process.env.NEXT_PUBLIC_API_URL ?? defaultBase;
  const b = base.replace(/\/$/, "");

  const links: { href: string; label: string }[] = [
    { href: `${b}/docs`, label: "Swagger UI (/docs)" },
    { href: `${b}/redoc`, label: "ReDoc (/redoc)" },
    { href: `${b}/openapi.json`, label: "OpenAPI JSON" },
    { href: `${b}/api/v1/health`, label: "GET /api/v1/health" },
    { href: `${b}/api/v1/health/live`, label: "GET /api/v1/health/live" },
    { href: `${b}/api/v1/health/ready`, label: "GET /api/v1/health/ready" },
    { href: `${b}/api/v1/health/db`, label: "GET /api/v1/health/db" },
    { href: `${b}/api/v1/meta/config-check`, label: "GET /api/v1/meta/config-check" },
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <div
        className="rounded-2xl border p-8 shadow-glow backdrop-blur-md"
        style={{
          background: "var(--glass)",
          borderColor: "var(--glass-border)",
        }}
      >
        <p className="text-sm text-muted">web-dev · порт 3003</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Панель разработчика
        </h1>
        <p className="mt-4 text-sm text-muted">
          База API:{" "}
          <code className="text-accent">{b}</code> (переменная{" "}
          <code className="text-foreground/80">NEXT_PUBLIC_API_URL</code>).
        </p>
        <p className="mt-2 text-xs text-muted">
          Internal dev API:{" "}
          <code className="text-accent">/internal/dev/v1/*</code> — см. Swagger,
          схема Bearer.
        </p>
        <AppIdsFromApi apiBase={b} />
      </div>
      <ul className="space-y-2">
        {links.map(({ href, label }) => (
          <li
            key={href}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm"
          >
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline-offset-2 hover:underline"
            >
              {label}
            </a>
            <CopyApiLink href={href} />
          </li>
        ))}
      </ul>
    </main>
  );
}
