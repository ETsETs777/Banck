import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { THEME_STORAGE_KEY } from "@spektors/ui-shell";
import App from "./App";
import "./index.css";

function syncThemeFromStorage(): void {
  try {
    const t = localStorage.getItem(THEME_STORAGE_KEY);
    if (t === "light" || t === "dark") {
      document.documentElement.setAttribute("data-theme", t);
      return;
    }
    const m =
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-color-scheme: light)").matches;
    document.documentElement.setAttribute("data-theme", m ? "light" : "dark");
  } catch {
    /* private mode */
  }
}
syncThemeFromStorage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
