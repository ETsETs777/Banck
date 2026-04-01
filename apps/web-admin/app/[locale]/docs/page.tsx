"use client";

import { useTranslations } from "next-intl";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function DocsPage() {
  const t = useTranslations("docs");
  const src = `${apiBase.replace(/\/$/, "")}/docs`;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
      <p className="text-sm text-muted">{t("hint")}</p>
      <div className="h-[min(78vh,900px)] overflow-hidden rounded-2xl border border-white/10 bg-black/20 shadow-glow">
        <iframe title="Swagger UI" src={src} className="h-full w-full border-0" />
      </div>
    </div>
  );
}
