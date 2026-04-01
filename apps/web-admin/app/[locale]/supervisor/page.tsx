"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

type AuditItem = {
  id: number;
  actor_label: string | null;
  action: string;
  thread_id: string | null;
  payload: Record<string, unknown>;
  created_at: string | null;
};

export default function SupervisorPage() {
  const t = useTranslations("supervisor");
  const [items, setItems] = useState<AuditItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/internal/audit-log?limit=80&offset=0", {
        cache: "no-store",
      });
      const raw = await res.text();
      if (!res.ok) {
        setItems([]);
        setErr(raw.slice(0, 200));
        return;
      }
      const data = JSON.parse(raw) as { items?: AuditItem[] };
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setItems([]);
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted">{t("intro")}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-foreground">{t("auditTitle")}</h2>
        {err ? (
          <p className="text-sm text-red-400" role="alert">
            {err}
          </p>
        ) : null}
        {items.length === 0 && !err ? (
          <p className="text-sm text-muted">{t("auditEmpty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-black/30 text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">{t("time")}</th>
                  <th className="px-3 py-2">{t("action")}</th>
                  <th className="px-3 py-2">{t("actor")}</th>
                  <th className="px-3 py-2">{t("thread")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-white/5 hover:bg-white/[0.03]"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-muted">
                      {row.created_at?.slice(0, 19) ?? "—"}
                    </td>
                    <td className="px-3 py-2">{row.action}</td>
                    <td className="px-3 py-2 text-muted">{row.actor_label ?? "—"}</td>
                    <td className="max-w-[12rem] truncate px-3 py-2 font-mono text-xs">
                      {row.thread_id ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        className="rounded-2xl border p-6 shadow-glow backdrop-blur-md"
        style={{
          background: "var(--glass)",
          borderColor: "var(--glass-border)",
        }}
      >
        <h2 className="text-lg font-medium text-foreground">{t("reportsTitle")}</h2>
        <p className="mt-2 text-sm text-muted">{t("reportsBody")}</p>
      </section>
    </div>
  );
}
