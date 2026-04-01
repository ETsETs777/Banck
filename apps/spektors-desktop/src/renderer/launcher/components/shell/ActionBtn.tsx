import type { CSSProperties } from "react";

const noDrag = { WebkitAppRegion: "no-drag" } as CSSProperties;

export function ActionBtn(props: {
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      title={props.title}
      onClick={props.onClick}
      className="inline-flex min-h-[34px] items-center justify-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium transition hover:border-accent/40 disabled:opacity-40"
      style={{
        ...noDrag,
        borderColor: "var(--glass-border)",
        background: "var(--glass-highlight)",
        color: "var(--fg)",
      }}
    >
      {props.loading ? (
        <span
          className="h-3 w-3 animate-spin rounded-full border-2 border-t-accent border-[var(--glass-border)]"
          aria-hidden
        />
      ) : null}
      {props.label}
    </button>
  );
}
