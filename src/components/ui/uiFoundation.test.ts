import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("UI foundation", () => {
  it("loads Tailwind v3 directives from app globals", () => {
    const css = readFileSync("src/app/globals.css", "utf8");

    expect(css).toContain("@tailwind base;");
    expect(css).toContain("@tailwind components;");
    expect(css).toContain("@tailwind utilities;");
    expect(css).toContain(".panel");
    expect(css).toContain(".app-card");
    expect(css).toContain(".app-card-flat");
    expect(css).toContain("bg-surface p-5");
    expect(css).toContain(".button-secondary");
    expect(css).toContain(".btn-secondary");
    expect(css).toContain(".responsive-table");
    expect(css).toContain(".state-surface-current");
    expect(css).toContain(".dashboard-metric");
    expect(css).toContain(".workflow-group-current");
    expect(css).toContain(".workflow-chip");
    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toContain("min-h-11");
    expect(css).toContain("--shadow-soft");
    expect(css).toContain("background-size: 32px 32px");
  });

  it("imports global CSS from the root app layout", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");

    expect(layout).toContain('import "./globals.css";');
    expect(layout).toContain("PageShell");
    expect(layout).toContain("app-shell");
    expect(layout).toContain("/logo-mathstat-sru.jpg");
  });

  it("scans app, components, and lib files for Tailwind classes", () => {
    const config = readFileSync("tailwind.config.ts", "utf8");

    expect(config).toContain("./src/app/**/*.{js,ts,jsx,tsx,mdx}");
    expect(config).toContain("./src/components/**/*.{js,ts,jsx,tsx,mdx}");
    expect(config).toContain("./src/lib/**/*.{js,ts,jsx,tsx,mdx}");
    expect(config).toContain("#9A1822");
    expect(config).toContain("paperSoft");
  });

  it("keeps compact lifecycle status available for dense dashboard surfaces", () => {
    const lifecycle = readFileSync("src/components/ui/LifecycleStepper.tsx", "utf8");

    expect(lifecycle).toContain("CompactLifecycleBadge");
    expect(lifecycle).toContain("currentStepIndex(status)");
  });
});
