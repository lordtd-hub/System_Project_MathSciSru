import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("responsive UI source checks", () => {
  it("keeps proposal summary mobile-friendly with responsive table cards", () => {
    const source = readFileSync(join(process.cwd(), "src/app/admin/proposals/page.tsx"), "utf8");
    expect(source).toContain("responsive-table");
    expect(source).not.toContain("teacherAccountClaim");
  });

  it("keeps proposal scoring tappable and collapsible on mobile", () => {
    const source = readFileSync(join(process.cwd(), "src/app/teacher/scoring/[assignmentId]/page.tsx"), "utf8");
    expect(source).toContain("<details");
    expect(source).toContain("min-h-14");
    expect(source).toContain("sticky-score");
  });

  it("keeps student proposal submit action visible on long mobile forms", () => {
    const source = readFileSync(join(process.cwd(), "src/app/student/proposal/page.tsx"), "utf8");
    expect(source).toContain("sticky bottom-0");
    expect(source).toContain("w-full sm:w-auto");
  });
});
