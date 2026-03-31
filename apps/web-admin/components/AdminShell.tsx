"use client";

import { AdminSidebarExtras } from "@/components/AdminSidebarExtras";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";

const apiDocs =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("nav");

  return (
    <div className="flex min-h-screen">
      <aside
        className="flex min-h-screen w-56 shrink-0 flex-col gap-1 border-r border-white/10 p-4 backdrop-blur-md"
        style={{
          background: "var(--glass)",
          borderColor: "var(--glass-border)",
        }}
      >
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          Spektors
        </p>
        <Link
          href="/"
          className="rounded-xl px-3 py-2 text-sm text-foreground hover:bg-white/10"
        >
          {t("overview")}
        </Link>
        <Link
          href="/inbox"
          className="rounded-xl px-3 py-2 text-sm text-foreground hover:bg-white/10"
        >
          {t("inbox")}
        </Link>
        <a
          href={`${apiDocs}/docs`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-white/10 hover:text-foreground"
        >
          {t("swagger")}
        </a>
        <AdminSidebarExtras />
      </aside>
      <div className="min-w-0 flex-1 p-6">{children}</div>
    </div>
  );
}
