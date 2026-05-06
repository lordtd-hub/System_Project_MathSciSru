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
        muted: "#5B6470",
        line: "#E3E6EC",
        paper: "#F7F5F1",
        paperSoft: "#FBFAF7",
        brand: "#9A1822",
        brandDark: "#74131A",
        charcoal: "#374151"
      }
    }
  },
  plugins: [typography]
};

export default config;
