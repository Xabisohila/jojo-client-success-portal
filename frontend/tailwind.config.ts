import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0f4ff",
          100: "#e0e9ff",
          500: "#4f6ef7",
          600: "#3b5bf0",
          700: "#2d4de0",
          900: "#1a2fa0",
        },
      },
    },
  },
  plugins: [],
};

export default config;
