"use client";

import { createSpektorsClient } from "@spektors/api-client";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

const defaultApi = "http://localhost:8000";

type ThreadRow = {
  thread_id: string;
  session_id: string;
  app_id: string;
  last_preview: string | null;
  updated_at: string | null;
  message_count: number;
};

type ThreadsPayload = {
  items: ThreadRow[];
  limit: number;
  offset: number;
};

export default function InboxPage() {
  const t = useTranslations("inbox");
  const locale = useLocale();
  const [token, setToken] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [threadId, setThreadId] = useState("");
  const [authorLabel, setAuthorLabel] = useState(() => t("defaultAuthor"));

  useEffect(() => {
    setAuthorLabel(t("defaultAuthor"));
  }, [locale, t]);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bffLoading, setBffLoading] = useState(false);

  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [appFilter, setAppFilter] = useState("");

  const loadThreads = useCallback(async () => {
    setThreadsError(null);
    setThreadsLoading(true);
    try {
      const q = new URLSearchParams();
      q.set("limit", "40");
      q.set("offset", "0");
      const f = appFilter.trim();
      if (f) q.set("app_id", f);
      const res = await fetch(`/api/internal/threads?${q.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        throw new Error(`${res.status} ${raw.slice(0, 200)}`);
      }
      const data = (await res.json()) as ThreadsPayload;
      setThreads(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setThreads([]);
      setThreadsError(e instanceof Error ? e.message : String(e));
    } finally {
      setThreadsLoading(false);
    }
  }, [appFilter]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  async function onSubmitBff(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
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
        setStatus(t("bffUnavailable"));
        return;
      }
      if (!res.ok) {
        setStatus(raw.slice(0, 500));
        return;
      }
      let parsed: {
        app_id?: string;
        message_id?: number;
      } = {};
      try {
        parsed = JSON.parse(raw) as typeof parsed;
      } catch {
        /* ignore */
      }
      setStatus(
        `${t("successPrefix")}: app_id=${parsed.app_id ?? "?"}, message_id=${parsed.message_id ?? "?"}. ${t("successHint")}`,
      );
      setContent("");
      void loadThreads();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBffLoading(false);
    }
  }

  async function onSubmitDirect(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
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
      setStatus(
        `${t("successPrefix")}: app_id=${r.app_id}, message_id=${r.message_id}. ${t("successHint")}`,
      );
      setContent("");
      void loadThreads();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted">{t("intro")}</p>
        <p className="mt-2 text-xs text-muted">{t("securityHint")}</p>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <h2 className="text-lg font-medium text-foreground">{t("threadsTitle")}</h2>
          <label className="flex flex-1 min-w-[10rem] flex-col text-xs text-muted">
            {t("filterAppId")}
            <input
              value={appFilter}
              onChange={(e) => setAppFilter(e.target.value)}
              className="mt-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 font-mono text-sm text-foreground outline-none ring-accent/30 focus:ring-2"
              placeholder={t("filterPlaceholder")}
            />
          </label>
          <button
            type="button"
            onClick={() => void loadThreads()}
            disabled={threadsLoading}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm text-foreground hover:bg-white/5 disabled:opacity-40"
          >
            {t("refreshThreads")}
          </button>
        </div>
        {threadsError ? (
          <p className="text-sm text-red-400" role="alert">
            {t("threadsLoadError")}: {threadsError}
          </p>
        ) : null}
        {threadsLoading && threads.length === 0 ? (
          <p className="text-sm text-muted">…</p>
        ) : threads.length === 0 ? (
          <p className="text-sm text-muted">{t("threadsEmpty")}</p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
            {threads.map((row) => (
              <li
                key={row.thread_id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-white/5 bg-black/30 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-foreground/90">
                    {row.session_id.slice(0, 12)}… · {row.thread_id.slice(0, 12)}…
                  </p>
                  <p className="text-[10px] text-muted">
                    {row.app_id} · {row.message_count} {t("messagesCount")}
                    {row.updated_at
                      ? ` · ${t("lastUpdate")}: ${row.updated_at.slice(0, 19)}`
                      : null}
                  </p>
                  {row.last_preview ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted">
                      {row.last_preview}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-white/15 px-2 py-1 text-xs text-accent hover:bg-white/5"
                  onClick={() => {
                    setSessionId(row.session_id);
                    setThreadId(row.thread_id);
                  }}
                >
                  {t("useRow")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-foreground">{t("bffTitle")}</h2>
        <p className="text-xs text-muted">{t("bffHint")}</p>
        <form
          onSubmit={(e) => void onSubmitBff(e)}
          className="space-y-4 rounded-2xl border p-6 shadow-glow backdrop-blur-md"
          style={{
            background: "var(--glass)",
            borderColor: "var(--glass-border)",
          }}
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
              required
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
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
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-foreground">{t("directTitle")}</h2>
        <form
          onSubmit={(e) => void onSubmitDirect(e)}
          className="space-y-4 rounded-2xl border p-6 shadow-glow backdrop-blur-md"
          style={{
            background: "var(--glass)",
            borderColor: "var(--glass-border)",
          }}
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
              required
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
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
      </section>

      {status ? (
        <p
          className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-muted"
          role="status"
        >
          {status}
        </p>
      ) : null}
    </div>
  );
}
