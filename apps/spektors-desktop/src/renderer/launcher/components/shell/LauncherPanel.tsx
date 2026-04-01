import type { CSSProperties, ReactNode } from "react";

const noDragStyle = { WebkitAppRegion: "no-drag" } as CSSProperties;

export function LauncherPanel(props: {
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Растянуть панель по высоте flex-родителя (нужно для области логов). */
  fill?: boolean;
  /** «Стеклянная» рамка и крупная иконка — для главной зоны (логи). */
  elevated?: boolean;
  /** Клик по заголовку (иконка + название) — например открыть карточку крупно. */
  onHeaderClick?: () => void;
}) {
  const elevated = props.elevated === true;
  const base = elevated
    ? "launcher-glass-panel p-3 sm:p-4"
    : "rounded-xl border border-[var(--glass-border)] bg-[var(--panel-fill)]/90 p-3 sm:p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";
  const layout = props.fill
    ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    : "";

  return (
    <div className={`${base} ${layout} ${props.className ?? ""}`.trim()}>
      <div
        className={`${elevated ? "mb-3" : "mb-2"} flex shrink-0 flex-wrap items-start justify-between gap-2`}
      >
        <div
          className={`flex min-w-0 flex-1 items-start gap-3 rounded-xl px-1 py-0.5 -ml-1 ${
            props.onHeaderClick
              ? "cursor-pointer transition hover:bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]"
              : ""
          }`}
          title={
            props.onHeaderClick
              ? "Нажмите, чтобы открыть карточку крупно"
              : undefined
          }
          role={props.onHeaderClick ? "button" : undefined}
          tabIndex={props.onHeaderClick ? 0 : undefined}
          onClick={props.onHeaderClick}
          onKeyDown={(e) => {
            if (!props.onHeaderClick) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              props.onHeaderClick();
            }
          }}
        >
          {elevated ? (
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--accent)_28%,var(--glass-border))] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-accent shadow-sm">
              {props.icon}
            </span>
          ) : (
            <span className="mt-0.5 shrink-0 text-accent">{props.icon}</span>
          )}
          <div className={`min-w-0 ${elevated ? "pt-0.5" : ""}`}>
            <h2 className="text-sm font-semibold tracking-tight text-[color:var(--fg)]">
              {props.title}
            </h2>
            {props.description ? (
              <p
                className={`text-[10px] leading-relaxed text-[color:var(--fg-muted)] ${elevated ? "mt-1" : "mt-0.5"}`}
              >
                {props.description}
              </p>
            ) : null}
          </div>
        </div>
        {props.actions ? (
          <div className="shrink-0" style={noDragStyle}>
            {props.actions}
          </div>
        ) : null}
      </div>
      <div
        className={
          props.fill
            ? "min-h-0 flex-1 flex flex-col overflow-hidden"
            : "min-w-0"
        }
        style={noDragStyle}
      >
        {props.children}
      </div>
    </div>
  );
}
