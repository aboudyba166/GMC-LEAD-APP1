import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  // Scan the whole `src` tree so classes in e.g. `lib/` (if present) and future paths are not purged.
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
