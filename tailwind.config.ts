import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        // Marketing-site mono, scoped via --font-label (app's `font-mono` is untouched).
        label: ["var(--font-label)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        navy: {
          50:  "#eef0ff",
          100: "#d5d9ff",
          200: "#aab2ff",
          300: "#7a87ff",
          400: "#4a5aff",
          500: "#1a2bdd",
          600: "#0A1172",
          700: "#080e5c",
          800: "#060b47",
          900: "#040832",
        },
        // Marketing-site "field manual" palette (additive; not used by the app).
        paper:    "#F2F1EC",
        sand:     "#E9E7DF",
        ink:      "#1C1B18",
        hairline: "#D8D5CA",
        clay:     "#C9501E",
      },
    },
  },
  plugins: [],
};

export default config;
