"use client";

import { AdminLocaleSwitcher } from "@/components/AdminLocaleSwitcher";
import { AdminOperatorStatus } from "@/components/AdminOperatorStatus";
import { AdminSidebarExtras } from "@/components/AdminSidebarExtras";
import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const apiDocs = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function navLinkClass(active: boolean) {
  return `rounded-xl px-3 py-2 text-sm transition-colors ${
    active
      ? "bg-white/10 font-medium text-foreground"
      : "text-foreground/90 hover:bg-white/10"
  }`;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const sidebarInner = (
    <>
      <div className="mb-4 space-y-3">
        <Link href="/" className="block" onClick={() => setMobileOpen(false)}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Spektors
          </p>
          <p className="mt-0.5 text-sm font-medium text-foreground">{t("productName")}</p>
        </Link>
        <AdminLocaleSwitcher />
      </div>

      <nav className="flex flex-col gap-0.5" aria-label={t("mainNav")}>
        <Link
          href="/"
          className={navLinkClass(pathname === "/")}
          onClick={() => setMobileOpen(false)}
        >
          {t("overview")}
        </Link>
        <Link
          href="/inbox"
          className={navLinkClass(pathname === "/inbox")}
          onClick={() => setMobileOpen(false)}
        >
          {t("inbox")}
        </Link>
        <Link
          href="/history"
          className={navLinkClass(pathname === "/history")}
          onClick={() => setMobileOpen(false)}
        >
          {t("history")}
        </Link>
        <Link
          href="/docs"
          className={navLinkClass(pathname === "/docs")}
          onClick={() => setMobileOpen(false)}
        >
          {t("apiDocs")}
        </Link>
        <a
          href={`${apiDocs.replace(/\/$/, "")}/docs`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-white/10 hover:text-foreground"
          onClick={() => setMobileOpen(false)}
        >
          {t("swaggerNewTab")}
        </a>
        <Link
          href="/settings"
          className={navLinkClass(pathname === "/settings")}
          onClick={() => setMobileOpen(false)}
        >
          {t("settings")}
        </Link>
        <Link
          href="/supervisor"
          className={navLinkClass(pathname === "/supervisor")}
          onClick={() => setMobileOpen(false)}
        >
          {t("supervisor")}
        </Link>
        <Link
          href="/integrations"
          className={navLinkClass(pathname === "/integrations")}
          onClick={() => setMobileOpen(false)}
        >
          {t("integrations")}
        </Link>
      </nav>

      <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
        <AdminOperatorStatus />
      </div>

      <div className="mt-auto border-t border-white/10 pt-4">
        <AdminSidebarExtras />
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      <button
        type="button"
        className="fixed left-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-[var(--glass)] text-foreground shadow-glow backdrop-blur-md lg:hidden"
        aria-expanded={mobileOpen}
        aria-controls="admin-sidebar"
        onClick={() => setMobileOpen((o) => !o)}
      >
        <span className="sr-only">{mobileOpen ? t("menuClose") : t("menuOpen")}</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          {mobileOpen ? (
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          aria-label={t("menuClose")}
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        id="admin-sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-60 max-w-[85vw] flex-col gap-1 border-r border-white/10 p-4 backdrop-blur-md transition-transform lg:sticky lg:top-0 lg:z-0 lg:max-h-screen lg:min-h-screen lg:w-56 lg:max-w-none lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        style={{
          background: "var(--glass)",
          borderColor: "var(--glass-border)",
        }}
      >
        {sidebarInner}
      </aside>

      <div className="min-w-0 flex-1 p-4 pt-16 lg:p-6 lg:pt-6">{children}</div>
    </div>
  );
}
