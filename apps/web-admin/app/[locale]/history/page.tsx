"use client";

import { Link, usePathname } from "@/i18n/routing";
import { loadRecentThreads } from "@/lib/admin-prefs";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export default function HistoryPage() {
  const t = useTranslations("history");
  const locale = useLocale();
  const pathname = usePathname();
  const [rows, setRows] = useState(() => loadRecentThreads());

  useEffect(() => {
    setRows(loadRecentThreads());
  }, [pathname]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted">{t("empty")}</p>
      </div>
      <Link
        href="/inbox"
        className="inline-flex rounded-xl border border-white/20 px-4 py-2 text-sm text-foreground hover:bg-white/5"
      >
        {t("openInbox")}
      </Link>
      {rows.length === 0 ? null : (
        <ul className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4">
          {rows.map((r) => (
            <li
              key={`${r.app_id}-${r.session_id}-${r.thread_id}`}
              className="rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-sm"
            >
              <p className="font-mono text-xs text-foreground/90">
                {r.app_id} · {r.session_id.slice(0, 10)}… · {r.thread_id.slice(0, 10)}…
              </p>
              <p className="text-[10px] text-muted">
                {t("openedAt")}:{" "}
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(r.updated_at))}
              </p>
              {r.last_preview ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted">{r.last_preview}</p>
              ) : null}
              <Link
                href="/inbox"
                className="mt-2 inline-block text-xs text-accent hover:underline"
              >
                {t("openInbox")}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
