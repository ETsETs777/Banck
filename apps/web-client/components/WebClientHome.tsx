"use client";

import { ChatPanel } from "@spektors/chat-ui";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

function clientApiBase() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
}

export function WebClientHome() {
  const t = useTranslations("home");
  const helpId = useId();
  const helpTitleId = useId();
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="shrink-0 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("title")}
        </h1>
        <p className="text-sm text-muted sm:text-base">{t("tagline")}</p>
        <div className="pt-1">
          <button
            type="button"
            aria-expanded={helpOpen}
            aria-controls={helpId}
            aria-label={helpOpen ? t("helpCollapse") : t("helpExpand")}
            onClick={() => setHelpOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium outline-none transition hover:border-accent/35 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40 sm:text-sm"
            style={{
              borderColor: "var(--glass-border)",
              color: "var(--fg-muted)",
              background: "color-mix(in srgb, var(--glass-highlight) 55%, transparent)",
            }}
          >
            <span
              className="inline-block motion-safe:transition-transform motion-safe:duration-200 motion-reduce:transition-none"
              style={{ transform: helpOpen ? "rotate(90deg)" : "rotate(0deg)" }}
              aria-hidden
            >
              ›
            </span>
            {helpOpen ? t("helpCollapse") : t("helpExpand")}
          </button>
          {helpOpen ? (
            <div
              id={helpId}
              role="region"
              aria-labelledby={helpTitleId}
              className="mt-3 rounded-xl border p-4 text-sm leading-relaxed text-muted"
              style={{
                borderColor: "var(--glass-border)",
                background: "color-mix(in srgb, var(--glass-highlight) 40%, transparent)",
              }}
            >
              <p id={helpTitleId} className="font-medium text-foreground">
                {t("helpTitle")}
              </p>
              <div className="mt-2">
                {t.rich("intro", {
                  codeAppId: (chunks) => (
                    <code className="text-accent" key="appId">
                      {chunks}
                    </code>
                  ),
                  codeApiUrl: (chunks) => (
                    <code className="text-accent" key="apiUrl">
                      {chunks}
                    </code>
                  ),
                })}
              </div>
              <p className="mt-3 border-t pt-3 text-xs" style={{ borderColor: "var(--glass-border)" }}>
                <span className="text-muted">{t("apiResolvedLabel")}</span>{" "}
                <code className="break-all text-[13px] text-accent">{clientApiBase()}</code>
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <ChatPanel appId="web_client" variant="app" />
    </div>
  );
}
