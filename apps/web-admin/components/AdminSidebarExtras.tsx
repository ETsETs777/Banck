"use client";

import { AdminLocaleSwitcher } from "@/components/AdminLocaleSwitcher";
import { ThemeToggle } from "@spektors/ui-shell";
import { useTranslations } from "next-intl";

export function AdminSidebarExtras() {
  const t = useTranslations("common");

  return (
    <div className="mt-auto space-y-3 border-t border-white/10 pt-4">
      <AdminLocaleSwitcher />
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
