import type { CSSProperties } from "react";
import type { SpektorsLauncherAPI } from "../../../spektors-launcher";

const dragStyle = { WebkitAppRegion: "drag" } as CSSProperties;
const noDragStyle = { WebkitAppRegion: "no-drag" } as CSSProperties;

export function WindowChrome(props: { api: SpektorsLauncherAPI }) {
  return (
    <div className="launcher-chrome-bar flex h-11 shrink-0 select-none items-stretch border-b border-[var(--glass-border)]">
      <div
        className="flex min-w-0 flex-1 items-center gap-2 px-3"
        style={dragStyle}
        onDoubleClick={() => props.api.winMaximizeToggle()}
        title="Перетащите окно. Двойной клик — развернуть или восстановить."
      >
        <span className="pointer-events-none flex h-6 w-6 items-center justify-center rounded-lg bg-accent/15 text-[10px] font-bold text-accent">
          S
        </span>
        <span className="pointer-events-none text-xs font-semibold tracking-tight text-[color:var(--fg)]">
          Spektors Launcher
        </span>
      </div>
      <div className="flex shrink-0 pr-1" style={noDragStyle}>
        <button
          type="button"
          className="flex h-11 w-10 items-center justify-center rounded-lg text-[color:var(--fg-muted)] transition hover:bg-[var(--glass-highlight)]"
          onClick={() => props.api.winMinimize()}
          aria-label="Свернуть"
        >
          <span className="pb-0.5 text-base leading-none">−</span>
        </button>
        <button
          type="button"
          className="flex h-11 w-10 items-center justify-center rounded-lg text-[color:var(--fg-muted)] transition hover:bg-[var(--glass-highlight)]"
          onClick={() => props.api.winMaximizeToggle()}
          aria-label="Развернуть или восстановить"
        >
          <span className="text-[10px] font-bold leading-none">▢</span>
        </button>
        <button
          type="button"
          className="ml-0.5 flex h-11 w-10 items-center justify-center rounded-lg text-[color:var(--fg-muted)] transition hover:bg-red-600/95 hover:text-white"
          onClick={() => props.api.winClose()}
          aria-label="Закрыть"
        >
          <span className="text-lg leading-none">×</span>
        </button>
      </div>
    </div>
  );
}
