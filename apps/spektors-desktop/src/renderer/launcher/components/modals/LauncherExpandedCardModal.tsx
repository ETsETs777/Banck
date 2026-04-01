import type { CSSProperties } from "react";
import type { SidebarCardId } from "../../utils/sidebar-card-order";
import { SidebarCardBody } from "../sidebar/SidebarCardBody";

const noDrag = { WebkitAppRegion: "no-drag" } as CSSProperties;

export function LauncherExpandedCardModal(props: {
  cardId: SidebarCardId;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-2 sm:p-4 backdrop-blur-sm"
      style={noDrag}
      onClick={props.onClose}
      role="presentation"
    >
      <div
        className="launcher-sidebar-scroll flex max-h-[min(94dvh,960px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg)] shadow-2xl"
        style={noDrag}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="expanded-card-title"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--glass-border)] px-4 py-2.5">
          <span
            id="expanded-card-title"
            className="text-xs font-semibold text-[color:var(--fg-muted)]"
          >
            Карточка (крупный вид)
          </span>
          <button
            type="button"
            className="rounded-lg border border-[var(--glass-border)] px-3 py-1.5 text-xs text-[color:var(--fg-muted)] transition hover:border-accent/40 hover:text-[color:var(--fg)]"
            onClick={props.onClose}
          >
            Закрыть · Esc
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          <SidebarCardBody id={props.cardId} />
        </div>
      </div>
    </div>
  );
}
