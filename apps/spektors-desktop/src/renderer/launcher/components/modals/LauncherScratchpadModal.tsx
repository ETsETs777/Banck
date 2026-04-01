import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fileToDataUrl,
  loadScratchpad,
  MAX_FILE_BYTES,
  MAX_IMAGES,
  saveScratchpad,
  type ScratchpadData,
} from "../../utils/scratchpad-storage";

function persistScratchpad(
  text: string,
  images: ScratchpadData["images"],
): void {
  saveScratchpad({ v: 1, text, images });
}

const noDrag = { WebkitAppRegion: "no-drag" } as CSSProperties;

function uid() {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function LauncherScratchpadModal(props: {
  open: boolean;
  onClose: () => void;
}) {
  const { onClose } = props;
  const [text, setText] = useState("");
  const [images, setImages] = useState<ScratchpadData["images"]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const latestRef = useRef({ text: "", images: [] as ScratchpadData["images"] });
  latestRef.current = { text, images };

  useEffect(() => {
    if (!props.open) return;
    const d = loadScratchpad();
    setText(d.text);
    setImages(d.images);
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const { text: t, images: imgs } = latestRef.current;
      persistScratchpad(t, imgs);
    };
  }, [props.open]);

  const flushSave = useCallback((t: string, imgs: ScratchpadData["images"]) => {
    persistScratchpad(t, imgs);
  }, []);

  const scheduleSave = useCallback(
    (t: string, imgs: ScratchpadData["images"]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => flushSave(t, imgs), 400);
    },
    [flushSave],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const onText = (v: string) => {
    setText(v);
    scheduleSave(v, images);
  };

  const addImagesFromFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = [...files];
      let next = [...images];
      for (const f of list) {
        if (next.length >= MAX_IMAGES) break;
        const url = await fileToDataUrl(f);
        if (url) next = [...next, { id: uid(), dataUrl: url }];
      }
      setImages(next);
      flushSave(text, next);
    },
    [images, text, flushSave],
  );

  const removeImage = (id: string) => {
    const next = images.filter((x) => x.id !== id);
    setImages(next);
    flushSave(text, next);
  };

  const clearImages = () => {
    setImages([]);
    flushSave(text, []);
  };

  const closeAndSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    flushSave(text, images);
    onClose();
  }, [flushSave, text, images, onClose]);

  if (!props.open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm"
      style={noDrag}
      onClick={closeAndSave}
      role="presentation"
    >
      <div
        className="flex max-h-[min(92dvh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg)] shadow-2xl"
        style={noDrag}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="scratchpad-title"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--glass-border)] px-4 py-3">
          <div>
            <h2
              id="scratchpad-title"
              className="text-sm font-semibold text-[color:var(--fg)]"
            >
              Заметки и изображения
            </h2>
            <p className="text-[10px] text-[color:var(--fg-muted)]">
              Текст сохраняется локально. Картинки — вставка, перетаскивание или
              файл (до {MAX_IMAGES} шт., ~{Math.round(MAX_FILE_BYTES / 1024)} КБ
              каждая).
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-[var(--glass-border)] px-3 py-1.5 text-xs text-[color:var(--fg-muted)] transition hover:border-accent/40 hover:text-[color:var(--fg)]"
            onClick={closeAndSave}
          >
            Закрыть
          </button>
        </div>

        <div className="launcher-thin-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <textarea
            value={text}
            onChange={(e) => onText(e.target.value)}
            onPaste={(e) => {
              const items = e.clipboardData?.files;
              if (items?.length) void addImagesFromFiles(items);
            }}
            placeholder="Заметки, чек-листы, ссылки… Вставьте скриншот из буфера (Ctrl+V)."
            className="min-h-[200px] w-full resize-y rounded-lg border border-[var(--glass-border)] bg-[var(--glass-highlight)] p-3 font-mono text-xs leading-relaxed text-[color:var(--fg)] outline-none focus:border-accent/40"
            spellCheck={false}
          />

          <div
            className="rounded-lg border border-dashed border-[var(--glass-border)] bg-[var(--panel-fill)] px-3 py-6 text-center text-[11px] text-[color:var(--fg-muted)]"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.length)
                void addImagesFromFiles(e.dataTransfer.files);
            }}
          >
            Перетащите сюда изображения или{" "}
            <button
              type="button"
              className="text-accent underline decoration-accent/40"
              onClick={() => inputRef.current?.click()}
            >
              выберите файлы
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const f = e.target.files;
                if (f?.length) void addImagesFromFiles(f);
                e.target.value = "";
              }}
            />
          </div>

          {images.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-medium text-[color:var(--fg-muted)]">
                  Вложения ({images.length}/{MAX_IMAGES})
                </span>
                <button
                  type="button"
                  className="text-[10px] text-red-400/90 hover:underline"
                  onClick={clearImages}
                >
                  Убрать все картинки
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {images.map((im) => (
                  <div
                    key={im.id}
                    className="group relative w-[min(140px,42vw)] shrink-0 overflow-hidden rounded-lg border border-[var(--glass-border)]"
                  >
                    <img
                      src={im.dataUrl}
                      alt=""
                      className="aspect-video w-full object-cover"
                    />
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100"
                      onClick={() => removeImage(im.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
