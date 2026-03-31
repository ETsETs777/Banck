import { useCallback, useEffect, useState } from "react";
import type { SpektorsLauncherAPI } from "./spektors-launcher";

function getApi(): SpektorsLauncherAPI | null {
  return typeof window !== "undefined" && window.spektorsLauncher
    ? window.spektorsLauncher
    : null;
}

const LINKS: { label: string; url: string }[] = [
  { label: "web-client :3000", url: "http://localhost:3000" },
  { label: "web-lite :3001", url: "http://localhost:3001" },
  { label: "web-admin :3002", url: "http://localhost:3002" },
  { label: "web-dev :3003", url: "http://localhost:3003" },
  { label: "API Swagger", url: "http://localhost:8000/docs" },
];

const PSQL =
  "psql postgresql://spektors:spektors@localhost:5432/spektors";

const ROOT_STORAGE_KEY = "spektors-launcher:root";

export default function App() {
  const api = getApi();
  const [root, setRoot] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(ROOT_STORAGE_KEY);
    if (saved) setRoot(saved);
  }, []);

  useEffect(() => {
    if (root.trim()) localStorage.setItem(ROOT_STORAGE_KEY, root.trim());
  }, [root]);
  const [valid, setValid] = useState<{
    ok: boolean;
    reason?: string;
  } | null>(null);
  const [envText, setEnvText] = useState("");
  const [envDirty, setEnvDirty] = useState(false);
  const [hasEnvExample, setHasEnvExample] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const appendLog = useCallback((line: string) => {
    setLog((prev) => [...prev.slice(-200), line]);
  }, []);

  const refreshValidation = useCallback(async () => {
    if (!api || !root.trim()) {
      setValid(null);
      return;
    }
    const v = await api.validateProject(root.trim());
    setValid(v.ok ? { ok: true } : { ok: false, reason: v.reason });
  }, [api, root]);

  useEffect(() => {
    void refreshValidation();
  }, [refreshValidation]);

  const loadEnv = useCallback(async () => {
    if (!api || !root.trim() || !valid?.ok) return;
    const t = await api.readEnv(root.trim());
    setEnvText(t);
    setEnvDirty(false);
    setHasEnvExample(await api.envExampleExists(root.trim()));
  }, [api, root, valid?.ok]);

  useEffect(() => {
    void loadEnv();
  }, [loadEnv]);

  const pickFolder = async () => {
    if (!api) return;
    const p = await api.openDirectory();
    if (p) setRoot(p);
  };

  const runDocker = async (label: string, args: string[]) => {
    if (!api || !valid?.ok) return;
    setBusy(label);
    try {
      const r = await api.runCommand({
        command: "docker",
        args,
        cwd: root.trim(),
      });
      appendLog(
        `[${label}] exit ${r.code}\n${r.stdout || ""}${r.stderr || ""}`.trim(),
      );
    } finally {
      setBusy(null);
    }
  };

  const runAlembic = async () => {
    if (!api || !valid?.ok) return;
    setBusy("alembic");
    try {
      const r = await api.runCommand({
        command: "py",
        args: ["-3", "-m", "alembic", "upgrade", "head"],
        cwd: `${root.trim()}/apps/api`,
      });
      appendLog(
        `[alembic] exit ${r.code}\n${r.stdout || ""}${r.stderr || ""}`.trim(),
      );
    } finally {
      setBusy(null);
    }
  };

  const startApiBackground = async () => {
    if (!api || !valid?.ok) return;
    const { pid } = await api.spawnBackground({
      command: "py",
      args: [
        "-3",
        "-m",
        "uvicorn",
        "spektors_api.main:app",
        "--reload",
        "--port",
        "8000",
      ],
      cwd: `${root.trim()}/apps/api`,
    });
    appendLog(
      pid != null
        ? `API запущен в фоне (pid ${pid}). Остановите процесс вручную при необходимости.`
        : "API: процесс запущен в фоне.",
    );
  };

  const saveEnv = async () => {
    if (!api || !valid?.ok) return;
    await api.writeEnv(root.trim(), envText);
    setEnvDirty(false);
    appendLog(".env сохранён.");
  };

  const copyFromExample = async () => {
    if (!api || !valid?.ok) return;
    await api.copyEnvExample(root.trim());
    await loadEnv();
    appendLog(".env скопирован из .env.example");
  };

  const copyPsql = async () => {
    if (!api) return;
    await api.writeClipboard(PSQL);
    appendLog("Строка psql скопирована в буфер.");
  };

  if (!api) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <p className="text-center text-white/60">
          Запустите приложение через Electron (<code className="text-accent">npm run dev</code>{" "}
          в пакете spektors-desktop).
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(167,139,250,0.22),transparent)] p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Spektors Launcher
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Разворот Docker, миграции, .env и быстрые ссылки на локальные сервисы.
        </p>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-[var(--glass)] p-5 shadow-glow backdrop-blur-md">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-white/40">
            Репозиторий
          </h2>
          <div className="flex flex-wrap gap-2">
            <input
              readOnly
              value={root}
              placeholder="Корень монорепо Spektors…"
              className="min-w-[200px] flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-accent/50"
            />
            <button
              type="button"
              onClick={() => void pickFolder()}
              className="rounded-xl bg-accent/20 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/30"
            >
              Выбрать папку
            </button>
          </div>
          {valid && (
            <p
              className={`mt-3 text-sm ${valid.ok ? "text-emerald-400/90" : "text-amber-400/90"}`}
            >
              {valid.ok
                ? "Корень распознан (package.json, docker-compose, apps/api)."
                : valid.reason}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-[var(--glass)] p-5 backdrop-blur-md">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-white/40">
            Открыть в браузере
          </h2>
          <div className="flex flex-wrap gap-2">
            {LINKS.map(({ label, url }) => (
              <button
                key={url}
                type="button"
                disabled={!valid?.ok}
                onClick={() => void api.openExternal(url)}
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/80 transition hover:border-accent/40 hover:text-white disabled:opacity-40"
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[var(--glass)] p-5 backdrop-blur-md">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-white/40">
            Docker Compose
          </h2>
          <div className="flex flex-wrap gap-2">
            <ActionBtn
              disabled={!valid?.ok || busy !== null}
              onClick={() =>
                void runDocker("postgres", ["compose", "up", "-d", "postgres"])
              }
              label={busy === "postgres" ? "…" : "Postgres"}
            />
            <ActionBtn
              disabled={!valid?.ok || busy !== null}
              onClick={() =>
                void runDocker("stack", ["compose", "up", "-d"])
              }
              label={busy === "stack" ? "…" : "Весь стек"}
            />
            <ActionBtn
              disabled={!valid?.ok || busy !== null}
              onClick={() =>
                void runDocker("down", ["compose", "down"])
              }
              label={busy === "down" ? "…" : "compose down"}
            />
          </div>
          <p className="mt-3 text-xs text-white/40">
            Первый полный подъём может занять время (Ollama, сборка API).
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[var(--glass)] p-5 backdrop-blur-md">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-white/40">
            API и БД
          </h2>
          <div className="flex flex-wrap gap-2">
            <ActionBtn
              disabled={!valid?.ok || busy !== null}
              onClick={() => void startApiBackground()}
              label="API локально (uvicorn)"
            />
            <ActionBtn
              disabled={!valid?.ok || busy !== null}
              onClick={() => void runAlembic()}
              label={busy === "alembic" ? "…" : "Alembic upgrade"}
            />
            <ActionBtn
              disabled={!valid?.ok}
              onClick={() => void copyPsql()}
              label="Копировать psql"
            />
          </div>
          <p className="mt-3 text-xs text-white/40">
            Редактирование таблиц — через psql или GUI; строка подключения для compose по умолчанию
            выше.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[var(--glass)] p-5 backdrop-blur-md lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium uppercase tracking-wider text-white/40">
              .env в корне репо
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!valid?.ok || !hasEnvExample}
                onClick={() => void copyFromExample()}
                className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/70 hover:bg-white/5 disabled:opacity-40"
              >
                Из .env.example
              </button>
              <button
                type="button"
                disabled={!valid?.ok || !envDirty}
                onClick={() => void saveEnv()}
                className="rounded-lg bg-accent/25 px-3 py-1 text-xs font-medium text-accent hover:bg-accent/35 disabled:opacity-40"
              >
                Сохранить
              </button>
            </div>
          </div>
          <textarea
            value={envText}
            disabled={!valid?.ok}
            onChange={(e) => {
              setEnvText(e.target.value);
              setEnvDirty(true);
            }}
            spellCheck={false}
            className="h-40 w-full resize-y rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs text-white/85 outline-none focus:border-accent/40"
            placeholder="# после выбора корня появится содержимое .env"
          />
        </section>

        <section className="rounded-2xl border border-white/10 bg-[var(--glass)] p-5 backdrop-blur-md lg:col-span-2">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-white/40">
            Лог команд
          </h2>
          <pre className="max-h-48 overflow-auto rounded-xl border border-white/5 bg-black/50 p-3 font-mono text-[11px] leading-relaxed text-white/65">
            {log.length === 0
              ? "Вывод docker / alembic появится здесь."
              : log.join("\n\n—\n\n")}
          </pre>
        </section>
      </div>
    </div>
  );
}

function ActionBtn(props: {
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className="rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white/85 transition hover:border-accent/35 hover:bg-white/5 disabled:opacity-40"
    >
      {props.label}
    </button>
  );
}
