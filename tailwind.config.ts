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
        ink: "#15171A",
        muted: "#6B7480",
        line: "#E3E6EC",
        lineStrong: "#CDD2DA",
        paper: "#F7F5F1",
        paper2: "#FAF8F4",
        paperSoft: "#FAF8F4",
        surface: "#FFFFFF",
        brand: "#9A1822",
        brandDark: "#7A141C",
        charcoal: "#374151"
      }
    }
  },
  plugins: [typography]
};

export default config;
