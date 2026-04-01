"use client";

import {
  OPERATOR_NAME_KEY,
  loadAdminPrefs,
  saveAdminPrefs,
} from "@/lib/admin-prefs";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const [name, setName] = useState("");
  const [pollSec, setPollSec] = useState(15);
  const [sound, setSound] = useState(true);
  const [apiStatus, setApiStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const p = loadAdminPrefs();
    setPollSec(Math.round(p.pollIntervalMs / 1000));
    setSound(p.soundOnNewThread);
    try {
      setName(window.localStorage.getItem(OPERATOR_NAME_KEY) ?? "");
    } catch {
      /* ignore */
    }
  }, []);

  function onSave() {
    saveAdminPrefs({
      pollIntervalMs: Math.min(120, Math.max(5, pollSec)) * 1000,
      soundOnNewThread: sound,
    });
    try {
      window.localStorage.setItem(OPERATOR_NAME_KEY, name.trim());
    } catch {
      /* ignore */
    }
  }

  async function onCheckApi() {
    setChecking(true);
    setApiStatus(null);
    try {
      const res = await fetch("/api/internal/health-proxy", { cache: "no-store" });
      if (res.ok) {
        setApiStatus(t("apiOk"));
      } else {
        const raw = await res.text().catch(() => "");
        setApiStatus(`${t("apiFail")}: ${res.status} ${raw.slice(0, 120)}`);
      }
    } catch (e) {
      setApiStatus(
        `${t("apiFail")}: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted">{t("intro")}</p>
      </div>

      <div
        className="space-y-4 rounded-2xl border p-6 shadow-glow backdrop-blur-md"
        style={{
          background: "var(--glass)",
          borderColor: "var(--glass-border)",
        }}
      >
        <label className="block text-sm">
          <span className="text-muted">{t("operatorName")}</span>
          <p className="mb-1 text-[10px] text-muted">{t("operatorNameHint")}</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-foreground outline-none ring-accent/30 focus:ring-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">{t("pollInterval")}</span>
          <input
            type="number"
            min={5}
            max={120}
            value={pollSec}
            onChange={(e) => setPollSec(Number(e.target.value) || 15)}
            className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-foreground outline-none ring-accent/30 focus:ring-2"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={sound}
            onChange={(e) => setSound(e.target.checked)}
            className="rounded border-white/30"
          />
          {t("soundNewThread")}
        </label>
        <button
          type="button"
          onClick={onSave}
          className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-white"
        >
          {t("save")}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={checking}
          onClick={() => void onCheckApi()}
          className="rounded-xl border border-white/20 px-4 py-2 text-sm text-foreground hover:bg-white/5 disabled:opacity-40"
        >
          {checking ? t("checking") : t("checkApi")}
        </button>
        {apiStatus ? (
          <p className="text-sm text-muted" role="status">
            {apiStatus}
          </p>
        ) : null}
      </div>
    </div>
  );
}
