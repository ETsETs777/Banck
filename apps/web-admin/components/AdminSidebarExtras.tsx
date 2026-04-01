"use client";

import { ThemeToggle } from "@spektors/ui-shell";
import { useTranslations } from "next-intl";

export function AdminSidebarExtras() {
  const t = useTranslations("common");

  return (
    <div className="space-y-3">
      <ThemeToggle
        labels={{
          toggle: t("themeToggle"),
          activateLight: t("themeToLight"),
          activateDark: t("themeToDark"),
        }}
      />
    </div>
  );
}
