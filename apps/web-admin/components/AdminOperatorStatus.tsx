"use client";

import { OPERATOR_STATUS_KEY } from "@/lib/admin-prefs";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export type OperatorPresence = "online" | "offline" | "dnd";

export function AdminOperatorStatus() {
  const t = useTranslations("operator");
  const [status, setStatus] = useState<OperatorPresence>("online");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(OPERATOR_STATUS_KEY);
      if (raw === "offline" || raw === "dnd" || raw === "online") {
        setStatus(raw);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function update(next: OperatorPresence) {
    setStatus(next);
    try {
      window.localStorage.setItem(OPERATOR_STATUS_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const dot =
    status === "online"
      ? "bg-emerald-400"
      : status === "dnd"
        ? "bg-amber-400"
        : "bg-zinc-500";

  return (
    <div className="rounded-xl border border-white/10 bg-black/25 px-2 py-2">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">
        {t("label")}
      </p>
      <p className="mb-2 text-[10px] leading-tight text-muted/80">{t("localHint")}</p>
      <div className="flex flex-col gap-1">
        {(["online", "dnd", "offline"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => update(s)}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
              status === s ? "bg-white/10 text-foreground" : "text-muted hover:bg-white/5"
            }`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${s === "online" ? "bg-emerald-400" : s === "dnd" ? "bg-amber-400" : "bg-zinc-500"}`} />
            {t(s)}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 border-t border-white/5 pt-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
        <span className="text-[10px] text-muted">{t("current")}: {t(status)}</span>
      </div>
    </div>
  );
}
