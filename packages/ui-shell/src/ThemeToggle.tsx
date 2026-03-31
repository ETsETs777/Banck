"use client";

import { useCallback, useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "./theme-script.js";

export type ThemeToggleLabels = {
  /** Краткая подпись кнопки (видна при наведении / aria). */
  toggle: string;
  /** Подсказка, когда сейчас тёмная тема (клик включит светлую). */
  activateLight: string;
  /** Подсказка, когда сейчас светлая тема. */
  activateDark: string;
};

const defaultLabels: ThemeToggleLabels = {
  toggle: "Theme",
  activateLight: "Light theme",
  activateDark: "Dark theme",
};

function readTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "dark";
  const v = document.documentElement.getAttribute("data-theme");
  return v === "light" ? "light" : "dark";
}

export type ThemeToggleProps = {
  labels?: Partial<ThemeToggleLabels>;
  className?: string;
};

export function ThemeToggle({ labels: L, className }: ThemeToggleProps) {
  const lab = { ...defaultLabels, ...L };
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  const toggle = useCallback(() => {
    const next = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* private mode */
    }
    setTheme(next);
  }, []);

  const isDark = theme === "dark";
  const title = isDark ? lab.activateLight : lab.activateDark;

  return (
    <button
      type="button"
      onClick={toggle}
      className={
        className ??
        "flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-black/40 text-lg shadow-glow backdrop-blur-md transition hover:border-accent/40 hover:bg-white/10"
      }
      style={{
        borderColor: "var(--glass-border)",
        background: "var(--glass)",
      }}
      aria-label={lab.toggle}
      title={title}
    >
      <span aria-hidden className="select-none leading-none">
        {isDark ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
