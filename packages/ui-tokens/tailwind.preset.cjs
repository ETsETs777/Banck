/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        fg: "var(--fg)",
        muted: "var(--fg-muted)",
        accent: "var(--accent)",
        danger: "var(--danger)",
      },
      backgroundImage: {
        "app-gradient": "var(--bg-gradient)",
      },
      boxShadow: {
        glow: "0 0 24px var(--accent-glow)",
      },
    },
  },
};
