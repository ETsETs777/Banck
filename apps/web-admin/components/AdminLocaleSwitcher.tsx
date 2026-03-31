"use client";

import { Link, routing, usePathname } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { Fragment } from "react";

export function AdminLocaleSwitcher() {
  const t = useTranslations("locale");
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-muted shadow-glow backdrop-blur-md"
      role="navigation"
      aria-label={t("label")}
    >
      {routing.locales.map((loc, idx) => (
        <Fragment key={loc}>
          {idx > 0 ? (
            <span className="opacity-30" aria-hidden>
              |
            </span>
          ) : null}
          <Link
            href={pathname}
            locale={loc}
            className={
              locale === loc
                ? "font-semibold text-accent"
                : "hover:text-foreground"
            }
          >
            {t(loc)}
          </Link>
        </Fragment>
      ))}
    </div>
  );
}
