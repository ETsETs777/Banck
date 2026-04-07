"use client";

import { useTranslations } from "next-intl";

const MAIN_ID = "main-content";

export function SkipToMainContent() {
  const t = useTranslations("common");

  return (
    <a
      href={`#${MAIN_ID}`}
      className="skip-to-main rounded-lg border px-4 py-2 text-sm font-semibold"
      style={{
        borderColor: "var(--glass-border)",
        background: "var(--glass-highlight)",
        color: "var(--fg)",
      }}
    >
      {t("skipToMain")}
    </a>
  );
}
