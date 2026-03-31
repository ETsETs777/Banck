"use client";

import { ThemeToggle } from "@spektors/ui-shell";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "./LocaleSwitcher";

export function AppTopBar() {
  const t = useTranslations("common");
  return (
    <div className="fixed right-4 top-4 z-50 flex flex-wrap items-center justify-end gap-2">
      <ThemeToggle
        labels={{
          toggle: t("themeToggle"),
          activateLight: t("themeToLight"),
          activateDark: t("themeToDark"),
        }}
      />
      <LocaleSwitcher />
    </div>
  );
}
