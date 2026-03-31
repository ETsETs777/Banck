/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/renderer/index.html", "./src/renderer/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: "#22d3ee",
      },
      fontFamily: {
        sans: ["Outfit", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 48px -12px rgba(34, 211, 238, 0.35)",
        card: "0 4px 24px -8px rgba(0, 0, 0, 0.45)",
      },
    },
  },
  plugins: [],
};
