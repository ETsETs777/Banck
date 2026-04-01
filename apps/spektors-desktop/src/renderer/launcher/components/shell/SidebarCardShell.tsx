import type { CSSProperties, ReactNode } from "react";
import {
  isSidebarCardId,
  LAUNCHER_CARD_DRAG_MIME,
} from "../../utils/sidebar-card-order";

const noDrag = { WebkitAppRegion: "no-drag" } as CSSProperties;

export function SidebarCardShell(props: {
  cardId: string;
  draggingId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropReorder: (fromId: string, toId: string) => void;
  sectionRef?: (el: HTMLDivElement | null) => void;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const active = props.draggingId === props.cardId;

  return (
    <div
      id={`sec-${props.cardId}`}
      ref={props.sectionRef}
      className={`rounded-xl border border-[color-mix(in_srgb,var(--glass-border)_65%,transparent)] bg-[var(--panel-fill)]/40 p-1.5 transition-colors ${active ? "border-accent/25 bg-accent/[0.07] ring-1 ring-accent/25" : ""}`}
      style={{ ...noDrag, ...props.style }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        const from = e.dataTransfer.getData(LAUNCHER_CARD_DRAG_MIME);
        if (from && from !== props.cardId) {
          props.onDropReorder(from, props.cardId);
        }
        props.onDragEnd();
      }}
    >
      <div className="flex gap-1.5">
        <button
          type="button"
          draggable
          title="Тянуть: порядок в панели или в зону под логом"
          className="mt-1 h-8 w-6 shrink-0 cursor-grab touch-none rounded-lg border border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--glass-highlight)_40%,transparent)] text-sm leading-none text-[color:var(--fg-muted)] transition hover:border-accent/45 active:cursor-grabbing"
          onDragStart={(e) => {
            e.dataTransfer.setData(LAUNCHER_CARD_DRAG_MIME, props.cardId);
            e.dataTransfer.effectAllowed = "move";
            props.onDragStart(props.cardId);
          }}
          onDragEnd={() => props.onDragEnd()}
          aria-label="Переместить карточку"
        >
          ⠿
        </button>
        <div className="min-w-0 flex-1">{props.children}</div>
      </div>
    </div>
  );
}

export function PinnedCardDropZone(props: {
  visible: boolean;
  onPin: (cardId: string) => void;
  onDragEnd: () => void;
}) {
  if (!props.visible) return null;
  return (
    <div
      className="mt-2 rounded-xl border border-dashed border-accent/40 bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] px-3 py-3.5 text-center text-[10px] font-medium text-[color:var(--fg-muted)] motion-safe:transition-colors motion-safe:duration-300 hover:border-accent/55 hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        const from = e.dataTransfer.getData(LAUNCHER_CARD_DRAG_MIME);
        if (from && isSidebarCardId(from)) props.onPin(from);
        props.onDragEnd();
      }}
    >
      Отпустите здесь — закрепить карточку под логом
    </div>
  );
}
