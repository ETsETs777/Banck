import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
    },
    optimizeDeps: {
      include: ["@spektors/ui-shell"],
    },
  },
  resolve: {
    alias: {
      "@": resolve("src/renderer"),
    },
  },
});
