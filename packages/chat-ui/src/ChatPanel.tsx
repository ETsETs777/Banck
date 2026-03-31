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
  useMemo,
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
      m.msg_source ??
      (m.role === "user" ? "user" : "model"),
    authorLabel: m.author_label ?? undefined,
  }));
}

export type ChatPanelProps = {
  appId: string;
  /** Вызывается при ошибке HTTP до SSE, если в ответе есть X-Request-ID. */
  onRequestId?: (requestId: string) => void;
};

export function ChatPanel({ appId, onRequestId }: ChatPanelProps) {
  const t = useTranslations("chat");
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
        if (
          !streamFailed &&
          resolvedSession &&
          resolvedThread
        ) {
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

  return (
    <section
      className="mt-8 rounded-2xl border p-6 shadow-glow backdrop-blur-md"
      style={{
        background: "var(--glass)",
        borderColor: "var(--glass-border)",
      }}
    >
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
          {t("api")}: <code className="text-foreground/80">{apiBase()}</code>
        </span>
      </div>

      {sessionId && threadId ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <code
            className="max-w-[min(100%,28rem)] truncate rounded bg-black/30 px-2 py-1 font-mono text-foreground/80"
            title={`${sessionId} · ${threadId}`}
          >
            {sessionId.slice(0, 10)}… · {threadId.slice(0, 10)}…
          </code>
          <button
            type="button"
            onClick={() => void copyThreadIds()}
            className="rounded-lg border border-white/15 px-2 py-1 text-muted transition hover:border-accent/40 hover:text-foreground"
          >
            {idsCopied ? t("copiedIds") : t("copyThreadIds")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void syncThreadFromServer(sessionId, threadId)}
            className="rounded-lg border border-white/15 px-2 py-1 text-muted transition hover:border-accent/40 hover:text-foreground disabled:opacity-40"
          >
            {t("refreshThread")}
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex max-h-[min(420px,50vh)] flex-col gap-3 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-4 text-sm">
        {messages.length === 0 ? (
          <p className="text-muted">{t("empty")}</p>
        ) : (
          messages.map((line, i) => (
            <div
              key={`${i}-${line.role}-${line.msgSource ?? ""}`}
              className={
                line.role === "user"
                  ? "ml-8 rounded-lg bg-accent/15 px-3 py-2 text-foreground"
                  : "mr-8 rounded-lg bg-white/5 px-3 py-2 text-foreground/90"
              }
            >
              <span className="text-[10px] uppercase tracking-wide text-muted">
                {roleCaption(line)}
              </span>
              <p className="mt-1 whitespace-pre-wrap">
                {line.content ||
                  (busy && line.role === "assistant" ? t("typing") : "")}
              </p>
            </div>
          ))
        )}
      </div>

      {err ? (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <textarea
          className="min-h-[88px] flex-1 resize-y rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-foreground outline-none ring-accent/40 focus:ring-2"
          placeholder={t("placeholder")}
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
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input
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
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? t("waiting") : t("send")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={resetThread}
            className="rounded-xl border border-white/20 px-4 py-2 text-xs text-muted hover:bg-white/5"
          >
            {t("newChat")}
          </button>
        </div>
      </div>
    </section>
  );
}
