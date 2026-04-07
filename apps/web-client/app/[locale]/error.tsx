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
      "Остановите лишние процессы на порту 3000, удалите папку .next в apps/web-client и перезапустите dev-сервер. Если ошибка повторяется — откройте консоль (F12) и проверьте текст ниже.",
    retry: "Повторить",
  },
  en: {
    title: "Could not load this page",
    hint:
      "Stop anything else using port 3000, delete apps/web-client/.next, then restart the dev server. If it keeps failing, check the browser console (F12) and the details below.",
    retry: "Try again",
  },
  nl: {
    title: "Pagina kon niet worden geladen",
    hint:
      "Stop andere processen op poort 3000, verwijder apps/web-client/.next en start de dev-server opnieuw. Blijft het misgaan, open de console (F12) en bekijk de details hieronder.",
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
