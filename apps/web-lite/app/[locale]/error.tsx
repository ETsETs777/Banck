"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type Loc = "ru" | "en" | "nl";

const MSGS: Record<
  Loc,
  { title: string; hint: string; retry: string }
> = {
  ru: {
    title: "Не удалось загрузить страницу",
    hint:
      "Остановите процесс на порту 3001, удалите apps/web-lite/.next и перезапустите dev-сервер. Подробности — в консоли (F12) и ниже.",
    retry: "Повторить",
  },
  en: {
    title: "Could not load this page",
    hint:
      "Free port 3001, delete apps/web-lite/.next, restart the dev server. See the browser console (F12) and the details below.",
    retry: "Try again",
  },
  nl: {
    title: "Pagina kon niet worden geladen",
    hint:
      "Maak poort 3001 vrij, verwijder apps/web-lite/.next en start de dev-server opnieuw. Zie de console (F12) en de details hieronder.",
    retry: "Opnieuw proberen",
  },
};

function localeFromPath(pathname: string | null): Loc {
  const seg = pathname?.split("/").filter(Boolean)[0];
  if (seg === "en" || seg === "nl" || seg === "ru") return seg;
  return "ru";
}

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const t = MSGS[localeFromPath(pathname)];

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-12 sm:py-16">
      <h1 className="text-xl font-semibold text-foreground">{t.title}</h1>
      <p className="text-sm text-muted">{t.hint}</p>
      {process.env.NODE_ENV === "development" ? (
        <pre
          className="max-h-48 overflow-auto rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-200"
          tabIndex={0}
        >
          {error.message}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="w-fit rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
        style={{ background: "var(--accent)" }}
      >
        {t.retry}
      </button>
    </main>
  );
}
