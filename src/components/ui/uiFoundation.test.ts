import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("UI foundation", () => {
  it("loads Tailwind v3 directives from app globals", () => {
    const css = readFileSync("src/app/globals.css", "utf8");

    expect(css).toContain("@tailwind base;");
    expect(css).toContain("@tailwind components;");
    expect(css).toContain("@tailwind utilities;");
    expect(css).toContain(".panel");
    expect(css).toContain(".button-secondary");
    expect(css).toContain(".responsive-table");
    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toContain("min-h-11");
  });

  it("imports global CSS from the root app layout", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");

    expect(layout).toContain('import "./globals.css";');
    expect(layout).toContain("PageShell");
    expect(layout).toContain("app-shell");
  });

  it("scans app, components, and lib files for Tailwind classes", () => {
    const config = readFileSync("tailwind.config.ts", "utf8");

    expect(config).toContain("./src/app/**/*.{js,ts,jsx,tsx,mdx}");
    expect(config).toContain("./src/components/**/*.{js,ts,jsx,tsx,mdx}");
    expect(config).toContain("./src/lib/**/*.{js,ts,jsx,tsx,mdx}");
  });
});
