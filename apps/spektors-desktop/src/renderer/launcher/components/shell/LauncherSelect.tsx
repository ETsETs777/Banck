import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

const noDrag = { WebkitAppRegion: "no-drag" } as CSSProperties;

export type LauncherSelectOption = { value: string; label: string };

export function LauncherSelect(props: {
  value: string;
  onChange: (value: string) => void;
  options: LauncherSelectOption[];
  disabled?: boolean;
  /** Классы корневого `relative`-контейнера (ширина и т.д.). */
  className?: string;
  /** Классы кнопки-триггера (размер текста, padding). */
  buttonClassName?: string;
  "aria-label"?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = props.options.find((o) => o.value === props.value);
  const display =
    current?.label ?? props.options[0]?.label ?? "";

  return (
    <div
      ref={rootRef}
      className={`relative ${props.className ?? ""}`.trim()}
      style={noDrag}
    >
      <button
        id={props.id}
        type="button"
        disabled={props.disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={props["aria-label"]}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full min-w-0 items-center justify-between gap-1 border text-left outline-none transition hover:border-accent/35 disabled:opacity-40 ${
          props.buttonClassName ?? "rounded-md px-2 py-1 text-[11px]"
        }`}
        style={{
          borderColor: "var(--glass-border)",
          background: "var(--glass-highlight)",
          color: "var(--fg)",
        }}
      >
        <span className="min-w-0 flex-1 truncate">{display}</span>
        <span
          className="shrink-0 text-[9px] opacity-60"
          aria-hidden
        >
          ▼
        </span>
      </button>
      {open ? (
        <ul
          role="listbox"
          className="launcher-thin-scroll absolute left-0 right-0 top-full z-[200] mt-1 max-h-60 min-w-[100%] overflow-y-auto rounded-lg border py-1 shadow-xl"
          style={{
            borderColor: "var(--glass-border)",
            background: "var(--bg)",
            color: "var(--fg)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
          }}
        >
          {props.options.map((opt) => {
            const selected = opt.value === props.value;
            return (
              <li
                key={opt.value === "" ? "__empty" : opt.value}
                role="option"
                aria-selected={selected}
                className={`cursor-pointer px-2 py-1.5 text-[11px] ${
                  selected
                    ? "bg-accent/15 text-[color:var(--fg)]"
                    : "text-[color:var(--fg)] hover:bg-[var(--panel-fill)]"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  props.onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
