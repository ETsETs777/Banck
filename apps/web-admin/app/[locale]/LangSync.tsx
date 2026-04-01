"use client";

import { LOCALE_KEY } from "@/lib/admin-prefs";
import { routing, usePathname, useRouter } from "@/i18n/routing";
import { useLocale } from "next-intl";
import { useEffect, useRef } from "react";

export default function LangSync() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const didRedirect = useRef(false);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (didRedirect.current) return;
    try {
      const stored = window.localStorage.getItem(LOCALE_KEY);
      if (
        stored &&
        routing.locales.includes(stored as (typeof routing.locales)[number]) &&
        stored !== locale
      ) {
        didRedirect.current = true;
        router.replace(pathname, { locale: stored });
      }
    } catch {
      /* ignore */
    }
  }, [locale, pathname, router]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LOCALE_KEY, locale);
    } catch {
      /* ignore */
    }
  }, [locale]);

  return null;
}
