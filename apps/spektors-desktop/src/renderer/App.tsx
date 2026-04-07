import {
  ProfileMenu,
  ThemeToggle,
  SPEKTORS_PROFILE_STORAGE_KEY,
  type SpektorsProfileV1,
} from "@spektors/ui-shell";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type {
  DockerContainerRow,
  LauncherEnvProfile,
  LauncherUserConfig,
  LogEntry,
} from "../shared/launcher-types";
import { DEFAULT_LAUNCHER_CONFIG } from "../shared/launcher-types";
import type { SpektorsLauncherAPI } from "./spektors-launcher";
import { CommandLog } from "./launcher/components/log/CommandLog";
import { SidebarCardBody } from "./launcher/components/sidebar/SidebarCardBody";
import {
  PinnedCardDropZone,
  SidebarCardShell,
} from "./launcher/components/shell/SidebarCardShell";
import { LauncherExpandedCardModal } from "./launcher/components/modals/LauncherExpandedCardModal";
import { LauncherScratchpadModal } from "./launcher/components/modals/LauncherScratchpadModal";
import {
  IconApi,
  IconBrowser,
  IconDocker,
  IconEnv,
  IconFolder,
  IconLog,
  IconMenu,
  IconNotes,
  IconPlay,
  IconRefresh,
} from "./launcher/components/shell/LauncherIcons";
import { LauncherPanel } from "./launcher/components/shell/LauncherPanel";
import { inferLevel, makeLogEntry } from "./launcher/utils/log-utils";
import { WindowChrome } from "./launcher/components/shell/WindowChrome";
import { YandexMusicMini } from "./launcher/components/shell/YandexMusicMini";
import {
  LauncherCardsProvider,
  type LauncherCardsValue,
} from "./launcher/context/launcher-cards-context";
import {
  isSidebarCardId,
  normalizeSidebarOrder,
  reorderSidebarCards,
  type SidebarCardId,
} from "./launcher/utils/sidebar-card-order";

function getApi(): SpektorsLauncherAPI | null {
  return typeof window !== "undefined" && window.spektorsLauncher
    ? window.spektorsLauncher
    : null;
}

function isElectronUserAgent(): boolean {
  return (
    typeof navigator !== "undefined" && navigator.userAgent.includes("Electron")
  );
}

const ROOT_STORAGE_KEY = "spektors-launcher:root";
const RECENT_ROOTS_KEY = "spektors-launcher:recent-roots";
const API_HEALTH_URL = "http://127.0.0.1:8000/docs";
const NAV_KEY = "spektors-launcher:active-nav";

type NavId = "repo" | "services" | "docker" | "api" | "env" | "log";

const noDragStyle = { WebkitAppRegion: "no-drag" } as CSSProperties;

function dockerBaseArgs(cfg: LauncherUserConfig): string[] {
  const a = ["compose"];
  if (cfg.composeFile?.trim()) {
    a.push("-f", cfg.composeFile.trim());
  }
  return a;
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
      className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2.5 text-left text-sm transition duration-200 max-lg:w-auto max-lg:min-w-[104px] max-lg:max-w-[148px] max-lg:shrink-0 lg:w-full ${
        props.active
          ? "border-accent/40 bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[color:var(--fg)] shadow-[0_0_24px_-10px_color-mix(in_srgb,var(--accent)_50%,transparent)]"
          : "border-transparent text-[color:var(--fg-muted)] hover:border-[color-mix(in_srgb,var(--glass-border)_70%,transparent)] hover:bg-[var(--panel-fill)] hover:text-[color:var(--fg)]"
      }`}
      style={noDragStyle}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${
          props.active
            ? "border-accent/30 bg-accent/15 text-accent"
            : "border-transparent bg-black/10 text-[color:var(--fg-muted)] opacity-90"
        }`}
      >
        {props.icon}
      </span>
      <span className="font-semibold tracking-tight">{props.label}</span>
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
  const [cfg, setCfg] = useState<LauncherUserConfig>(DEFAULT_LAUNCHER_CONFIG);
  const [valid, setValid] = useState<{
    ok: boolean;
    reason?: string;
  } | null>(null);
  const [envText, setEnvText] = useState("");
  const [envDirty, setEnvDirty] = useState(false);
  const [hasEnvExample, setHasEnvExample] = useState(false);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
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
    return "log";
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [containers, setContainers] = useState<DockerContainerRow[]>([]);
  const [dockerErr, setDockerErr] = useState<string | null>(null);
  const [stats, setStats] = useState<Awaited<
    ReturnType<SpektorsLauncherAPI["dockerStats"]>
  > >([]);
  const [gitBranch, setGitBranch] = useState("");
  const [gitDirty, setGitDirty] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [branchPick, setBranchPick] = useState("");
  const [alembicHead, setAlembicHead] = useState<string | null>(null);
  const [toolDocker, setToolDocker] = useState<string | null>(null);
  const [toolGit, setToolGit] = useState<string | null>(null);
  const [newSvcLabel, setNewSvcLabel] = useState("");
  const [newSvcUrl, setNewSvcUrl] = useState("");
  const [newServerName, setNewServerName] = useState("");
  const [newServerCwd, setNewServerCwd] = useState("apps/web-client");
  const [newServerCmd, setNewServerCmd] = useState("npm");
  const [newServerArgs, setNewServerArgs] = useState("run dev");
  const [managedRunning, setManagedRunning] = useState<
    Record<string, { procId: string; name: string }>
  >({});
  const [logTailId, setLogTailId] = useState<string | null>(null);
  const logTailIdRef = useRef<string | null>(null);
  const [snippetLabel, setSnippetLabel] = useState("");
  const [snippetCmd, setSnippetCmd] = useState("npm");
  const [snippetArgs, setSnippetArgs] = useState("run build");
  const [snippetCwd, setSnippetCwd] = useState(".");
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<SidebarCardId | null>(
    null,
  );
  const [scratchpadOpen, setScratchpadOpen] = useState(false);

  const openExpandedCard = useCallback((id: SidebarCardId) => {
    setExpandedCardId(id);
  }, []);

  const sidebarOrder = useMemo(
    () => normalizeSidebarOrder(cfg.sidebarCardOrder),
    [cfg.sidebarCardOrder],
  );

  const onDropReorder = useCallback(
    (fromId: string, toId: string) => {
      setCfg((c) => {
        const order = normalizeSidebarOrder(c.sidebarCardOrder);
        let pinnedSidebarCardId = c.pinnedSidebarCardId;
        if (pinnedSidebarCardId === fromId) {
          pinnedSidebarCardId = null;
        }
        const sidebarCardOrder = reorderSidebarCards(order, fromId, toId);
        const next = { ...c, sidebarCardOrder, pinnedSidebarCardId };
        void api?.setLauncherConfig(next);
        return next;
      });
    },
    [api],
  );

  const prevReachRef = useRef<Record<string, boolean | null>>({});
  const sectionRefs = useRef<
    Partial<
      Record<
        NavId | "logPanel" | "customServers" | "snippets",
        HTMLDivElement | null
      >
    >
  >({});

  useEffect(() => {
    try {
      localStorage.setItem(NAV_KEY, activeNav);
    } catch {
      /* */
    }
  }, [activeNav]);

  useEffect(() => {
    if (activeNav === "log") {
      sectionRefs.current.logPanel?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else {
      const el = sectionRefs.current[activeNav];
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeNav]);

  useEffect(() => {
    if (!expandedCardId && !scratchpadOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpandedCardId(null);
        setScratchpadOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandedCardId, scratchpadOpen]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ROOT_STORAGE_KEY);
      if (saved?.trim()) setRoot(saved.trim());
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    if (root.trim()) localStorage.setItem(ROOT_STORAGE_KEY, root.trim());
  }, [root]);

  const appendEntry = useCallback((e: LogEntry) => {
    setLogEntries((prev) => [...prev.slice(-4000), e]);
  }, []);

  const clearLog = useCallback(() => setLogEntries([]), []);

  const pushHistory = useCallback(
    (line: string) => {
      setCfg((c) => {
        const next = {
          ...c,
          commandHistory: [line, ...c.commandHistory.filter((x) => x !== line)].slice(
            0,
            50,
          ),
        };
        void api?.setLauncherConfig(next);
        return next;
      });
    },
    [api],
  );

  const persistCfg = useCallback(async () => {
    if (!api) return;
    await api.setLauncherConfig(cfg);
    appendEntry(
      makeLogEntry("config", "Конфигурация лаунчера сохранена.", "info"),
    );
  }, [api, cfg, appendEntry]);

  useEffect(() => {
    if (!api || bridge !== "ok") return;
    void (async () => {
      const c = await api.getLauncherConfig();
      setCfg(c);
    })();
  }, [api, bridge]);

  useEffect(() => {
    if (!api || bridge !== "ok") return;
    void (async () => {
      try {
        const fileJson = await api.readProfileFile();
        if (fileJson?.trim()) {
          const hasLs = localStorage.getItem(SPEKTORS_PROFILE_STORAGE_KEY);
          if (!hasLs) {
            localStorage.setItem(SPEKTORS_PROFILE_STORAGE_KEY, fileJson);
            setProfileMenuKey((k) => k + 1);
          }
        }
      } catch {
        /* */
      }
    })();
  }, [api, bridge]);

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
      const d = await api.which("docker");
      setToolDocker(d.found ? d.path : null);
      const g = await api.which("git");
      setToolGit(g.found ? g.path : null);
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
      for (const { url } of cfg.services) {
        next[url] = await api.probeUrl(url);
      }
      setReach(next);
    } finally {
      setProbing(false);
    }
  }, [api, valid?.ok, cfg.services]);

  useEffect(() => {
    if (!api || !valid?.ok) {
      setReach({});
      return;
    }
    void (async () => {
      await runProbeAll();
    })();
    const id = setInterval(() => {
      void runProbeAll();
    }, 12000);
    return () => {
      clearInterval(id);
    };
  }, [api, valid?.ok, runProbeAll]);

  useEffect(() => {
    if (!api || !valid?.ok || !cfg.webhookUrl?.trim()) return;
    for (const s of cfg.services) {
      const was = prevReachRef.current[s.url];
      const now = reach[s.url];
      if (was === true && now === false) {
        void api.webhookNotify(
          cfg.webhookUrl.trim(),
          `Spektors Launcher: недоступен ${s.label} (${s.url})`,
        );
      }
      prevReachRef.current[s.url] = now ?? null;
    }
  }, [reach, api, valid?.ok, cfg.services, cfg.webhookUrl]);

  const refreshDocker = useCallback(async () => {
    if (!api || !root.trim() || !valid?.ok) return;
    const ps = await api.dockerComposePs(root.trim(), cfg.composeFile);
    if (ps.ok) {
      setContainers(ps.containers);
      setDockerErr(null);
    } else {
      setContainers([]);
      setDockerErr(ps.error ?? "docker error");
    }
    const st = await api.dockerStats(root.trim(), cfg.composeFile);
    setStats(st);
  }, [api, root, valid?.ok, cfg.composeFile]);

  useEffect(() => {
    if (!valid?.ok || !root.trim()) {
      setContainers([]);
      setStats([]);
      return;
    }
    void refreshDocker();
    const id = setInterval(() => void refreshDocker(), 15000);
    return () => clearInterval(id);
  }, [valid?.ok, root, refreshDocker]);

  const refreshGit = useCallback(async () => {
    if (!api || !root.trim() || !valid?.ok) return;
    const m = await api.gitMeta(root.trim());
    setGitBranch(m.branch);
    setGitDirty(m.dirty);
    const br = await api.gitBranches(root.trim());
    setBranches(br);
  }, [api, root, valid?.ok]);

  useEffect(() => {
    void refreshGit();
  }, [refreshGit]);

  const refreshAlembic = useCallback(async () => {
    if (!api || !root.trim() || !valid?.ok) return;
    const r = await api.runCommand({
      command: "py",
      args: ["-3", "-m", "alembic", "current"],
      cwd: `${root.trim()}/apps/api`,
    });
    if (r.code === 0) {
      setAlembicHead((r.stdout || "").trim() || "ok");
    } else {
      setAlembicHead(null);
    }
  }, [api, root, valid?.ok]);

  useEffect(() => {
    void refreshAlembic();
  }, [refreshAlembic]);

  useEffect(() => {
    logTailIdRef.current = logTailId;
  }, [logTailId]);

  useEffect(() => {
    if (!api || bridge !== "ok") return;
    const off1 = api.onStreamChunk((p) => {
      appendEntry(
        makeLogEntry(
          `stream:${p.id.slice(0, 8)}`,
          p.chunk,
          p.stream === "stderr" ? "warning" : "info",
        ),
      );
    });
    const off2 = api.onStreamEnd((p) => {
      appendEntry(
        makeLogEntry(
          "stream",
          `[stream ${p.id.slice(0, 8)}] завершён, code=${p.code}${p.error ? ` ${p.error}` : ""}`,
          p.code === 0 || p.code === null ? "info" : "error",
        ),
      );
      if (logTailIdRef.current === p.id) setLogTailId(null);
    });
    return () => {
      off1();
      off2();
    };
  }, [api, bridge, appendEntry]);

  const containerByCompose = useCallback(
    (name?: string) =>
      name
        ? containers.find(
            (c) =>
              c.service === name ||
              c.name.includes(name) ||
              name.includes(c.service),
          )
        : undefined,
    [containers],
  );

  const appendFromRun = useCallback(
    (source: string, r: { code: number | null; stdout: string; stderr: string }) => {
      const level = inferLevel(r.stderr, r.code);
      const raw = `[exit ${r.code}]\n${r.stdout || ""}${r.stderr || ""}`.trim();
      appendEntry(makeLogEntry(source, raw, level));
    },
    [appendEntry],
  );

  const runDocker = async (label: string, args: string[]) => {
    if (!api || !valid?.ok) return;
    setBusy(label);
    try {
      const r = await api.runCommand({
        command: "docker",
        args,
        cwd: root.trim(),
      });
      appendFromRun(label, r);
      pushHistory(`docker ${args.join(" ")}`);
      void refreshDocker();
    } finally {
      setBusy(null);
    }
  };

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

  const applyProjectRoot = useCallback(
    (dir: string) => {
      const d = dir.trim();
      if (!d) return;
      setRoot(d);
      pushRecentRoot(d);
    },
    [pushRecentRoot],
  );

  const pickFolder = async () => {
    if (!api) return;
    const p = await api.openDirectory();
    if (p) applyProjectRoot(p);
  };

  useEffect(() => {
    if (!api || bridge !== "ok") return;
    try {
      if (localStorage.getItem(ROOT_STORAGE_KEY)?.trim()) return;
    } catch {
      /* */
    }
    let cancelled = false;
    void (async () => {
      const found = await api.detectProjectRoot();
      if (cancelled || !found) return;
      applyProjectRoot(found);
      appendEntry(
        makeLogEntry(
          "repo",
          `Корень определён автоматически: ${found}`,
          "info",
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [api, bridge, appendEntry, applyProjectRoot]);

  const saveEnv = async () => {
    if (!api || !valid?.ok) return;
    const b = await api.backupEnv(root.trim());
    if (b.ok) {
      appendEntry(
        makeLogEntry("env", `Резервная копия .env: ${b.path}`, "info"),
      );
    }
    await api.writeEnv(root.trim(), envText);
    setEnvDirty(false);
    appendEntry(makeLogEntry("env", ".env сохранён.", "info"));
  };

  const startTail = async (service: string) => {
    if (!api || !valid?.ok) return;
    if (logTailId) await api.stopLogStream(logTailId);
    const base = dockerBaseArgs(cfg);
    try {
      const { id } = await api.spawnLogStream({
        command: "docker",
        args: [...base, "logs", "-f", "--no-color", service],
        cwd: root.trim(),
      });
      setLogTailId(id);
      appendEntry(
        makeLogEntry(
          "docker",
          `Поток логов: ${service} (stream ${id.slice(0, 8)})`,
          "info",
        ),
      );
    } catch (e) {
      appendEntry(
        makeLogEntry(
          "docker",
          `Поток логов не запущен: ${String(e)}`,
          "error",
        ),
      );
    }
  };

  const stopTail = async () => {
    if (!api || !logTailId) return;
    await api.stopLogStream(logTailId);
    setLogTailId(null);
  };

  const restartAllConfirm = async () => {
    if (!api || !valid?.ok) return;
    if (!window.confirm("Перезапустить все сервисы docker compose?")) return;
    const r = await api.dockerComposeRestart({
      root: root.trim(),
      composeFile: cfg.composeFile,
    });
    appendFromRun("compose restart all", r);
    void refreshDocker();
  };

  const startAllComposeStack = useCallback(async () => {
    if (!api || !valid?.ok) return;
    if (!toolDocker) {
      appendEntry(
        makeLogEntry(
          "compose",
          "Docker не найден в PATH — запуск стека недоступен.",
          "warning",
        ),
      );
      return;
    }
    if (
      !window.confirm(
        "Запустить все сервисы docker compose в фоне (docker compose up -d)? Уже запущенные контейнеры обычно не пересоздаются; поднимутся отсутствующие.",
      )
    )
      return;
    setBusy("compose up -d");
    try {
      const r = await api.dockerComposeUp({
        root: root.trim(),
        composeFile: cfg.composeFile,
      });
      appendFromRun("compose up -d", r);
      void refreshDocker();
      void runProbeAll();
    } finally {
      setBusy(null);
    }
  }, [
    api,
    valid?.ok,
    toolDocker,
    root,
    cfg.composeFile,
    appendFromRun,
    appendEntry,
    refreshDocker,
    runProbeAll,
  ]);

  const sourceOptions = useMemo(() => {
    const u = new Set<string>();
    for (const e of logEntries) u.add(e.source);
    return [...u].sort();
  }, [logEntries]);

  if (bridge === "pending") {
    return (
      <div className="launcher-app-root relative flex min-h-screen flex-col bg-[var(--bg)]">
        <div className="launcher-ambient" aria-hidden>
          <div className="launcher-ambient__mesh" />
          <span className="launcher-ambient__orb launcher-ambient__orb--a" />
          <span className="launcher-ambient__orb launcher-ambient__orb--b" />
        </div>
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 p-8">
          <div className="launcher-glass-panel flex flex-col items-center gap-5 px-12 py-10">
            <span
              className="h-11 w-11 motion-safe:animate-spin rounded-full border-2 border-[var(--glass-border)] border-t-accent"
              aria-hidden
            />
            <div className="text-center">
              <p className="text-sm font-semibold text-[color:var(--fg)]">
                Подключение к Electron…
              </p>
              <p className="mt-1 text-xs text-[color:var(--fg-muted)]">
                Инициализация моста безопасности
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (bridge === "fail" || !api) {
    const electronShell = isElectronUserAgent();
    return (
      <div className="launcher-app-root relative flex min-h-screen flex-col bg-[var(--bg)]">
        <div className="launcher-ambient" aria-hidden>
          <div className="launcher-ambient__mesh" />
          <span className="launcher-ambient__orb launcher-ambient__orb--b" />
        </div>
        <div className="relative z-10 flex flex-1 items-center justify-center p-6 sm:p-8">
          <div className="launcher-glass-panel max-w-lg p-8 sm:p-10">
            {electronShell ? (
              <>
                <div className="mb-4 inline-flex rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200/95">
                  IPC
                </div>
                <h1 className="text-xl font-bold tracking-tight text-[color:var(--fg)]">
                  Не загрузился preload (мост IPC)
                </h1>
                <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--fg-muted)]">
                  Окно Electron открыто, но{" "}
                  <code className="rounded bg-black/25 px-1.5 py-0.5 font-mono text-sm text-accent">
                    window.spektorsLauncher
                  </code>{" "}
                  недоступен.
                </p>
                <pre className="mt-5 overflow-x-auto rounded-xl border border-[var(--glass-border)] bg-black/30 p-4 font-mono text-sm text-accent">
                  npm run dev:desktop
                </pre>
              </>
            ) : (
              <>
                <h1 className="text-xl font-bold tracking-tight text-[color:var(--fg)]">
                  Нужно окно Electron
                </h1>
                <p className="mt-2 text-sm text-[color:var(--fg-muted)]">
                  Лаунчер работает только внутри десктопного приложения.
                </p>
                <pre className="mt-5 overflow-x-auto rounded-xl border border-[var(--glass-border)] bg-black/30 p-4 font-mono text-sm text-accent">
                  npm run dev:desktop
                </pre>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const customWindowChrome = api.platform !== "darwin";
  const base = dockerBaseArgs(cfg);

  const setEnvProfile = (p: LauncherEnvProfile) => {
    setCfg((c) => {
      const next = { ...c, activeEnv: p };
      void api.setLauncherConfig(next);
      return next;
    });
  };

  const cardNavId = (id: SidebarCardId): NavId | undefined => {
    const m: Partial<Record<SidebarCardId, NavId>> = {
      repo: "repo",
      services: "services",
      docker: "docker",
      api: "api",
      env: "env",
    };
    return m[id];
  };

  const launcherCardsValue: LauncherCardsValue = {
    api,
    root,
    setRoot,
    cfg,
    setCfg,
    valid,
    envText,
    setEnvText,
    envDirty,
    setEnvDirty,
    hasEnvExample,
    busy,
    setBusy,
    reach,
    probing,
    recentRoots,
    gitBranch,
    gitDirty,
    branches,
    branchPick,
    setBranchPick,
    alembicHead,
    toolDocker,
    toolGit,
    newSvcLabel,
    setNewSvcLabel,
    newSvcUrl,
    setNewSvcUrl,
    newServerName,
    setNewServerName,
    newServerCwd,
    setNewServerCwd,
    newServerCmd,
    setNewServerCmd,
    newServerArgs,
    setNewServerArgs,
    managedRunning,
    setManagedRunning,
    snippetLabel,
    setSnippetLabel,
    snippetCmd,
    setSnippetCmd,
    snippetArgs,
    setSnippetArgs,
    snippetCwd,
    setSnippetCwd,
    dockerErr,
    containers,
    stats,
    logTailId,
    appendEntry,
    appendFromRun,
    pushHistory,
    persistCfg,
    pickFolder,
    saveEnv,
    loadEnv,
    refreshGit,
    refreshDocker,
    refreshAlembic,
    runProbeAll,
    runDocker,
    startTail,
    stopTail,
    restartAllConfirm,
    containerByCompose,
    setEnvProfile,
    base,
    openExpandedCard,
    applyProjectRoot,
  };

  return (
    <div className="launcher-app-root flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="launcher-ambient" aria-hidden>
        <div className="launcher-ambient__mesh" />
        <span className="launcher-ambient__orb launcher-ambient__orb--a" />
        <span className="launcher-ambient__orb launcher-ambient__orb--b" />
        <span className="launcher-ambient__orb launcher-ambient__orb--c" />
      </div>
      <div className="launcher-app-stack flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {customWindowChrome ? <WindowChrome api={api} /> : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Sidebar */}
        <aside
          className={`launcher-rail-column flex shrink-0 flex-col border-b border-[var(--glass-border)] bg-[var(--sidebar-bg)] py-2 pl-2 pr-1.5 lg:w-[min(228px,100%)] lg:max-w-[40vw] lg:border-b-0 lg:border-r ${
            sidebarOpen
              ? "launcher-thin-scroll max-lg:max-h-[min(48dvh,380px)] max-lg:overflow-y-auto"
              : "max-lg:max-h-11 max-lg:overflow-hidden"
          }`}
          style={noDragStyle}
        >
          <div className="flex items-center justify-between gap-1 px-1 lg:hidden">
            <button
              type="button"
              className="rounded-xl border border-[var(--glass-border)] bg-[var(--panel-fill)] p-2 text-[color:var(--fg-muted)] transition hover:border-accent/35 hover:text-[color:var(--fg)]"
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label="Меню"
            >
              <IconMenu />
            </button>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--fg-muted)]">
              Spektors
            </span>
          </div>
          <div className={sidebarOpen ? "flex flex-col" : "hidden lg:flex"}>
            <p className="mb-2 px-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[color:var(--fg-muted)] opacity-90">
              Разделы
            </p>
            <nav className="launcher-thin-scroll flex max-lg:-mx-0.5 max-lg:flex-nowrap max-lg:gap-0.5 max-lg:overflow-x-auto max-lg:pb-1 lg:flex-col lg:flex-wrap lg:gap-0.5">
              <NavItem
                active={activeNav === "log"}
                onClick={() => setActiveNav("log")}
                icon={<IconLog />}
                label="Логи"
              />
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
            </nav>
            <div className="mt-3 flex flex-col gap-2 border-t border-[var(--glass-border)]/80 pt-3">
              <p className="px-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[color:var(--fg-muted)]">
                Быстро
              </p>
              <button
                type="button"
                disabled={!valid?.ok || !toolDocker}
                title="docker compose up -d в корне проекта"
                onClick={() => void startAllComposeStack()}
                className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-2.5 py-2.5 text-left text-[11px] font-semibold text-accent shadow-[0_0_20px_-10px_color-mix(in_srgb,var(--accent)_55%,transparent)] transition enabled:hover:border-accent/55 enabled:hover:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] disabled:opacity-40"
              >
                <IconPlay /> Запустить весь стек Docker
              </button>
              <button
                type="button"
                onClick={clearLog}
                className="rounded-xl border border-[var(--glass-border)] bg-[var(--panel-fill)] px-2.5 py-2 text-left text-[11px] font-medium text-[color:var(--fg-muted)] transition hover:border-accent/30 hover:text-[color:var(--fg)]"
              >
                Очистить логи
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveNav("env");
                  setSidebarOpen(true);
                }}
                className="rounded-xl border border-[var(--glass-border)] bg-[var(--panel-fill)] px-2.5 py-2 text-left text-[11px] font-medium text-[color:var(--fg-muted)] transition hover:border-accent/30 hover:text-[color:var(--fg)]"
              >
                Открыть .env
              </button>
              <button
                type="button"
                onClick={() => {
                  setScratchpadOpen(true);
                  setSidebarOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--panel-fill)] px-2.5 py-2 text-left text-[11px] font-medium text-[color:var(--fg-muted)] transition hover:border-accent/30 hover:text-[color:var(--fg)]"
              >
                <IconNotes /> Заметки и картинки
              </button>
              <button
                type="button"
                disabled={!valid?.ok}
                onClick={() => {
                  void runProbeAll();
                  void refreshDocker();
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--panel-fill)] px-2.5 py-2 text-left text-[11px] font-medium text-[color:var(--fg-muted)] transition enabled:hover:border-accent/30 enabled:hover:text-[color:var(--fg)] disabled:opacity-40"
              >
                <IconRefresh /> Обновить статусы
              </button>
              <YandexMusicMini />
            </div>
            <div className="mt-auto flex flex-col gap-2 border-t border-[var(--glass-border)]/80 pt-3">
              <p className="px-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[color:var(--fg-muted)]">
                Профиль
              </p>
              <ProfileMenu
                key={profileMenuKey}
                presentation="modal"
                triggerLayout="sidebar"
                className="w-full"
                onAfterSave={(p) => void persistProfileToDisk(p)}
              />
              <div className="flex items-center gap-2.5 rounded-xl border border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--panel-fill)_80%,transparent)] px-2.5 py-2 text-[11px] font-medium text-[color:var(--fg-muted)]">
                <span
                  className={`relative flex h-2 w-2 shrink-0 rounded-full ${apiHealthOk === true ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.65)]" : apiHealthOk === false ? "bg-red-400/90" : "bg-[var(--fg-muted)] opacity-45"}`}
                />
                <span className="tabular-nums">API :8000</span>
              </div>
              <div className="flex items-center gap-1">
                <ThemeToggle
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--glass-border)] bg-[var(--panel-fill)] text-base shadow-none transition hover:border-accent/40 hover:bg-[var(--glass-highlight)]"
                  labels={{
                    toggle: "Тема",
                    activateLight: "Светлая тема",
                    activateDark: "Тёмная тема",
                  }}
                />
              </div>
            </div>
          </div>
        </aside>

        <LauncherCardsProvider value={launcherCardsValue}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row lg:overflow-hidden">
          <section
            ref={(el) => {
              sectionRefs.current.logPanel = el;
            }}
            className="flex min-h-[min(180px,32dvh)] min-w-0 flex-1 flex-col overflow-hidden p-2 sm:p-3 lg:min-h-0"
          >
            <LauncherPanel
              fill
              elevated
              title="Логи команд"
              description="Вывод docker, alembic, потоков и команд. Фильтры и экспорт."
              icon={<IconLog />}
            >
              <CommandLog
                api={api}
                entries={logEntries}
                onClear={clearLog}
                onAppend={appendEntry}
                sourceOptions={sourceOptions}
                probeTicking={probing}
              />
            </LauncherPanel>
            <PinnedCardDropZone
              visible={draggingCardId !== null}
              onPin={(cardId) => {
                if (!isSidebarCardId(cardId)) return;
                setCfg((c) => {
                  const next = { ...c, pinnedSidebarCardId: cardId };
                  void api.setLauncherConfig(next);
                  return next;
                });
              }}
              onDragEnd={() => setDraggingCardId(null)}
            />
            {cfg.pinnedSidebarCardId &&
            isSidebarCardId(cfg.pinnedSidebarCardId) ? (
              <div className="mt-2 min-h-0 shrink-0 space-y-1">
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="rounded-lg border border-[var(--glass-border)] bg-[var(--panel-fill)] px-2.5 py-1.5 text-[10px] font-medium text-[color:var(--fg-muted)] transition hover:border-accent/35 hover:text-[color:var(--fg)]"
                    onClick={() => {
                      setCfg((c) => {
                        const next = { ...c, pinnedSidebarCardId: null };
                        void api.setLauncherConfig(next);
                        return next;
                      });
                    }}
                  >
                    Вернуть в боковую панель
                  </button>
                </div>
                <SidebarCardShell
                  cardId={cfg.pinnedSidebarCardId}
                  draggingId={draggingCardId}
                  onDragStart={setDraggingCardId}
                  onDragEnd={() => setDraggingCardId(null)}
                  onDropReorder={onDropReorder}
                >
                  <SidebarCardBody id={cfg.pinnedSidebarCardId} />
                </SidebarCardShell>
              </div>
            ) : null}
          </section>

          <aside className="launcher-dock-column flex min-h-0 w-full flex-none flex-col border-t border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] max-lg:max-h-[min(46dvh,480px)] lg:h-full lg:w-[min(384px,44vw)] lg:min-w-0 lg:shrink-0 lg:self-stretch lg:border-l lg:border-t-0">
            <div className="launcher-sidebar-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-2 sm:p-3">
              <div className="flex flex-col gap-3">
                {sidebarOrder
                  .filter((id) => cfg.pinnedSidebarCardId !== id)
                  .map((cardId) => (
                    <SidebarCardShell
                      key={cardId}
                      cardId={cardId}
                      draggingId={draggingCardId}
                      onDragStart={setDraggingCardId}
                      onDragEnd={() => setDraggingCardId(null)}
                      onDropReorder={onDropReorder}
                      sectionRef={(el) => {
                        const nav = cardNavId(cardId as SidebarCardId);
                        if (nav) sectionRefs.current[nav] = el;
                        if (cardId === "customServers")
                          sectionRefs.current.customServers = el;
                        if (cardId === "snippets")
                          sectionRefs.current.snippets = el;
                      }}
                    >
                      <SidebarCardBody id={cardId as SidebarCardId} />
                    </SidebarCardShell>
                  ))}
              </div>
            </div>
            <div className="launcher-save-strip shrink-0 border-t border-[var(--glass-border)] px-2 py-2.5 sm:px-3">
              <button
                type="button"
                onClick={() => void persistCfg()}
                className="launcher-primary-cta w-full rounded-xl py-2.5 text-xs font-bold tracking-wide text-[color:var(--fg)]"
              >
                Сохранить настройки лаунчера
              </button>
            </div>
          </aside>
        </div>
        {expandedCardId ? (
          <LauncherExpandedCardModal
            cardId={expandedCardId}
            onClose={() => setExpandedCardId(null)}
          />
        ) : null}
        </LauncherCardsProvider>
        </div>
        <LauncherScratchpadModal
          open={scratchpadOpen}
          onClose={() => setScratchpadOpen(false)}
        />
      </div>
    </div>
  );
}
