import {
  ProfileMenu,
  ThemeToggle,
  SPEKTORS_PROFILE_STORAGE_KEY,
  type SpektorsProfileV1,
} from "@spektors/ui-shell";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { SpektorsLauncherAPI } from "./spektors-launcher";

function getApi(): SpektorsLauncherAPI | null {
  return typeof window !== "undefined" && window.spektorsLauncher
    ? window.spektorsLauncher
    : null;
}

function isElectronUserAgent(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent.includes("Electron");
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
const RECENT_ROOTS_KEY = "spektors-launcher:recent-roots";
const API_HEALTH_URL = "http://127.0.0.1:8000/docs";
const NAV_KEY = "spektors-launcher:active-nav";

type NavId = "repo" | "services" | "docker" | "api" | "env" | "log";

const dragStyle = { WebkitAppRegion: "drag" } as CSSProperties;
const noDragStyle = { WebkitAppRegion: "no-drag" } as CSSProperties;

function Panel(props: {
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--glass-border)] bg-[var(--panel-fill)] p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 shrink-0 text-accent">{props.icon}</span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[color:var(--fg)]">
              {props.title}
            </h2>
            {props.description ? (
              <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--fg-muted)]">
                {props.description}
              </p>
            ) : null}
          </div>
        </div>
        {props.actions ? (
          <div className="shrink-0" style={noDragStyle}>
            {props.actions}
          </div>
        ) : null}
      </div>
      <div style={noDragStyle}>{props.children}</div>
    </div>
  );
}

function WindowChrome(props: { api: SpektorsLauncherAPI }) {
  return (
    <div className="flex h-10 shrink-0 select-none items-stretch border-b border-[var(--glass-border)] bg-[var(--sidebar-bg)]">
      <div
        className="flex min-w-0 flex-1 items-center px-3"
        style={dragStyle}
        onDoubleClick={() => props.api.winMaximizeToggle()}
        title="Перетащите окно. Двойной клик — развернуть или восстановить."
      >
        <span className="pointer-events-none text-xs font-semibold tracking-tight text-[color:var(--fg-muted)]">
          Spektors Launcher
        </span>
      </div>
      <div className="flex shrink-0" style={noDragStyle}>
        <button
          type="button"
          className="flex h-10 w-11 items-center justify-center text-[color:var(--fg-muted)] transition hover:bg-[var(--glass-highlight)]"
          onClick={() => props.api.winMinimize()}
          aria-label="Свернуть"
        >
          <span className="pb-0.5 text-base leading-none">−</span>
        </button>
        <button
          type="button"
          className="flex h-10 w-11 items-center justify-center text-[color:var(--fg-muted)] transition hover:bg-[var(--glass-highlight)]"
          onClick={() => props.api.winMaximizeToggle()}
          aria-label="Развернуть или восстановить"
        >
          <span className="text-[10px] font-bold leading-none">▢</span>
        </button>
        <button
          type="button"
          className="flex h-10 w-11 items-center justify-center text-[color:var(--fg-muted)] transition hover:bg-red-600 hover:text-white"
          onClick={() => props.api.winClose()}
          aria-label="Закрыть"
        >
          <span className="text-lg leading-none">×</span>
        </button>
      </div>
    </div>
  );
}

function NavItem(props: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left text-sm transition ${
        props.active
          ? "border-accent/35 bg-accent/10 text-[color:var(--fg)]"
          : "border-transparent text-[color:var(--fg-muted)] hover:border-[var(--glass-border)] hover:bg-[var(--panel-fill)]"
      }`}
      style={noDragStyle}
    >
      <span className={props.active ? "text-accent" : "opacity-80"}>
        {props.icon}
      </span>
      <span className="font-medium">{props.label}</span>
    </button>
  );
}

export default function App() {
  const [api, setApi] = useState<SpektorsLauncherAPI | null>(() => getApi());
  const [bridge, setBridge] = useState<"pending" | "ok" | "fail">(() =>
    getApi() ? "ok" : "pending",
  );

  useEffect(() => {
    if (getApi()) {
      setApi(getApi());
      setBridge("ok");
      return;
    }
    let attempts = 0;
    const id = window.setInterval(() => {
      const next = getApi();
      if (next) {
        setApi(next);
        setBridge("ok");
        window.clearInterval(id);
        return;
      }
      attempts += 1;
      if (attempts >= 120) {
        window.clearInterval(id);
        setBridge("fail");
      }
    }, 50);
    return () => window.clearInterval(id);
  }, []);

  const [root, setRoot] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLPreElement>(null);

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
  const [reach, setReach] = useState<Record<string, boolean | null>>({});
  const [probing, setProbing] = useState(false);
  const [recentRoots, setRecentRoots] = useState<string[]>(() => {
    try {
      const r = localStorage.getItem(RECENT_ROOTS_KEY);
      return r ? (JSON.parse(r) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [apiHealthOk, setApiHealthOk] = useState<boolean | null>(null);
  const [profileMenuKey, setProfileMenuKey] = useState(0);
  const [activeNav, setActiveNav] = useState<NavId>(() => {
    try {
      const s = localStorage.getItem(NAV_KEY);
      if (
        s === "repo" ||
        s === "services" ||
        s === "docker" ||
        s === "api" ||
        s === "env" ||
        s === "log"
      )
        return s;
    } catch {
      /* */
    }
    return "repo";
  });

  useEffect(() => {
    try {
      localStorage.setItem(NAV_KEY, activeNav);
    } catch {
      /* */
    }
  }, [activeNav]);

  const pushRecentRoot = useCallback((dir: string) => {
    const d = dir.trim();
    if (!d) return;
    setRecentRoots((prev) => {
      const next = [d, ...prev.filter((x) => x !== d)].slice(0, 5);
      try {
        localStorage.setItem(RECENT_ROOTS_KEY, JSON.stringify(next));
      } catch {
        /* */
      }
      return next;
    });
  }, []);

  const persistProfileToDisk = useCallback(
    async (p: SpektorsProfileV1) => {
      if (!api) return;
      try {
        await api.writeProfileFile(JSON.stringify(p));
      } catch {
        /* */
      }
    },
    [api],
  );

  useEffect(() => {
    if (!api || bridge !== "ok") return;
    void (async () => {
      try {
        const fileJson = await api.readProfileFile();
        if (!fileJson?.trim()) return;
        const hasLs = localStorage.getItem(SPEKTORS_PROFILE_STORAGE_KEY);
        if (!hasLs) {
          localStorage.setItem(SPEKTORS_PROFILE_STORAGE_KEY, fileJson);
          setProfileMenuKey((k) => k + 1);
        }
      } catch {
        /* */
      }
    })();
  }, [api, bridge]);

  useEffect(() => {
    if (!api || bridge !== "ok") return;
    const tick = () => {
      void api.probeUrl(API_HEALTH_URL).then(setApiHealthOk);
    };
    tick();
    const id = window.setInterval(tick, 12000);
    return () => window.clearInterval(id);
  }, [api, bridge]);

  const appendLog = useCallback((line: string) => {
    setLog((prev) => [...prev.slice(-200), line]);
  }, []);

  useLayoutEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [log]);

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

  const runProbeAll = useCallback(async () => {
    if (!api || !valid?.ok) return;
    setProbing(true);
    try {
      const next: Record<string, boolean | null> = {};
      for (const { url } of LINKS) {
        next[url] = await api.probeUrl(url);
      }
      setReach(next);
    } finally {
      setProbing(false);
    }
  }, [api, valid?.ok]);

  useEffect(() => {
    if (!api || !valid?.ok) {
      setReach({});
      return;
    }
    let cancelled = false;
    void (async () => {
      await runProbeAll();
      if (cancelled) return;
    })();
    const id = setInterval(() => {
      void runProbeAll();
    }, 12000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [api, valid?.ok, runProbeAll]);

  const pickFolder = async () => {
    if (!api) return;
    const p = await api.openDirectory();
    if (p) {
      setRoot(p);
      pushRecentRoot(p);
    }
  };

  const copyRootPath = async () => {
    if (!api || !root.trim()) return;
    await api.writeClipboard(root.trim());
    appendLog("Путь к репозиторию скопирован.");
  };

  const openRepoFolder = async () => {
    if (!api || !root.trim()) return;
    const err = await api.openPath(root.trim());
    if (err) appendLog(`Не удалось открыть папку: ${err}`);
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
      const out = `[${label}] exit ${r.code}\n${r.stdout || ""}${r.stderr || ""}`.trim();
      appendLog(out);
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

  const clearLog = () => setLog([]);

  const copyLog = async () => {
    if (!api) return;
    const text =
      log.length === 0
        ? ""
        : log.join("\n\n—\n\n");
    await api.writeClipboard(text);
    appendLog("Лог скопирован в буфер.");
  };

  if (bridge === "pending") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--bg)] p-8 text-white/60">
        <span
          className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-accent"
          aria-hidden
        />
        <p className="text-sm">Подключение к Electron…</p>
      </div>
    );
  }

  if (bridge === "fail" || !api) {
    const electronShell = isElectronUserAgent();
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-8">
        <div className="max-w-lg rounded-2xl border border-white/10 bg-[var(--glass)] p-8 shadow-card backdrop-blur-md">
          {electronShell ? (
            <>
              <h1 className="text-xl font-bold text-amber-200/95">
                Не загрузился preload (мост IPC)
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-white/55">
                Окно Electron открыто, но <code className="font-mono text-white/70">window.spektorsLauncher</code>{" "}
                недоступен. Обычно это из‑за sandbox preload или неверного пути к
                скрипту. Полностью закройте лаунчер и снова запустите из корня
                репозитория:
              </p>
              <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-sm text-accent">
                npm run dev:desktop
              </pre>
              <p className="mt-3 text-xs text-white/40">
                В терминале, где запущен dev, должна быть строка{" "}
                <span className="font-mono text-white/50">[spektors-desktop] preload:</span> с путём к{" "}
                <span className="font-mono text-white/50">index.mjs</span>. Если её нет или есть ошибка preload —
                пришлите этот вывод.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-white">
                Нужно окно Electron, не браузер
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-white/55">
                Страница открыта во внешнем браузере (например Vite на порту 5173).
                Выбор папки, Docker и .env доступны только в отдельном окне приложения.
              </p>
              <p className="mt-4 text-sm font-medium text-white/70">
                В терминале из корня монорепо:
              </p>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-sm text-accent">
                npm run dev:desktop
              </pre>
              <p className="mt-3 text-xs text-white/40">
                Либо{" "}
                <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-white/60">
                  cd apps/spektors-desktop
                </code>{" "}
                →{" "}
                <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-white/60">
                  npm run dev
                </code>
                .
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  const customWindowChrome = api.platform !== "darwin";

  return (
    <div
      className="flex h-full flex-col bg-[var(--bg)]"
      style={{ backgroundImage: "var(--bg-gradient)" }}
    >
      {customWindowChrome ? <WindowChrome api={api} /> : null}

      <div className="flex min-h-0 min-w-0 flex-1">
        <aside
          className="flex w-[220px] shrink-0 flex-col border-r border-[var(--glass-border)] bg-[var(--sidebar-bg)] py-2 pl-2 pr-1.5"
          style={noDragStyle}
        >
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--fg-muted)]">
            Разделы
          </p>
          <nav className="flex flex-col gap-0.5">
            <NavItem
              active={activeNav === "repo"}
              onClick={() => setActiveNav("repo")}
              icon={<IconFolder />}
              label="Репозиторий"
            />
            <NavItem
              active={activeNav === "services"}
              onClick={() => setActiveNav("services")}
              icon={<IconBrowser />}
              label="Сервисы"
            />
            <NavItem
              active={activeNav === "docker"}
              onClick={() => setActiveNav("docker")}
              icon={<IconDocker />}
              label="Docker"
            />
            <NavItem
              active={activeNav === "api"}
              onClick={() => setActiveNav("api")}
              icon={<IconApi />}
              label="API и БД"
            />
            <NavItem
              active={activeNav === "env"}
              onClick={() => setActiveNav("env")}
              icon={<IconEnv />}
              label=".env"
            />
            <NavItem
              active={activeNav === "log"}
              onClick={() => setActiveNav("log")}
              icon={<IconLog />}
              label="Лог"
            />
          </nav>

          <div className="mt-auto flex flex-col gap-2 border-t border-[var(--glass-border)] pt-3">
            <div
              className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px]"
              style={{
                borderColor: "var(--glass-border)",
                color: "var(--fg-muted)",
              }}
              title="Локальный API"
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  apiHealthOk === true
                    ? "bg-emerald-400"
                    : apiHealthOk === false
                      ? "bg-red-400/80"
                      : "bg-[var(--fg-muted)] opacity-40"
                }`}
              />
              API :8000
            </div>
            <button
              type="button"
              onClick={() => void api.openExternal("http://localhost:3000")}
              className="w-full rounded-md border px-2 py-1.5 text-left text-xs font-medium transition hover:border-accent/40"
              style={{
                borderColor: "var(--glass-border)",
                color: "var(--fg-muted)",
              }}
            >
              Открыть сайт
            </button>
            <div className="flex items-center justify-between gap-1">
              <ThemeToggle
                className="flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--glass-border)] bg-[var(--glass)] text-base shadow-none transition hover:border-accent/40 hover:bg-[var(--glass-highlight)]"
                labels={{
                  toggle: "Тема",
                  activateLight: "Светлая тема",
                  activateDark: "Тёмная тема",
                }}
              />
              <ProfileMenu
                key={profileMenuKey}
                presentation="modal"
                onAfterSave={(p) => void persistProfileToDisk(p)}
              />
            </div>
          </div>
        </aside>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <div className="mx-auto max-w-3xl space-y-4 pb-6">
            {activeNav === "repo" ? (
              <Panel
                title="Репозиторий"
                description="Корень монорепо: package.json, docker-compose, apps/api."
                icon={<IconFolder />}
              >
          <div className="flex flex-wrap gap-2">
            <input
              readOnly
              value={root}
              placeholder="Корень монорепо Spektors…"
              className="min-w-[220px] flex-1 rounded-xl border px-3 py-2.5 font-mono text-xs outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
              style={{
                borderColor: "var(--glass-border)",
                background: "var(--glass-highlight)",
                color: "var(--fg)",
              }}
            />
            <button
              type="button"
              onClick={() => void pickFolder()}
              className="rounded-xl bg-accent/20 px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent/30"
            >
              Выбрать папку
            </button>
            <button
              type="button"
              disabled={!root.trim()}
              onClick={() => void openRepoFolder()}
              className="rounded-xl border px-4 py-2.5 text-sm font-medium transition hover:border-accent/35 disabled:opacity-35"
              style={{
                borderColor: "var(--glass-border)",
                color: "var(--fg-muted)",
              }}
            >
              В проводнике
            </button>
            <button
              type="button"
              disabled={!root.trim()}
              onClick={() => void copyRootPath()}
              className="rounded-xl border px-4 py-2.5 text-sm font-medium transition hover:border-accent/35 disabled:opacity-35"
              style={{
                borderColor: "var(--glass-border)",
                color: "var(--fg-muted)",
              }}
            >
              Копировать путь
            </button>
          </div>
          {recentRoots.length > 0 ? (
            <div className="mt-3">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-[color:var(--fg-muted)]">
                Недавние
              </p>
              <div className="flex flex-wrap gap-1.5">
                {recentRoots.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRoot(r)}
                    className="max-w-full truncate rounded-lg border px-2 py-1 text-left font-mono text-[10px] transition hover:border-accent/40"
                    style={{
                      borderColor: "var(--glass-border)",
                      color: "var(--fg-muted)",
                    }}
                    title={r}
                  >
                    {r.replace(/\\/g, "/").split("/").slice(-2).join("/")}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {valid && (
            <p
              className={`mt-3 text-sm font-medium ${valid.ok ? "text-emerald-500 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
            >
              {valid.ok
                ? "Корень распознан (package.json, docker-compose, apps/api)."
                : valid.reason}
            </p>
          )}
              </Panel>
            ) : activeNav === "services" ? (
              <Panel
                title="Локальные сервисы"
                description="Проверка HTTP каждые ~12 с. Зелёный индикатор — ответ получен."
                icon={<IconBrowser />}
                actions={
                  <button
                    type="button"
                    disabled={!valid?.ok || probing}
                    onClick={() => void runProbeAll()}
                    className="rounded-md border px-2.5 py-1 text-[11px] font-medium transition hover:border-accent/40 disabled:opacity-40"
                    style={{
                      borderColor: "var(--glass-border)",
                      color: "var(--fg-muted)",
                    }}
                  >
                    {probing ? "Проверка…" : "Сейчас"}
                  </button>
                }
              >
                <div className="flex flex-wrap gap-2">
                  {LINKS.map(({ label, url }) => {
                    const up = reach[url];
                    return (
                      <button
                        key={url}
                        type="button"
                        disabled={!valid?.ok}
                        onClick={() => void api.openExternal(url)}
                        className="flex items-center gap-2 rounded-md border px-3 py-2 text-left text-xs transition hover:border-accent/40 disabled:opacity-40"
                        style={{
                          borderColor: "var(--glass-border)",
                          background: "var(--glass-highlight)",
                          color: "var(--fg)",
                        }}
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            up === true
                              ? "bg-emerald-400"
                              : up === false
                                ? "bg-[var(--fg-muted)] opacity-40"
                                : "animate-pulse bg-[var(--fg-muted)] opacity-30"
                          }`}
                          title={
                            up === true
                              ? "Онлайн"
                              : up === false
                                ? "Офлайн"
                                : "…"
                          }
                        />
                        <span className="font-medium">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </Panel>
            ) : activeNav === "docker" ? (
              <Panel
                title="Docker Compose"
                description="Первый полный подъём может занять время (Ollama, сборка API)."
                icon={<IconDocker />}
              >
                <div className="flex flex-wrap gap-2">
                  <ActionBtn
                    disabled={!valid?.ok || busy !== null}
                    loading={busy === "postgres"}
                    onClick={() =>
                      void runDocker("postgres", [
                        "compose",
                        "up",
                        "-d",
                        "postgres",
                      ])
                    }
                    label="Postgres"
                  />
                  <ActionBtn
                    disabled={!valid?.ok || busy !== null}
                    loading={busy === "stack"}
                    onClick={() =>
                      void runDocker("stack", ["compose", "up", "-d"])
                    }
                    label="Весь стек"
                  />
                  <ActionBtn
                    disabled={!valid?.ok || busy !== null}
                    loading={busy === "down"}
                    onClick={() => void runDocker("down", ["compose", "down"])}
                    label="compose down"
                  />
                </div>
              </Panel>
            ) : activeNav === "api" ? (
              <Panel
                title="API и база"
                description="Таблицы — через psql или GUI; строка compose по умолчанию в подсказке psql."
                icon={<IconApi />}
              >
                <div className="flex flex-wrap gap-2">
                  <ActionBtn
                    disabled={!valid?.ok || busy !== null}
                    onClick={() => void startApiBackground()}
                    label="API локально (uvicorn)"
                  />
                  <ActionBtn
                    disabled={!valid?.ok || busy !== null}
                    loading={busy === "alembic"}
                    onClick={() => void runAlembic()}
                    label="Alembic upgrade"
                  />
                  <ActionBtn
                    disabled={!valid?.ok}
                    onClick={() => void copyPsql()}
                    label="Копировать psql"
                  />
                </div>
              </Panel>
            ) : activeNav === "env" ? (
              <Panel
                title=".env в корне репо"
                description="Редактирование файла окружения выбранного репозитория."
                icon={<IconEnv />}
                actions={
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!valid?.ok || !hasEnvExample}
                      onClick={() => void copyFromExample()}
                      className="rounded-md border px-2.5 py-1 text-xs transition hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/5"
                      style={{
                        borderColor: "var(--glass-border)",
                        color: "var(--fg-muted)",
                      }}
                    >
                      Из .env.example
                    </button>
                    <button
                      type="button"
                      disabled={!valid?.ok || !envDirty}
                      onClick={() => void saveEnv()}
                      className="rounded-md bg-accent/25 px-3 py-1 text-xs font-semibold text-accent transition hover:bg-accent/35 disabled:opacity-40"
                    >
                      Сохранить
                    </button>
                  </div>
                }
              >
                <textarea
                  value={envText}
                  disabled={!valid?.ok}
                  onChange={(e) => {
                    setEnvText(e.target.value);
                    setEnvDirty(true);
                  }}
                  spellCheck={false}
                  className="h-52 w-full resize-y rounded-md border p-3 font-mono text-xs leading-relaxed outline-none transition focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
                  style={{
                    borderColor: "var(--glass-border)",
                    background: "var(--glass-highlight)",
                    color: "var(--fg)",
                  }}
                  placeholder="# после выбора корня появится содержимое .env"
                />
              </Panel>
            ) : activeNav === "log" ? (
              <Panel
                title="Лог команд"
                description="Вывод docker и alembic."
                icon={<IconLog />}
                actions={
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={log.length === 0}
                      onClick={clearLog}
                      className="rounded-md border px-2.5 py-1 text-xs transition hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/5"
                      style={{
                        borderColor: "var(--glass-border)",
                        color: "var(--fg-muted)",
                      }}
                    >
                      Очистить
                    </button>
                    <button
                      type="button"
                      disabled={log.length === 0}
                      onClick={() => void copyLog()}
                      className="rounded-md border px-2.5 py-1 text-xs transition hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/5"
                      style={{
                        borderColor: "var(--glass-border)",
                        color: "var(--fg-muted)",
                      }}
                    >
                      Копировать
                    </button>
                  </div>
                }
              >
                <pre
                  ref={logContainerRef}
                  className="max-h-[min(420px,55vh)] overflow-auto rounded-md border p-3 font-mono text-[11px] leading-relaxed"
                  style={{
                    borderColor: "var(--glass-border)",
                    background: "var(--glass-highlight)",
                    color: "var(--fg-muted)",
                  }}
                >
                  {log.length === 0
                    ? "Вывод docker / alembic появится здесь."
                    : log.join("\n\n—\n\n")}
                  <div ref={logEndRef} />
                </pre>
              </Panel>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function ActionBtn(props: {
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
  label: string;
}) {
  const showSpinner = props.loading;
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition hover:border-accent/40 disabled:opacity-40"
      style={{
        borderColor: "var(--glass-border)",
        background: "var(--glass-highlight)",
        color: "var(--fg)",
      }}
    >
      {showSpinner ? (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-accent border-[var(--glass-border)]"
          aria-hidden
        />
      ) : null}
      {props.label}
    </button>
  );
}

function IconFolder() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBrowser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M3 8h18" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="6" cy="6" r="0.9" fill="currentColor" />
    </svg>
  );
}

function IconDocker() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10h2v2H4v-2zm4 0h2v2H8v-2zm4 0h2v2h-2v-2zm-8 4h2v2H4v-2zm4 0h2v2H8v-2zm4 0h2v2h-2v-2zm4-4h2v2h-2v-2zm0 4h2v2h-2v-2zM6 18h12v2H6v-2z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconApi() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 16l-4-4 4-4M16 8l4 4-4 4M13 5l-2 14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconEnv() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 4h8l4 4v12a1 1 0 01-1 1H6a1 1 0 01-1-1V5a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 4v4h4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconLog() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 4h12a1 1 0 011 1v14l-3-2-3 2-3-2-3 2V5a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
