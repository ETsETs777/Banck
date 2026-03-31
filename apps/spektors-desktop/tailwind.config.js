/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/renderer/index.html", "./src/renderer/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: "#a78bfa",
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(167, 139, 250, 0.35)",
      },
    },
  },
  plugins: [],
};
