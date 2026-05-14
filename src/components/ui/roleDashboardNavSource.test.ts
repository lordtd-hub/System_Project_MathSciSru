import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = () => readFileSync("src/components/ui/RoleDashboardNav.tsx", "utf8");

describe("role dashboard navigation source", () => {
  it("uses one role dashboard return control with a page context badge", () => {
    const component = source();
    const css = readFileSync("src/app/globals.css", "utf8");

    expect(component).toContain("กลับแดชบอร์ดผู้ดูแลระบบ");
    expect(component).toContain("กลับแดชบอร์ดอาจารย์");
    expect(component).toContain("กลับแดชบอร์ดนักศึกษา");
    expect(component).toContain("role-dashboard-context");
    expect(component).toContain("getContextLabel");
    expect(component).not.toContain("secondaryHref");
    expect(css).toContain(".role-dashboard-context");
    expect(css).toContain(".role-dashboard-nav-copy");
  });

  it("does not duplicate dashboard return buttons inside subpage headers", () => {
    const duplicatePronePages = [
      "src/app/teacher/advicees/page.tsx",
      "src/app/admin/closeout/page.tsx",
      "src/app/admin/evidence/page.tsx",
      "src/app/admin/reports/page.tsx"
    ];

    for (const filePath of duplicatePronePages) {
      const page = readFileSync(filePath, "utf8");

      expect(page).not.toContain('actions={<Link className="button-secondary" href="/teacher">');
      expect(page).not.toContain('actions={<Link className="button-secondary" href="/admin">');
    }
  });
});
