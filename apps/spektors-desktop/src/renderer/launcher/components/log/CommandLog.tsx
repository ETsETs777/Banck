import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { LogEntry, LogLevel } from "../../../../shared/launcher-types";
import type { SpektorsLauncherAPI } from "../../../spektors-launcher";
import { formatLogLine } from "../../utils/log-utils";
import { IconCopy, IconLog, IconTrash } from "../shell/LauncherIcons";
import { LauncherSelect } from "../shell/LauncherSelect";

const noDrag = { WebkitAppRegion: "no-drag" } as CSSProperties;

const LEVELS: LogLevel[] = ["error", "warning", "info", "debug"];

const LEVEL_CHIP: Record<
  LogLevel,
  { label: string; activeClass: string; dotClass: string }
> = {
  error: {
    label: "error",
    activeClass:
      "border-red-400/55 text-red-300 shadow-[0_0_16px_-4px_rgba(248,113,113,0.55)] ring-1 ring-red-400/25",
    dotClass: "bg-red-400",
  },
  warning: {
    label: "warning",
    activeClass:
      "border-amber-400/50 text-amber-200 shadow-[0_0_16px_-4px_rgba(251,191,36,0.45)] ring-1 ring-amber-400/20",
    dotClass: "bg-amber-400",
  },
  info: {
    label: "info",
    activeClass:
      "border-sky-400/45 text-sky-200 shadow-[0_0_16px_-4px_rgba(56,189,248,0.4)] ring-1 ring-sky-400/20",
    dotClass: "bg-sky-400",
  },
  debug: {
    label: "debug",
    activeClass:
      "border-violet-400/45 text-violet-200 shadow-[0_0_14px_-4px_rgba(167,139,250,0.45)] ring-1 ring-violet-400/20",
    dotClass: "bg-violet-400",
  },
};

function levelBgClass(level: LogLevel): string {
  switch (level) {
    case "error":
      return "border-l-[var(--log-error-border)] bg-[var(--log-error-bg)]";
    case "warning":
      return "border-l-[var(--log-warn-border)] bg-[var(--log-warn-bg)]";
    case "debug":
      return "border-l-[var(--log-debug-border)] bg-[var(--log-debug-bg)]";
    default:
      return "border-l-[var(--log-info-border)] bg-[var(--log-info-bg)]";
  }
}

function highlightText(text: string, q: string): ReactNode {
  if (!q.trim()) return text;
  const lower = text.toLowerCase();
  const qq = q.toLowerCase();
  const parts: ReactNode[] = [];
  let start = 0;
  let i = lower.indexOf(qq, start);
  let key = 0;
  while (i >= 0) {
    if (i > start) parts.push(text.slice(start, i));
    parts.push(
      <mark
        key={key++}
        className="rounded-sm bg-amber-400/35 text-inherit"
      >
        {text.slice(i, i + q.length)}
      </mark>,
    );
    start = i + q.length;
    i = lower.indexOf(qq, start);
  }
  if (start < text.length) parts.push(text.slice(start));
  return parts.length ? parts : text;
}

export function CommandLog(props: {
  api: SpektorsLauncherAPI;
  entries: LogEntry[];
  onClear: () => void;
  onAppend: (e: LogEntry) => void;
  sourceOptions: string[];
  probeTicking?: boolean;
}) {
  const [followTail, setFollowTail] = useState(true);
  const [search, setSearch] = useState("");
  const [searchHit, setSearchHit] = useState(0);
  const [levelOn, setLevelOn] = useState<Record<LogLevel, boolean>>({
    error: true,
    warning: true,
    info: true,
    debug: true,
  });
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const parentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    return props.entries.filter((e) => {
      if (!levelOn[e.level]) return false;
      if (sourceFilter !== "all" && e.source !== sourceFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !e.raw.toLowerCase().includes(q) &&
          !e.source.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [props.entries, levelOn, sourceFilter, search]);

  const searchHits = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return filtered
      .map((e, idx) => ({ e, idx }))
      .filter(({ e }) => e.raw.toLowerCase().includes(q));
  }, [filtered, search]);

  useEffect(() => {
    setSearchHit(0);
  }, [search, filtered.length]);

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 20,
  });

  const scrollToHit = useCallback(
    (dir: 1 | -1) => {
      if (searchHits.length === 0) return;
      const next = (searchHit + dir + searchHits.length) % searchHits.length;
      setSearchHit(next);
      const rowIndex = searchHits[next]?.idx;
      if (rowIndex == null) return;
      rowVirtualizer.scrollToIndex(rowIndex, { align: "center" });
    },
    [searchHits, searchHit, rowVirtualizer],
  );

  const onScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setFollowTail(nearBottom);
  }, []);

  useLayoutEffect(() => {
    if (!followTail || filtered.length === 0) return;
    rowVirtualizer.scrollToIndex(filtered.length - 1, { align: "end" });
  }, [props.entries.length, followTail, filtered.length, rowVirtualizer]);

  const exportLog = async () => {
    const text = props.entries.map(formatLogLine).join("\n");
    await props.api.saveTextFile("spektors-launcher.log", text);
  };

  const copyAll = async () => {
    const text = props.entries.map(formatLogLine).join("\n");
    await props.api.writeClipboard(text);
    props.onAppend({
      id: crypto.randomUUID(),
      ts: Date.now(),
      source: "ui",
      level: "info",
      raw: "Лог скопирован в буфер.",
    });
  };

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-3"
      style={noDrag}
    >
      <div
        className="shrink-0 space-y-3 rounded-xl border border-[var(--glass-border)] bg-gradient-to-br from-[color-mix(in_srgb,var(--glass-highlight)_75%,transparent)] to-[var(--panel-fill)] px-3 py-3 shadow-lg shadow-black/20 backdrop-blur-sm sm:px-4"
        style={{
          boxShadow:
            "0 0 0 1px color-mix(in srgb, var(--accent) 10%, transparent), 0 16px 48px -28px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="hidden text-[9px] font-bold uppercase tracking-[0.2em] text-[color:var(--fg-muted)] opacity-80 sm:inline">
              Уровень
            </span>
            <div className="flex flex-wrap gap-1.5">
              {LEVELS.map((lv) => {
                const chip = LEVEL_CHIP[lv];
                const on = levelOn[lv];
                return (
                  <button
                    key={lv}
                    type="button"
                    onClick={() =>
                      setLevelOn((prev) => ({ ...prev, [lv]: !prev[lv] }))
                    }
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-all duration-200 ${
                      on
                        ? chip.activeClass
                        : "scale-[0.98] border-transparent bg-black/15 text-[color:var(--fg-muted)] opacity-50"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${on ? chip.dotClass : "bg-current opacity-60"}`}
                    />
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="mx-1 hidden h-8 w-px shrink-0 lg:block"
            style={{ background: "var(--glass-border)" }}
          />

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[color:var(--fg-muted)] opacity-80">
              Источник
            </span>
            <LauncherSelect
              aria-label="Источник лога"
              value={sourceFilter}
              onChange={setSourceFilter}
              className="min-w-[130px] max-w-[min(100%,220px)]"
              buttonClassName="rounded-lg border border-[var(--glass-border)] px-2.5 py-1.5 text-[11px] transition hover:border-accent/40"
              options={[
                { value: "all", label: "Все источники" },
                ...props.sourceOptions.map((s) => ({ value: s, label: s })),
              ]}
            />
          </div>

          <div className="flex min-w-[min(100%,280px)] flex-1 items-center gap-1.5">
            <label className="sr-only" htmlFor="command-log-search">
              Поиск по логу
            </label>
            <input
              id="command-log-search"
              type="search"
              placeholder="Поиск по тексту и источнику…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border px-3 py-2 font-mono text-[11px] transition placeholder:text-[color:var(--fg-muted)] placeholder:opacity-55 focus:border-accent/45 focus:outline-none focus:ring-2 focus:ring-accent/15"
              style={{
                borderColor: "var(--glass-border)",
                background: "color-mix(in srgb, var(--bg) 55%, transparent)",
                color: "var(--fg)",
              }}
            />
            <div
              className="flex shrink-0 items-center gap-0.5 rounded-lg p-0.5"
              style={{
                border: "1px solid var(--glass-border)",
                background: "var(--panel-fill)",
              }}
            >
              <button
                type="button"
                disabled={searchHits.length === 0}
                onClick={() => scrollToHit(-1)}
                className="rounded-md px-2 py-1.5 text-[11px] font-medium text-[color:var(--fg-muted)] transition enabled:hover:bg-[var(--glass-highlight)] disabled:opacity-25"
                title="Предыдущее совпадение"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={searchHits.length === 0}
                onClick={() => scrollToHit(1)}
                className="rounded-md px-2 py-1.5 text-[11px] font-medium text-[color:var(--fg-muted)] transition enabled:hover:bg-[var(--glass-highlight)] disabled:opacity-25"
                title="Следующее совпадение"
              >
                ↓
              </button>
            </div>
            <span className="w-10 shrink-0 text-center text-[10px] tabular-nums text-[color:var(--fg-muted)]">
              {searchHits.length > 0 ? `${searchHit + 1}/${searchHits.length}` : "\u00a0"}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--glass-border)]/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={followTail}
              title="Прокручивать к новым строкам"
              onClick={() => setFollowTail((v) => !v)}
              className="flex items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--panel-fill)] px-2 py-1.5 transition hover:border-accent/35"
            >
              <span
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-300 ${
                  followTail ? "bg-accent/50" : "bg-[var(--glass-border)]/90"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300 ease-out ${
                    followTail ? "translate-x-[18px]" : "translate-x-0"
                  }`}
                />
              </span>
              <span className="text-[11px] font-medium text-[color:var(--fg)]">
                Автоскролл
              </span>
            </button>

            {props.probeTicking ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300/95">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-emerald-400 opacity-55" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Опрос
              </span>
            ) : null}

            <span
              className="rounded-md px-2 py-1 text-[10px] font-mono tabular-nums text-[color:var(--fg-muted)] ring-1 ring-inset ring-[var(--glass-border)]/50"
              style={{ background: "color-mix(in srgb, var(--bg) 40%, transparent)" }}
            >
              {filtered.length} / {props.entries.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={props.entries.length === 0}
              onClick={() => void exportLog()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/25 bg-accent/10 px-3 py-1.5 text-[11px] font-medium text-[color:var(--fg)] transition enabled:hover:border-accent/45 enabled:hover:bg-accent/18 disabled:opacity-35"
            >
              Экспорт .log
            </button>
            <button
              type="button"
              disabled={props.entries.length === 0}
              onClick={() => void copyAll()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--fg-muted)] transition enabled:hover:border-accent/35 enabled:hover:text-[color:var(--fg)] disabled:opacity-35"
            >
              <IconCopy /> Копировать
            </button>
            <button
              type="button"
              disabled={props.entries.length === 0}
              onClick={props.onClear}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 px-3 py-1.5 text-[11px] font-medium text-red-300/90 transition enabled:hover:border-red-400/45 enabled:hover:bg-red-500/10 disabled:opacity-35"
            >
              <IconTrash /> Очистить
            </button>
          </div>
        </div>
      </div>

      <div
        ref={parentRef}
        onScroll={onScroll}
        className="command-log-viewport launcher-log-scroll min-h-0 min-w-0 flex-1 overflow-auto rounded-xl border font-mono text-[11px] leading-snug shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
        style={{
          borderColor: "var(--glass-border)",
          background: "color-mix(in srgb, var(--glass-highlight) 85%, var(--bg))",
          color: "var(--fg-muted)",
          fontFamily:
            'ui-monospace, Consolas, "Fira Code", var(--font-mono), monospace',
        }}
      >
        {filtered.length === 0 ? (
          <div className="flex min-h-[min(240px,42dvh)] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
            <div className="relative">
              <div
                className="absolute inset-0 -m-8 rounded-full bg-accent/20 motion-safe:animate-pulse motion-safe:opacity-80 blur-2xl"
                aria-hidden
              />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--panel-fill)] text-accent shadow-lg shadow-black/25 ring-1 ring-white/5">
                <IconLog />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-[color:var(--fg)]">
                Пока тихо
              </p>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-[color:var(--fg-muted)]">
                {props.entries.length === 0
                  ? "Здесь появится вывод docker, alembic и команд, как только что-то запустится."
                  : "Нет строк, подходящих под фильтр. Смените уровень, источник или поиск."}
              </p>
            </div>
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((vi) => {
              const e = filtered[vi.index];
              if (!e) return null;
              return (
                <div
                  key={vi.key}
                  className={`absolute left-0 top-0 w-full border-l-2 py-1 pl-2.5 pr-2 transition-colors duration-150 hover:bg-white/[0.035] ${levelBgClass(e.level)}`}
                  style={{ transform: `translateY(${vi.start}px)` }}
                >
                  <span className="text-[9px] tabular-nums opacity-60">
                    {new Date(e.ts).toISOString().slice(11, 23)}
                  </span>{" "}
                  <span className="font-medium text-accent/90">{e.source}</span>{" "}
                  {highlightText(e.raw, search)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
