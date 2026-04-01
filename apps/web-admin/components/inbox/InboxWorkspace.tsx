"use client";

import { createSpektorsClient } from "@spektors/api-client";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  OPERATOR_NAME_KEY,
  loadAdminPrefs,
  pushRecentThread,
  loadReplyTemplates,
  saveAdminPrefs,
} from "@/lib/admin-prefs";
import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const defaultApi = "http://localhost:8000";
const PAGE_SIZE = 40;
const FILTER_DEBOUNCE_MS = 400;
const VIRTUAL_THRESHOLD = 28;
const URGENT_MS = 30 * 60 * 1000;

type ThreadRow = {
  thread_id: string;
  session_id: string;
  app_id: string;
  last_preview: string | null;
  updated_at: string | null;
  message_count: number;
  workflow_status?: string;
  assignee_label?: string | null;
  tags?: string[];
};

type ThreadsPayload = {
  items: ThreadRow[];
  limit: number;
  offset: number;
};

type SendTab = "bff" | "direct";

type ChatMsg = {
  id: number;
  role: string;
  content: string;
  msg_source?: string;
  author_label?: string | null;
  created_at?: string | null;
};

function playBeep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.value = 0.04;
    o.start();
    window.setTimeout(() => {
      o.stop();
      void ctx.close();
    }, 100);
  } catch {
    /* ignore */
  }
}

function formatThreadDate(iso: string | null, loc: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(loc, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 19);
  }
}

function isUrgent(iso: string | null): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > URGENT_MS;
}

function ThreadListSkeleton() {
  return (
    <ul className="space-y-2" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="animate-pulse rounded-lg border border-white/5 bg-black/20 px-3 py-3"
        >
          <div className="h-3 w-2/3 rounded bg-white/10" />
          <div className="mt-2 h-2 w-1/2 rounded bg-white/5" />
          <div className="mt-2 h-8 w-full rounded bg-white/5" />
        </li>
      ))}
    </ul>
  );
}

function operatorName(): string {
  try {
    return window.localStorage.getItem(OPERATOR_NAME_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function InboxWorkspace() {
  const t = useTranslations("inbox");
  const locale = useLocale();
  const showDirectTab = process.env.NODE_ENV !== "production";

  const [token, setToken] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [threadId, setThreadId] = useState("");
  const [appId, setAppId] = useState("");
  const [authorLabel, setAuthorLabel] = useState(() => t("defaultAuthor"));
  const [content, setContent] = useState("");

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"ok" | "err" | null>(null);
  const [loading, setLoading] = useState(false);
  const [bffLoading, setBffLoading] = useState(false);

  const [sendTab, setSendTab] = useState<SendTab>("bff");

  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [appFilterInput, setAppFilterInput] = useState("");
  const [debouncedAppFilter, setDebouncedAppFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [listCollapsed, setListCollapsed] = useState(false);

  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [internalNote, setInternalNote] = useState("");
  const [metaSaving, setMetaSaving] = useState(false);

  const [templates] = useState(() => loadReplyTemplates());

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const threadIdsRef = useRef<string[]>([]);
  const pollInitRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadIdsRef.current = threads.map((x) => x.thread_id);
  }, [threads]);

  useEffect(() => {
    setAuthorLabel(t("defaultAuthor"));
  }, [locale, t]);

  useEffect(() => {
    const id = window.setTimeout(
      () => setDebouncedAppFilter(appFilterInput.trim()),
      FILTER_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(id);
  }, [appFilterInput]);

  useEffect(() => {
    if (!showDirectTab && sendTab === "direct") {
      setSendTab("bff");
    }
  }, [showDirectTab, sendTab]);

  useEffect(() => {
    const p = loadAdminPrefs();
    setListCollapsed(p.inboxListCollapsed);
  }, []);

  const fetchThreadPage = useCallback(
    async (offset: number, mode: "replace" | "append") => {
      setThreadsError(null);
      if (mode === "append") setLoadingMore(true);
      else setThreadsLoading(true);
      try {
        const q = new URLSearchParams();
        q.set("limit", String(PAGE_SIZE));
        q.set("offset", String(offset));
        const f = debouncedAppFilter;
        if (f) q.set("app_id", f);
        const res = await fetch(`/api/internal/threads?${q.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const raw = await res.text().catch(() => "");
          throw new Error(`${res.status} ${raw.slice(0, 200)}`);
        }
        const data = (await res.json()) as ThreadsPayload;
        const items = Array.isArray(data.items) ? data.items : [];
        if (mode === "append") {
          setThreads((prev) => [...prev, ...items]);
        } else {
          setThreads(items);
        }
        setHasMore(items.length === PAGE_SIZE);
        return items;
      } catch (e) {
        if (mode === "replace") {
          setThreads([]);
          setHasMore(false);
        }
        setThreadsError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        if (mode === "append") setLoadingMore(false);
        else setThreadsLoading(false);
      }
    },
    [debouncedAppFilter],
  );

  useEffect(() => {
    void fetchThreadPage(0, "replace");
  }, [fetchThreadPage]);

  useEffect(() => {
    const tick = async () => {
      const prefs = loadAdminPrefs();
      const q = new URLSearchParams();
      q.set("limit", String(PAGE_SIZE));
      q.set("offset", "0");
      const f = debouncedAppFilter;
      if (f) q.set("app_id", f);
      try {
        const res = await fetch(`/api/internal/threads?${q.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as ThreadsPayload;
        const items = Array.isArray(data.items) ? data.items : [];
        const prev = new Set(threadIdsRef.current);
        const hasNew = items.some((i) => !prev.has(i.thread_id));
        if (
          pollInitRef.current &&
          hasNew &&
          prefs.soundOnNewThread &&
          (document.hidden || (typeof document.hasFocus === "function" && !document.hasFocus()))
        ) {
          playBeep();
        }
        pollInitRef.current = true;
        setThreads(items);
        setHasMore(items.length === PAGE_SIZE);
      } catch {
        /* ignore */
      }
    };
    const ms = loadAdminPrefs().pollIntervalMs;
    const id = window.setInterval(() => void tick(), ms);
    return () => window.clearInterval(id);
  }, [debouncedAppFilter]);

  const filteredThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (row) =>
        row.session_id.toLowerCase().includes(q) ||
        row.thread_id.toLowerCase().includes(q) ||
        (row.last_preview?.toLowerCase().includes(q) ?? false) ||
        (row.app_id?.toLowerCase().includes(q) ?? false),
    );
  }, [threads, searchQuery]);

  const rowVirtualizer = useVirtualizer({
    count: filteredThreads.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 108,
    overscan: 8,
  });

  const loadMessages = useCallback(async (sid: string, tid: string, aid: string) => {
    setMessagesError(null);
    setMessagesLoading(true);
    setMessages([]);
    try {
      const qs = new URLSearchParams({
        session_id: sid,
        thread_id: tid,
        app_id: aid,
      });
      const res = await fetch(`/api/internal/thread-messages?${qs}`, {
        cache: "no-store",
      });
      const raw = await res.text();
      if (!res.ok) {
        throw new Error(raw.slice(0, 300));
      }
      const data = JSON.parse(raw) as { messages?: ChatMsg[] };
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (e) {
      setMessages([]);
      setMessagesError(e instanceof Error ? e.message : String(e));
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const loadMeta = useCallback(async (sid: string, tid: string) => {
    try {
      const qs = new URLSearchParams({ session_id: sid, thread_id: tid });
      const res = await fetch(`/api/internal/thread-meta?${qs}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setInternalNote("");
        return;
      }
      const data = (await res.json()) as { internal_note?: string | null };
      setInternalNote(typeof data.internal_note === "string" ? data.internal_note : "");
    } catch {
      setInternalNote("");
    }
  }, []);

  useEffect(() => {
    if (!sessionId || !threadId || !appId) {
      setMessages([]);
      setInternalNote("");
      return;
    }
    void loadMessages(sessionId, threadId, appId);
    void loadMeta(sessionId, threadId);
  }, [sessionId, threadId, appId, loadMessages, loadMeta]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function patchMeta(body: Record<string, unknown>) {
    if (!sessionId || !threadId) return;
    setMetaSaving(true);
    try {
      const qs = new URLSearchParams({ session_id: sessionId, thread_id: threadId });
      const name = operatorName();
      const res = await fetch(`/api/internal/thread-meta?${qs}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, actor_label: name || undefined }),
      });
      if (!res.ok) {
        setStatusKind("err");
        setStatusMessage(t("metaUpdateError"));
        return;
      }
      void fetchThreadPage(0, "replace");
    } finally {
      setMetaSaving(false);
    }
  }

  async function saveInternalNote() {
    await patchMeta({ internal_note: internalNote.trim() || null });
    setStatusKind("ok");
    setStatusMessage(t("saveNote"));
  }

  function selectThread(row: ThreadRow) {
    setSessionId(row.session_id);
    setThreadId(row.thread_id);
    setAppId(row.app_id);
    pushRecentThread({
      session_id: row.session_id,
      thread_id: row.thread_id,
      app_id: row.app_id,
      last_preview: row.last_preview,
      updated_at: row.updated_at || new Date().toISOString(),
    });
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyNotice(t("copiedToast"));
      window.setTimeout(() => setCopyNotice(null), 2000);
    } catch {
      setCopyNotice(null);
    }
  }

  function clearStatus() {
    setStatusMessage(null);
    setStatusKind(null);
  }

  async function onSubmitBff(e: React.FormEvent) {
    e.preventDefault();
    clearStatus();
    setBffLoading(true);
    try {
      const res = await fetch("/api/internal/operator-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId.trim(),
          thread_id: threadId.trim(),
          content: content.trim(),
          author_label: authorLabel.trim(),
        }),
      });
      const raw = await res.text();
      if (res.status === 503) {
        setStatusKind("err");
        setStatusMessage(t("bffUnavailable"));
        return;
      }
      if (!res.ok) {
        setStatusKind("err");
        setStatusMessage(raw.slice(0, 500));
        return;
      }
      let parsed: { app_id?: string; message_id?: number } = {};
      try {
        parsed = JSON.parse(raw) as typeof parsed;
      } catch {
        /* ignore */
      }
      setStatusKind("ok");
      setStatusMessage(
        `${t("successPrefix")}: app_id=${parsed.app_id ?? "?"}, message_id=${parsed.message_id ?? "?"}. ${t("successHint")}`,
      );
      setContent("");
      void fetchThreadPage(0, "replace");
      if (sessionId && threadId && appId) void loadMessages(sessionId, threadId, appId);
    } catch (err) {
      setStatusKind("err");
      setStatusMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBffLoading(false);
    }
  }

  async function onSubmitDirect(e: React.FormEvent) {
    e.preventDefault();
    clearStatus();
    setLoading(true);
    try {
      const client = createSpektorsClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL ?? defaultApi,
        kind: "admin",
        token: token.trim() || undefined,
      });
      const r = await client.adminHumanReply(
        sessionId.trim(),
        threadId.trim(),
        {
          content: content.trim(),
          author_label: authorLabel.trim(),
        },
      );
      setStatusKind("ok");
      setStatusMessage(
        `${t("successPrefix")}: app_id=${r.app_id}, message_id=${r.message_id}. ${t("successHint")}`,
      );
      setContent("");
      void fetchThreadPage(0, "replace");
      if (sessionId && threadId && appId) void loadMessages(sessionId, threadId, appId);
    } catch (err) {
      setStatusKind("err");
      setStatusMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function onRefreshList() {
    void fetchThreadPage(0, "replace");
  }

  function onLoadMore() {
    if (!loadingMore && !threadsLoading && hasMore) {
      void fetchThreadPage(threads.length, "append");
    }
  }

  function toggleListCollapsed() {
    setListCollapsed((c) => {
      const next = !c;
      saveAdminPrefs({ inboxListCollapsed: next });
      return next;
    });
  }

  function workflowLabel(ws: string | undefined) {
    if (ws === "assigned") return t("workflowAssigned");
    if (ws === "closed") return t("workflowClosed");
    return t("workflowQueued");
  }

  function onComposerKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setContent("");
      contentRef.current?.blur();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (sendTab === "bff" || !showDirectTab) {
        const form = (e.target as HTMLElement).closest("form");
        form?.requestSubmit();
      } else {
        const form = (e.target as HTMLElement).closest("form");
        form?.requestSubmit();
      }
    }
  }

  const statusBoxClass =
    statusKind === "ok"
      ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-100"
      : statusKind === "err"
        ? "border-red-500/40 bg-red-950/20 text-red-200"
        : "border-white/10 bg-black/20 text-muted";

  const renderThreadRow = (row: ThreadRow) => {
    const selected =
      sessionId === row.session_id && threadId === row.thread_id;
    const urgent = isUrgent(row.updated_at);
    const ws = row.workflow_status ?? "queued";
    const rowStyle = selected
      ? "border-accent/50 bg-accent/10"
      : urgent
        ? "border-amber-500/40 bg-amber-950/15"
        : ws === "assigned"
          ? "border-sky-500/35 bg-sky-950/15"
          : "border-emerald-900/25 bg-black/30";
    return (
      <li
        key={row.thread_id}
        className={`flex flex-wrap items-start justify-between gap-2 rounded-lg border px-3 py-2 transition-colors ${rowStyle}`}
      >
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-foreground/90">
            {row.session_id.slice(0, 12)}… · {row.thread_id.slice(0, 12)}…
          </p>
          <p className="text-[10px] text-muted">
            {row.app_id} · {workflowLabel(ws)}
            {urgent ? ` · ${t("urgentWait")}` : ""}
            {row.message_count != null
              ? ` · ${row.message_count} ${t("messagesCount")}`
              : null}
            {row.updated_at
              ? ` · ${t("lastUpdate")}: ${formatThreadDate(row.updated_at, locale)}`
              : null}
          </p>
          {row.last_preview ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted">{row.last_preview}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1">
            <button
              type="button"
              className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-muted hover:bg-white/5 hover:text-foreground"
              onClick={() => void copyToClipboard(row.session_id)}
            >
              {t("copySession")}
            </button>
            <button
              type="button"
              className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-muted hover:bg-white/5 hover:text-foreground"
              onClick={() => void copyToClipboard(row.thread_id)}
            >
              {t("copyThread")}
            </button>
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg border border-white/15 px-2 py-1 text-xs text-accent hover:bg-white/5"
          onClick={() => selectThread(row)}
        >
          {t("useRow")}
        </button>
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted">{t("intro")}</p>
        <p className="mt-2 text-xs text-muted">{t("securityHint")}</p>
        <p className="mt-1 text-[10px] text-muted">{t("keyboardHint")}</p>
      </div>

      <div
        className={`grid gap-6 lg:items-start ${listCollapsed ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]"}`}
      >
        <section
          id="thread-list"
          className={`space-y-3 scroll-mt-6 ${listCollapsed ? "hidden lg:hidden" : ""}`}
        >
          <div className="flex flex-wrap items-end gap-3">
            <h2 className="text-lg font-medium text-foreground">{t("threadsTitle")}</h2>
            <label className="flex min-w-[8rem] flex-1 flex-col text-xs text-muted">
              {t("filterAppId")}
              <input
                value={appFilterInput}
                onChange={(e) => setAppFilterInput(e.target.value)}
                className="mt-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 font-mono text-sm text-foreground outline-none ring-accent/30 focus:ring-2"
                placeholder={t("filterPlaceholder")}
              />
            </label>
            <label className="flex min-w-[8rem] flex-1 flex-col text-xs text-muted">
              {t("searchPlaceholder")}
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mt-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-foreground outline-none ring-accent/30 focus:ring-2"
              />
            </label>
            <button
              type="button"
              onClick={onRefreshList}
              disabled={threadsLoading}
              className="rounded-xl border border-white/20 px-4 py-2 text-sm text-foreground hover:bg-white/5 disabled:opacity-40"
            >
              {t("refreshThreads")}
            </button>
          </div>
          {copyNotice ? (
            <p className="text-xs text-accent" role="status">
              {copyNotice}
            </p>
          ) : null}
          {threadsError ? (
            <p className="text-sm text-red-400" role="alert">
              {t("threadsLoadError")}: {threadsError}
            </p>
          ) : null}
          {threadsLoading && threads.length === 0 ? (
            <ThreadListSkeleton />
          ) : threads.length === 0 ? (
            <p className="text-sm text-muted">{t("threadsEmpty")}</p>
          ) : filteredThreads.length === 0 ? (
            <p className="text-sm text-muted">{t("threadsEmpty")}</p>
          ) : filteredThreads.length > VIRTUAL_THRESHOLD ? (
            <div
              ref={listScrollRef}
              className="max-h-[min(28rem,55vh)] overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-2 text-sm lg:max-h-[min(36rem,70vh)]"
            >
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  position: "relative",
                  width: "100%",
                }}
              >
                {rowVirtualizer.getVirtualItems().map((vi) => {
                  const row = filteredThreads[vi.index];
                  return (
                    <div
                      key={row.thread_id}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${vi.start}px)`,
                      }}
                      className="px-1 py-0.5"
                    >
                      {renderThreadRow(row)}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <ul className="max-h-[min(28rem,55vh)] space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3 text-sm lg:max-h-[min(36rem,70vh)]">
              {filteredThreads.map((row) => renderThreadRow(row))}
            </ul>
          )}
          {!listCollapsed && (
            <div className="flex flex-wrap items-center gap-2">
              {hasMore ? (
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={loadingMore || threadsLoading}
                  className="rounded-xl border border-white/20 px-4 py-2 text-sm text-foreground hover:bg-white/5 disabled:opacity-40"
                >
                  {loadingMore ? t("loadingMore") : t("loadMore")}
                </button>
              ) : threads.length > 0 ? (
                <p className="text-xs text-muted">{t("endOfList")}</p>
              ) : null}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={toggleListCollapsed}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-muted hover:bg-white/5 hover:text-foreground lg:inline-flex"
            >
              {listCollapsed ? t("expandList") : t("collapseList")}
            </button>
          </div>

          <div
            className="rounded-2xl border p-4 shadow-glow backdrop-blur-md"
            style={{
              background: "var(--glass)",
              borderColor: "var(--glass-border)",
            }}
          >
            <h3 className="text-sm font-medium text-foreground">{t("dialogTitle")}</h3>
            <p className="mt-1 text-[10px] text-muted">
              {t("clientHeader")}: {appId || "—"} · {sessionId.slice(0, 10) || "—"}…
            </p>
            {sessionId && threadId ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={metaSaving}
                  onClick={() =>
                    void patchMeta({
                      workflow_status: "assigned",
                      assignee_label: operatorName() || t("defaultAuthor"),
                    })
                  }
                  className="rounded-lg border border-sky-500/40 bg-sky-950/20 px-3 py-1 text-xs text-sky-200 disabled:opacity-40"
                >
                  {t("takeThread")}
                </button>
                <button
                  type="button"
                  disabled={metaSaving}
                  onClick={() =>
                    void patchMeta({
                      workflow_status: "queued",
                      assignee_label: null,
                    })
                  }
                  className="rounded-lg border border-white/15 px-3 py-1 text-xs text-muted hover:bg-white/5 disabled:opacity-40"
                >
                  {t("returnQueue")}
                </button>
              </div>
            ) : null}
            <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-2 text-xs">
              {messagesLoading ? (
                <p className="text-muted">…</p>
              ) : messagesError ? (
                <p className="text-red-400" role="alert">
                  {t("messagesLoadError")}: {messagesError}
                </p>
              ) : messages.length === 0 ? (
                <p className="text-muted">{t("noMessages")}</p>
              ) : (
                <ul className="space-y-2">
                  {messages.map((m) => (
                    <li
                      key={m.id}
                      className={`rounded border border-white/5 px-2 py-1 ${
                        m.role === "user" ? "border-l-2 border-l-emerald-500/50" : ""
                      }`}
                    >
                      <span className="text-[10px] uppercase text-muted">
                        {m.role}
                        {m.author_label ? ` · ${m.author_label}` : ""}
                        {m.msg_source === "human" ? " · human" : ""}
                      </span>
                      <p className="whitespace-pre-wrap text-foreground/90">{m.content}</p>
                    </li>
                  ))}
                  <div ref={messagesEndRef} />
                </ul>
              )}
            </div>
            <label className="mt-3 block text-xs text-muted">
              {t("internalNote")}
              <textarea
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                rows={2}
                className="mt-1 w-full resize-y rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-sm text-foreground outline-none ring-accent/30 focus:ring-2"
              />
              <button
                type="button"
                disabled={metaSaving || !sessionId || !threadId}
                onClick={() => void saveInternalNote()}
                className="mt-1 rounded-lg border border-white/20 px-2 py-1 text-[10px] text-foreground hover:bg-white/5 disabled:opacity-40"
              >
                {t("saveNote")}
              </button>
            </label>
          </div>

          <h2 className="text-lg font-medium text-foreground">{t("composeTitle")}</h2>

          {statusMessage ? (
            <p
              className={`rounded-xl border px-4 py-3 text-sm ${statusBoxClass}`}
              role="status"
            >
              <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-80">
                {t("statusLabel")}
              </span>
              <span className="mt-1 block">{statusMessage}</span>
            </p>
          ) : null}

          <label className="block text-xs text-muted">
            {t("templatesLabel")}
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-foreground"
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value;
                if (v) setContent((c) => (c ? `${c}\n${v}` : v));
                e.target.value = "";
              }}
            >
              <option value="">{t("templatesLabel")}</option>
              {templates.map((tpl, i) => (
                <option key={i} value={tpl}>
                  {tpl.slice(0, 80)}
                  {tpl.length > 80 ? "…" : ""}
                </option>
              ))}
            </select>
          </label>

          {showDirectTab ? (
            <div
              className="flex gap-1 rounded-xl border border-white/10 bg-black/20 p-1"
              role="tablist"
            >
              <button
                type="button"
                role="tab"
                aria-selected={sendTab === "bff"}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  sendTab === "bff"
                    ? "bg-accent text-white"
                    : "text-muted hover:text-foreground"
                }`}
                onClick={() => setSendTab("bff")}
              >
                {t("bffTab")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sendTab === "direct"}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  sendTab === "direct"
                    ? "bg-white/15 text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
                onClick={() => setSendTab("direct")}
              >
                {t("directTab")}
              </button>
            </div>
          ) : null}

          <div
            className="space-y-4 rounded-2xl border p-6 shadow-glow backdrop-blur-md"
            style={{
              background: "var(--glass)",
              borderColor: "var(--glass-border)",
            }}
          >
            {sendTab === "bff" || !showDirectTab ? (
              <>
                <p className="text-xs text-muted">{t("bffHint")}</p>
                <form
                  onSubmit={(e) => void onSubmitBff(e)}
                  className="space-y-4"
                  onKeyDown={onComposerKeyDown}
                >
                  <label className="block text-sm">
                    <span className="text-muted">{t("sessionId")}</span>
                    <input
                      required
                      value={sessionId}
                      onChange={(e) => setSessionId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 font-mono text-sm text-foreground outline-none ring-accent/30 focus:ring-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-muted">{t("threadId")}</span>
                    <input
                      required
                      value={threadId}
                      onChange={(e) => setThreadId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 font-mono text-sm text-foreground outline-none ring-accent/30 focus:ring-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-muted">{t("authorLabel")}</span>
                    <input
                      required
                      value={authorLabel}
                      onChange={(e) => setAuthorLabel(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-foreground outline-none ring-accent/30 focus:ring-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-muted">{t("content")}</span>
                    <textarea
                      ref={contentRef}
                      required
                      rows={4}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      onKeyDown={onComposerKeyDown}
                      className="mt-1 w-full resize-y rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-foreground outline-none ring-accent/30 focus:ring-2"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={bffLoading}
                    className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-40"
                  >
                    {bffLoading ? t("sending") : t("bffSubmit")}
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="text-xs text-muted">{t("securityHint")}</p>
                <form
                  onSubmit={(e) => void onSubmitDirect(e)}
                  className="space-y-4"
                  onKeyDown={onComposerKeyDown}
                >
                  <label className="block text-sm">
                    <span className="text-muted">{t("tokenLabel")}</span>
                    <input
                      type="password"
                      autoComplete="off"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-foreground outline-none ring-accent/30 focus:ring-2"
                      placeholder="INTERNAL_ADMIN_TOKEN"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-muted">{t("sessionId")}</span>
                    <input
                      required
                      value={sessionId}
                      onChange={(e) => setSessionId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 font-mono text-sm text-foreground outline-none ring-accent/30 focus:ring-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-muted">{t("threadId")}</span>
                    <input
                      required
                      value={threadId}
                      onChange={(e) => setThreadId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 font-mono text-sm text-foreground outline-none ring-accent/30 focus:ring-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-muted">{t("authorLabel")}</span>
                    <input
                      required
                      value={authorLabel}
                      onChange={(e) => setAuthorLabel(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-foreground outline-none ring-accent/30 focus:ring-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-muted">{t("content")}</span>
                    <textarea
                      ref={contentRef}
                      required
                      rows={4}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      onKeyDown={onComposerKeyDown}
                      className="mt-1 w-full resize-y rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-foreground outline-none ring-accent/30 focus:ring-2"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl border border-white/25 py-2.5 text-sm font-medium text-foreground disabled:opacity-40"
                  >
                    {loading ? t("sending") : t("directSubmit")}
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
