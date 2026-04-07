import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

const IFRAME_W = 614;
const IFRAME_H = 244;
const IFRAME_SRC =
  "https://music.yandex.ru/iframe/album/813401/track/47131133";

const noDrag = { WebkitAppRegion: "no-drag" } as CSSProperties;

/**
 * Компактный плеер Яндекс Музыки в сайдбаре (масштаб под ширину колонки).
 * Требует frame-src https://music.yandex.ru в CSP.
 */
export function YandexMusicMini() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const [open, setOpen] = useState(true);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => {
      const w = el.clientWidth;
      if (w < 48) return;
      setScale(Math.min(1, w / IFRAME_W));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const scaledH = IFRAME_H * scale;

  return (
    <div
      className="overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--panel-fill)]"
      style={noDrag}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left transition hover:bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]"
      >
        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[color:var(--fg-muted)]">
          Музыка
        </span>
        <span className="text-[10px] text-[color:var(--fg-muted)]">
          {open ? "▼" : "▶"}
        </span>
      </button>
      {open ? (
        <div
          ref={wrapRef}
          className="w-full overflow-hidden border-t border-[var(--glass-border)]/60 bg-black/20"
          style={{ height: scaledH }}
        >
          <iframe
            title="Яндекс Музыка"
            src={IFRAME_SRC}
            width={IFRAME_W}
            height={IFRAME_H}
            className="block max-w-none"
            style={{
              border: "none",
              transform: `scale(${scale})`,
              transformOrigin: "0 0",
              ...noDrag,
            }}
            allow="clipboard-write; autoplay"
            loading="lazy"
          />
        </div>
      ) : null}
    </div>
  );
}
