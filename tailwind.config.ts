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
      },
    },
  },
  plugins: [],
};

export default config;
