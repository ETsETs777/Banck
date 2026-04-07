"use client";

import { ProfileMenu, ThemeToggle } from "@spektors/ui-shell";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "./LocaleSwitcher";

export function AppChrome() {
  const t = useTranslations("common");
  const th = useTranslations("home");

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-md"
      style={{
        borderColor: "var(--glass-border)",
        background: "color-mix(in srgb, var(--glass) 92%, transparent)",
      }}
    >
      <div className="mx-auto flex max-w-[42rem] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {th("badge")}
          </p>
          <p className="truncate text-sm font-semibold text-foreground">
            {th("shellProduct")}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ProfileMenu />
          <ThemeToggle
            labels={{
              toggle: t("themeToggle"),
              activateLight: t("themeToLight"),
              activateDark: t("themeToDark"),
            }}
          />
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
