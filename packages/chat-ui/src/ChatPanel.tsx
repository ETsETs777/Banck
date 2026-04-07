"use client";

import {
  consumeChatSseStream,
  createSpektorsClient,
  type ThreadMessage,
} from "@spektors/api-client";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

function apiBase() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
}

type Line = {
  role: string;
  content: string;
  msgSource?: string;
  authorLabel?: string;
};

function mapFromThreadMessages(rows: ThreadMessage[]): Line[] {
  return rows.map((m) => ({
    role: m.role,
    content: m.content,
    msgSource:
      m.msg_source ?? (m.role === "user" ? "user" : "model"),
    authorLabel: m.author_label ?? undefined,
  }));
}

export type ChatPanelProps = {
  appId: string;
  /** Вызывается при ошибке HTTP до SSE, если в ответе есть X-Request-ID. */
  onRequestId?: (requestId: string) => void;
  /** Визуальный пресет (app — компактный статус, стеклянный композер). */
  variant?: "app" | "classic";
  /** Не показывать полный URL в полосе статусов (только tooltip на «API»). */
  hideApiUrlInBar?: boolean;
  /** Компактные индикаторы БД/LLM/API. */
  compactStatus?: boolean;
};

function statusDot(ok: boolean | null) {
  if (ok === null) {
    return (
      <span
        className="h-2 w-2 shrink-0 rounded-full bg-[color-mix(in_srgb,var(--fg-muted)_50%,transparent)]"
        aria-hidden
      />
    );
  }
  if (ok) {
    return (
      <span
        className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
        aria-hidden
      />
    );
  }
  return (
    <span
      className="h-2 w-2 shrink-0 rounded-full bg-red-500/90"
      aria-hidden
    />
  );
}

export function ChatPanel({
  appId,
  onRequestId,
  variant = "app",
  hideApiUrlInBar = true,
  compactStatus = true,
}: ChatPanelProps) {
  const t = useTranslations("chat");
  const streamInputId = useId();
  const messageFieldId = useId();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isApp = variant === "app";
  const client = useMemo(
    () =>
      createSpektorsClient({
        baseUrl: apiBase(),
        appId,
        kind: "public",
      }),
    [appId],
  );

  const [dbOk, setDbOk] = useState<boolean | null>(null);
  const [llmOk, setLlmOk] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [stream, setStream] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [idsCopied, setIdsCopied] = useState(false);

  const syncThreadFromServer = useCallback(
    async (sid: string, tid: string) => {
      try {
        const data = await client.listThreadMessages(sid, tid);
        setMessages(mapFromThreadMessages(data.messages));
      } catch {
        /* оставляем локальное состояние */
      }
    },
    [client],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await client.healthDb();
        if (!cancelled) setDbOk(db.ok);
      } catch {
        if (!cancelled) setDbOk(false);
      }
      try {
        const llm = await client.healthLlm();
        if (!cancelled) setLlmOk(llm.ok);
      } catch {
        if (!cancelled) setLlmOk(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    if (messages.length === 0) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    messagesEndRef.current?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "end",
    });
  }, [messages, busy]);

  const resetThread = useCallback(() => {
    setSessionId(null);
    setThreadId(null);
    setMessages([]);
    setErr(null);
    setIdsCopied(false);
  }, []);

  const copyThreadIds = useCallback(async () => {
    if (!sessionId || !threadId) return;
    const text = JSON.stringify({
      session_id: sessionId,
      thread_id: threadId,
    });
    try {
      await navigator.clipboard.writeText(text);
      setIdsCopied(true);
      window.setTimeout(() => setIdsCopied(false), 2000);
    } catch {
      setErr(t("copyFailed"));
    }
  }, [sessionId, t, threadId]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setErr(null);
    setInput("");
    setBusy(true);

    if (stream) {
      setMessages((m) => [...m, { role: "user", content: text, msgSource: "user" }]);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "", msgSource: "model" },
      ]);

      let resolvedSession = sessionId;
      let resolvedThread = threadId;
      let streamFailed = false;

      try {
        const res = await client.chatStream({
          content: text,
          session_id: sessionId,
          thread_id: threadId,
        });
        if (!res.ok) {
          const bodyText = await res.text().catch(() => "");
          const rid = res.headers.get("X-Request-ID");
          if (rid) onRequestId?.(rid);
          const extra = rid ? ` ${t("requestIdNote", { id: rid })}` : "";
          throw new Error(`${res.status} ${bodyText.slice(0, 400)}${extra}`);
        }

        await consumeChatSseStream(res, {
          onSession: (sid, tid) => {
            resolvedSession = sid;
            resolvedThread = tid;
            setSessionId(sid);
            setThreadId(tid);
          },
          onDelta: (delta) => {
            setMessages((m) => {
              if (m.length === 0) return m;
              const next = [...m];
              const last = next[next.length - 1];
              if (last.role !== "assistant") return m;
              next[next.length - 1] = {
                ...last,
                content: last.content + delta,
              };
              return next;
            });
          },
          onError: (msg) => setErr(msg),
        });
      } catch (e) {
        streamFailed = true;
        setErr(e instanceof Error ? e.message : String(e));
        setMessages((m) => {
          if (m.length >= 2 && m[m.length - 1].role === "assistant") {
            return m.slice(0, -2);
          }
          return m;
        });
      } finally {
        setBusy(false);
        if (!streamFailed && resolvedSession && resolvedThread) {
          void syncThreadFromServer(resolvedSession, resolvedThread);
        }
      }
      return;
    }

    try {
      const data = await client.chat({
        content: text,
        stream: false,
        session_id: sessionId,
        thread_id: threadId,
      });
      setSessionId(data.session_id);
      setThreadId(data.thread_id);
      await syncThreadFromServer(data.session_id, data.thread_id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [busy, client, input, onRequestId, sessionId, stream, syncThreadFromServer, threadId, t]);

  function roleCaption(line: Line): ReactNode {
    if (line.role === "user") {
      return t("you");
    }
    if (line.msgSource === "human") {
      return (
        <span>
          <span className="text-accent">{t("badgeHuman")}</span>
          {line.authorLabel ? (
            <span className="text-muted"> · {line.authorLabel}</span>
          ) : null}
        </span>
      );
    }
    return (
      <span>
        <span className="text-accent/90">{t("badgeAi")}</span>
        <span className="text-muted"> · {t("assistant")}</span>
      </span>
    );
  }

  const baseUrl = apiBase();

  const dbState =
    dbOk === null ? t("statusWait") : dbOk ? t("statusOk") : t("statusNo");
  const llmState =
    llmOk === null ? t("statusWait") : llmOk ? t("statusOk") : t("statusNo");

  const statusRow = compactStatus ? (
    <div
      className="flex flex-wrap items-center gap-2 text-[11px]"
      role="status"
      aria-live="polite"
    >
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
        style={{
          borderColor: "var(--glass-border)",
          background: "color-mix(in srgb, var(--glass-highlight) 70%, transparent)",
        }}
        aria-label={`${t("db")}: ${dbState}`}
      >
        {statusDot(dbOk)}
        <span className="text-muted">{t("db")}</span>
        <span className="font-medium text-foreground">{dbState}</span>
      </span>
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
        style={{
          borderColor: "var(--glass-border)",
          background: "color-mix(in srgb, var(--glass-highlight) 70%, transparent)",
        }}
        aria-label={`${t("llm")}: ${llmState}`}
      >
        {statusDot(llmOk)}
        <span className="text-muted">{t("llm")}</span>
        <span className="font-medium text-foreground">{llmState}</span>
      </span>
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
        style={{
          borderColor: "var(--glass-border)",
          background: "color-mix(in srgb, var(--glass-highlight) 70%, transparent)",
        }}
        title={hideApiUrlInBar ? `${t("apiEndpointTitle")}: ${baseUrl}` : undefined}
        aria-label={`${t("apiEndpointTitle")}: ${baseUrl}`}
      >
        <span className="text-muted">{t("api")}</span>
        {hideApiUrlInBar ? (
          <span className="max-w-[10rem] truncate font-mono text-[10px] text-foreground/80">
            {baseUrl.replace(/^https?:\/\//, "")}
          </span>
        ) : (
          <code className="max-w-[14rem] truncate text-[10px] text-foreground/85">
            {baseUrl}
          </code>
        )}
      </span>
    </div>
  ) : (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
      <span>
        {t("db")}:{" "}
        {dbOk === null ? (
          t("statusWait")
        ) : dbOk ? (
          <span className="text-accent">{t("statusOk")}</span>
        ) : (
          <span className="text-red-400">{t("statusNo")}</span>
        )}
      </span>
      <span>
        {t("llm")}:{" "}
        {llmOk === null ? (
          t("statusWait")
        ) : llmOk ? (
          <span className="text-accent">{t("statusOk")}</span>
        ) : (
          <span className="text-red-400">{t("statusNo")}</span>
        )}
      </span>
      <span className="opacity-70">
        {t("api")}: <code className="text-foreground/80">{baseUrl}</code>
      </span>
    </div>
  );

  const shellClass = isApp
    ? "flex min-h-0 flex-1 flex-col rounded-2xl border shadow-[0_8px_40px_-16px_rgba(0,0,0,0.35)] backdrop-blur-md"
    : "mt-8 rounded-2xl border p-6 shadow-glow backdrop-blur-md";

  const shellStyle = isApp
    ? {
        background: "var(--glass)",
        borderColor: "var(--glass-border)",
      }
    : {
        background: "var(--glass)",
        borderColor: "var(--glass-border)",
      };

  const innerPad = isApp ? "p-4 sm:p-5" : "p-6";

  return (
    <section
      className={`${shellClass} ${isApp ? innerPad : ""}`}
      style={shellStyle}
      aria-label={t("panelAriaLabel")}
    >
      {!isApp ? (
        <div className="p-0">{statusRow}</div>
      ) : (
        statusRow
      )}

      {sessionId && threadId ? (
        <div
          className={`mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted ${!isApp ? "px-0" : ""}`}
        >
          <code
            className="max-w-[min(100%,28rem)] truncate rounded-lg border px-2 py-1 font-mono text-foreground/80"
            style={{
              borderColor: "var(--glass-border)",
              background: "color-mix(in srgb, var(--glass-highlight) 50%, transparent)",
            }}
            title={`${sessionId} · ${threadId}`}
          >
            {sessionId.slice(0, 10)}… · {threadId.slice(0, 10)}…
          </code>
          <button
            type="button"
            onClick={() => void copyThreadIds()}
            className="rounded-lg border px-2 py-1 outline-none transition hover:border-accent/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/35"
            style={{ borderColor: "var(--glass-border)", color: "var(--fg-muted)" }}
          >
            {idsCopied ? t("copiedIds") : t("copyThreadIds")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void syncThreadFromServer(sessionId, threadId)}
            className="rounded-lg border px-2 py-1 outline-none transition hover:border-accent/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/35 disabled:opacity-40"
            style={{ borderColor: "var(--glass-border)", color: "var(--fg-muted)" }}
          >
            {t("refreshThread")}
          </button>
        </div>
      ) : null}

      <div
        className={
          isApp
            ? "mt-4 flex min-h-[min(240px,42dvh)] flex-1 basis-0 flex-col gap-3 overflow-y-auto rounded-xl border p-4 text-sm max-h-[min(640px,calc(100dvh-13rem))] sm:min-h-[min(560px,70dvh)]"
            : "mt-4 flex max-h-[min(420px,50vh)] flex-col gap-3 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-4 text-sm"
        }
        style={
          isApp
            ? {
                borderColor: "var(--glass-border)",
                background: "color-mix(in srgb, var(--bg) 65%, var(--glass-highlight))",
              }
            : undefined
        }
      >
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted sm:text-left">{t("empty")}</p>
        ) : (
          messages.map((line, i) => (
            <div
              key={`${i}-${line.role}-${line.msgSource ?? ""}`}
              className={
                line.role === "user"
                  ? isApp
                    ? "ml-0 max-w-[min(100%,85%)] self-end rounded-2xl border px-4 py-2.5 sm:ml-8"
                    : "ml-8 rounded-lg border px-3 py-2 text-foreground"
                  : isApp
                    ? "mr-0 max-w-[min(100%,85%)] self-start rounded-2xl border px-4 py-2.5 sm:mr-8"
                    : "mr-8 rounded-lg border px-3 py-2 text-foreground/90"
              }
              style={
                line.role === "user" && isApp
                  ? {
                      background: "var(--chat-user)",
                      borderColor: "color-mix(in srgb, var(--accent) 38%, transparent)",
                    }
                  : line.role === "user" && !isApp
                    ? {
                        background: "var(--chat-user)",
                        borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)",
                      }
                  : line.role !== "user" && isApp
                    ? {
                        borderColor: "var(--glass-border)",
                        background: "var(--chat-assistant)",
                      }
                    : line.role !== "user" && !isApp
                      ? {
                          borderColor: "var(--glass-border)",
                          background: "var(--chat-assistant)",
                        }
                      : undefined
              }
            >
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
                {roleCaption(line)}
              </span>
              <p className="mt-1 whitespace-pre-wrap text-foreground/95">
                {line.content ||
                  (busy && line.role === "assistant" ? t("typing") : "")}
              </p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} className="h-px w-full shrink-0" aria-hidden />
      </div>

      <div aria-live="polite" className="min-h-[1.25rem]">
        {err ? (
          <p className="mt-2 text-sm font-medium" role="status" style={{ color: "var(--danger)" }}>
            {err}
          </p>
        ) : null}
      </div>

      <div
        className={
          isApp
            ? "mt-2 flex flex-col gap-3 sm:flex-row sm:items-end"
            : "mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        }
      >
        <textarea
          id={messageFieldId}
          className={
            isApp
              ? "min-h-[96px] flex-1 resize-y rounded-xl border px-3 py-2.5 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-accent/45"
              : "min-h-[88px] flex-1 resize-y rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          }
          style={
            isApp
              ? {
                  borderColor: "var(--glass-border)",
                  background: "var(--glass-highlight)",
                  color: "var(--fg)",
                }
              : undefined
          }
          placeholder={t("placeholder")}
          aria-label={t("messageFieldAriaLabel")}
          value={input}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <div className="flex shrink-0 flex-col gap-2">
          <label
            htmlFor={streamInputId}
            className="flex cursor-pointer items-center gap-2 text-xs text-muted"
          >
            <input
              id={streamInputId}
              type="checkbox"
              checked={stream}
              disabled={busy}
              onChange={(e) => setStream(e.target.checked)}
            />
            {t("streamLabel")}
          </label>
          <button
            type="button"
            disabled={busy || !input.trim()}
            onClick={() => void send()}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm outline-none transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
            style={{ background: "var(--accent)" }}
          >
            {busy ? t("waiting") : t("send")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={resetThread}
            className="rounded-xl border px-4 py-2 text-xs font-medium outline-none transition hover:bg-[color-mix(in_srgb,var(--glass-highlight)_80%,transparent)] focus-visible:ring-2 focus-visible:ring-accent/35"
            style={{
              borderColor: "var(--glass-border)",
              color: "var(--fg-muted)",
            }}
          >
            {t("newChat")}
          </button>
        </div>
      </div>
    </section>
  );
}
