"use client";

export function CopyApiLink({ href }: { href: string }) {
  return (
    <button
      type="button"
      onClick={() => void navigator.clipboard.writeText(href)}
      className="rounded-lg border border-white/15 px-2 py-0.5 text-xs text-muted hover:border-accent/40 hover:text-foreground"
    >
      Копировать URL
    </button>
  );
}
