import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const uiPreset = require("@spektors/ui-tokens/tailwind.preset.cjs");

/** @param {string} importMetaUrl */
export function createNextTailwindConfig(importMetaUrl) {
  const root = path.dirname(fileURLToPath(importMetaUrl));
  return {
    presets: [uiPreset],
    content: [
      path.join(root, "pages/**/*.{js,ts,jsx,tsx,mdx}"),
      path.join(root, "components/**/*.{js,ts,jsx,tsx,mdx}"),
      path.join(root, "app/**/*.{js,ts,jsx,tsx,mdx}"),
    ],
    theme: {
      extend: {
        colors: {
          background: "var(--bg)",
          foreground: "var(--fg)",
          muted: "var(--fg-muted)",
        },
        fontFamily: {
          sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        },
      },
    },
    plugins: [],
  };
}
