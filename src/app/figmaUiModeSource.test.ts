import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("figma UI mode source", () => {
  it("keeps production on classic unless explicitly allowed", () => {
    const source = readSource("src/lib/uiMode.ts");

    expect(source).toContain('env.VERCEL_ENV === "production"');
    expect(source).toContain('env.FIGMA_UI_ALLOW_PRODUCTION !== "1"');
    expect(source).toContain('return "classic"');
    expect(source).toContain("UI_MODE_COOKIE");
  });

  it("adds a QA-only mode switch without changing role routes", () => {
    const adminLayout = readSource("src/app/admin/layout.tsx");
    const teacherLayout = readSource("src/app/teacher/layout.tsx");
    const studentLayout = readSource("src/app/student/layout.tsx");

    for (const source of [adminLayout, teacherLayout, studentLayout]) {
      expect(source).toContain("getUiMode");
      expect(source).toContain('uiMode === "figma"');
      expect(source).toContain("RoleDashboardNav");
      expect(source).toContain("UiModeSwitch");
    }
  });

  it("creates the shared Figma role shell and visual surfaces", () => {
    const shell = readSource("src/components/redesign/FigmaRoleShell.tsx");
    const surfaces = readSource("src/components/redesign/VisualSurfaces.tsx");
    const css = readSource("src/app/globals.css");

    expect(shell).toContain("FigmaRoleShell");
    expect(shell).toContain("UiModeSwitch");
    expect(shell).toContain("figma-role-sidebar");
    expect(surfaces).toContain("FigmaReviewLayout");
    expect(surfaces).toContain("FigmaMetricCard");
    expect(css).toContain(".figma-role-shell");
    expect(css).toContain(".figma-review-layout");
    expect(css).toContain("@apply grid gap-4 lg:grid-cols");
  });

  it("keeps figma chrome and status surfaces compact for dense operational screens", () => {
    const shell = readSource("src/components/redesign/FigmaRoleShell.tsx");
    const surfaces = readSource("src/components/redesign/VisualSurfaces.tsx");
    const statusBadge = readSource("src/components/ui/StatusBadge.tsx");
    const css = readSource("src/app/globals.css");

    expect(shell).toContain("navIconByHref");
    expect(shell).toContain("figma-role-nav-icon");
    expect(shell).toContain("data-label");
    expect(surfaces).toContain('title={title}');
    expect(surfaces).toContain("min-w-0 truncate");
    expect(statusBadge).toContain("max-w-full");
    expect(statusBadge).toContain("title={displayLabel}");
    expect(css).toContain("lg:grid-cols-[88px_minmax(0,1fr)]");
    expect(css).toContain(".figma-role-nav a::after");
    expect(css).toContain(".figma-action-list:has(> :nth-child(6))");
    expect(css).toContain("@apply min-h-[4.75rem]");
    expect(css).toContain("line-clamp-1");
  });

  it("redirects back to the current route after switching modes", () => {
    const action = readSource("src/app/ui-mode/actions.ts");

    expect(action).toContain("headers");
    expect(action).toContain("redirect");
    expect(action).toContain("uiModeRedirectPath");
    expect(action).toContain('headerStore.get("referer")');
  });
});
