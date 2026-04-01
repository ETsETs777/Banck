"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  SPEKTORS_PROFILE_STORAGE_KEY,
  loadSpektorsProfile,
  profileInitials,
  saveSpektorsProfile,
  type SpektorsProfileV1,
} from "./profile-storage.js";

export type ProfileMenuProps = {
  className?: string;
  /** После сохранения в localStorage (например запись в userData в Electron). */
  onAfterSave?: (p: SpektorsProfileV1) => void | Promise<void>;
  /** В лаунчере — центрированное окно без обрезания по краю окна. */
  presentation?: "popover" | "modal";
  /**
   * compact — узкая кнопка (как в шапке).
   * sidebar — полная карточка для колонки навигации лаунчера.
   */
  triggerLayout?: "compact" | "sidebar";
};

function ProfileForm(props: {
  nameDraft: string;
  setNameDraft: (v: string) => void;
  emailDraft: string;
  setEmailDraft: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
  compactHelp?: boolean;
}) {
  return (
    <>
      {!props.compactHelp ? (
        <p
          className="mb-3 text-xs font-medium uppercase tracking-wide"
          style={{ color: "var(--fg-muted)" }}
        >
          Как на сайте
        </p>
      ) : null}
      <p className="mb-3 text-xs leading-relaxed" style={{ color: "var(--fg-muted)" }}>
        {props.compactHelp
          ? "Тот же ключ localStorage, что у web-client; в лаунчере дублируется файлом в userData."
          : (
            <>
              Один формат с веб-клиентом (ключ{" "}
              <code className="rounded bg-black/20 px-1 font-mono text-[10px]">
                spektors.profile.v1
              </code>
              ). В браузере — в localStorage сайта; в лаунчере — в хранилище Electron
              плюс резервный файл в папке данных приложения.
            </>
          )}
      </p>
      <label className="block">
        <span
          className="mb-1 block text-[11px] font-medium"
          style={{ color: "var(--fg-muted)" }}
        >
          Отображаемое имя
        </span>
        <input
          value={props.nameDraft}
          onChange={(e) => props.setNameDraft(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none ring-[color:var(--ring)] focus:ring-2"
          style={{
            borderColor: "var(--glass-border)",
            background: "var(--glass-highlight)",
            color: "var(--fg)",
          }}
        />
      </label>
      <label className="mt-2 block">
        <span
          className="mb-1 block text-[11px] font-medium"
          style={{ color: "var(--fg-muted)" }}
        >
          Email (необязательно)
        </span>
        <input
          type="email"
          value={props.emailDraft}
          onChange={(e) => props.setEmailDraft(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none ring-[color:var(--ring)] focus:ring-2"
          style={{
            borderColor: "var(--glass-border)",
            background: "var(--glass-highlight)",
            color: "var(--fg)",
          }}
        />
      </label>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={props.onCancel}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-white/5"
          style={{
            borderColor: "var(--glass-border)",
            color: "var(--fg-muted)",
          }}
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={() => void props.onSave()}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:opacity-90"
          style={{ background: "var(--accent)" }}
        >
          Сохранить
        </button>
      </div>
    </>
  );
}

export function ProfileMenu({
  className,
  onAfterSave,
  presentation = "popover",
  triggerLayout = "compact",
}: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<SpektorsProfileV1>(() => {
    return loadSpektorsProfile() ?? { displayName: "Гость" };
  });
  const [nameDraft, setNameDraft] = useState(profile.displayName);
  const [emailDraft, setEmailDraft] = useState(profile.email ?? "");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SPEKTORS_PROFILE_STORAGE_KEY) return;
      setProfile(loadSpektorsProfile() ?? { displayName: "Гость" });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!open) return;
    const p = loadSpektorsProfile() ?? { displayName: "Гость" };
    setNameDraft(p.displayName);
    setEmailDraft(p.email ?? "");
  }, [open]);

  useEffect(() => {
    if (!open || presentation === "modal") return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, presentation]);

  useEffect(() => {
    if (!open || presentation !== "modal") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, presentation]);

  const commit = useCallback(async () => {
    const next: SpektorsProfileV1 = {
      displayName: nameDraft.trim() || "Гость",
      email: emailDraft.trim() || undefined,
    };
    saveSpektorsProfile(next);
    setProfile(next);
    setOpen(false);
    await onAfterSave?.(next);
  }, [nameDraft, emailDraft, onAfterSave]);

  const letter = profileInitials(profile.displayName);

  const dialog = (
    <div
      className={
        presentation === "modal"
          ? "fixed inset-0 z-[500] flex items-center justify-center p-4"
          : "absolute right-0 top-[calc(100%+8px)] z-[100] w-[min(100vw-2rem,280px)]"
      }
      role="presentation"
    >
      {presentation === "modal" ? (
        <button
          type="button"
          className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          aria-label="Закрыть"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <div
        className={
          presentation === "modal"
            ? "relative z-[1] max-h-[min(520px,85vh)] w-full max-w-sm overflow-y-auto rounded-lg border p-4 shadow-2xl"
            : "rounded-xl border p-4 shadow-xl backdrop-blur-md"
        }
        style={{
          borderColor: "var(--glass-border)",
          background:
            presentation === "modal"
              ? "var(--glass-highlight)"
              : "var(--glass)",
          boxShadow:
            presentation === "modal"
              ? "0 24px 64px rgba(0,0,0,0.45)"
              : "0 16px 48px rgba(0,0,0,0.35)",
        }}
        role="dialog"
        aria-label="Профиль"
        onClick={(e) => e.stopPropagation()}
      >
        <ProfileForm
          nameDraft={nameDraft}
          setNameDraft={setNameDraft}
          emailDraft={emailDraft}
          setEmailDraft={setEmailDraft}
          onCancel={() => setOpen(false)}
          onSave={() => void commit()}
          compactHelp={presentation === "modal"}
        />
      </div>
    </div>
  );

  const triggerButton =
    triggerLayout === "sidebar" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2.5 text-left transition hover:border-[color:var(--accent)]/45"
        style={{
          borderColor: "var(--glass-border)",
          background: "var(--panel-fill)",
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-zinc-950 shadow-sm"
          style={{ background: "var(--accent)" }}
        >
          {letter}
        </span>
        <div className="min-w-0 flex-1">
          <span
            className="block truncate text-xs font-semibold"
            style={{ color: "var(--fg)" }}
          >
            {profile.displayName}
          </span>
          <span
            className="mt-0.5 block truncate text-[10px]"
            style={{ color: "var(--fg-muted)" }}
          >
            {profile.email?.trim()
              ? profile.email
              : "Профиль · нажмите, чтобы изменить"}
          </span>
        </div>
        <span
          className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
          style={{
            background: "color-mix(in srgb, var(--accent) 22%, transparent)",
            color: "var(--accent)",
          }}
        >
          Изменить
        </span>
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition hover:border-[color:var(--accent)]/50"
        style={{
          borderColor: "var(--glass-border)",
          background: "var(--glass)",
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-zinc-950"
          style={{ background: "var(--accent)" }}
        >
          {letter}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span
            className="block max-w-[120px] truncate text-xs font-medium"
            style={{ color: "var(--fg)" }}
          >
            {profile.displayName}
          </span>
        </span>
      </button>
    );

  return (
    <div ref={rootRef} className={className ?? "relative"}>
      {triggerButton}

      {open && presentation === "modal" && typeof document !== "undefined"
        ? createPortal(dialog, document.body)
        : null}
      {open && presentation === "popover" ? dialog : null}
    </div>
  );
}
