import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"]
      },
      colors: {
        ink: "#111827",
        muted: "#4B5563",
        line: "#E5E7EB",
        paper: "#F8FAFC",
        brand: "#C1121F",
        brandDark: "#8F0D17",
        charcoal: "#374151"
      }
    }
  },
  plugins: [typography]
};

export default config;
