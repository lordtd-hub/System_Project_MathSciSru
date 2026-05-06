import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("auth pilot source guards", () => {
  it("keeps dev login links development-only", () => {
    const layoutSource = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    const homeSource = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");

    expect(layoutSource).toContain('process.env.NODE_ENV === "development"');
    expect(homeSource).toContain("isDevLoginEnabled()");
    expect(homeSource).not.toContain('process.env.NODE_ENV !== "production"');
  });

  it("keeps dev login server actions disabled outside development", () => {
    const actionsSource = readFileSync(join(process.cwd(), "src/app/dev-login/actions.ts"), "utf8");

    expect(actionsSource).toContain('if (!isDevLoginEnabled()) throw new Error("Development login is disabled in production")');
    expect(actionsSource.match(/if \(!isDevLoginEnabled\(\)\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps pending teachers out of scoring mutations until admin approval", () => {
    const teacherActionsSource = readFileSync(join(process.cwd(), "src/app/teacher/actions.ts"), "utf8");

    expect(teacherActionsSource).toContain('user.role !== "TEACHER"');
    expect(teacherActionsSource).toContain("ต้องได้รับอนุมัติก่อน");
    expect(teacherActionsSource).toContain("ต้องได้รับอนุมัติเป็นอาจารย์ก่อน");
  });
});
