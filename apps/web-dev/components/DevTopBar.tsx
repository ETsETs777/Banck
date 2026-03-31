"use client";

import { ThemeToggle } from "@spektors/ui-shell";

const apiDocs =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function DevTopBar() {
  return (
    <div className="fixed right-4 top-4 z-50 flex flex-wrap items-center justify-end gap-2">
      <a
        href={`${apiDocs}/docs`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border px-3 py-2 text-xs text-muted transition hover:border-accent/40 hover:text-foreground"
        style={{
          borderColor: "var(--glass-border)",
          background: "var(--glass)",
        }}
      >
        Swagger
      </a>
      <ThemeToggle
        labels={{
          toggle: "Тема",
          activateLight: "Светлая тема",
          activateDark: "Тёмная тема",
        }}
      />
    </div>
  );
}
