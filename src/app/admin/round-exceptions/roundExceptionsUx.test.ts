import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin round exception UX", () => {
  const exceptionsPage = readFileSync(join(process.cwd(), "src/app/admin/round-exceptions/page.tsx"), "utf8");
  const roundsPage = readFileSync(join(process.cwd(), "src/app/admin/rounds/page.tsx"), "utf8");
  const actionsSource = readFileSync(join(process.cwd(), "src/app/admin/actions.ts"), "utf8");

  it("moves long late-submission forms out of the rounds overview", () => {
    expect(roundsPage).toContain("/admin/round-exceptions?round_type=PROPOSAL");
    expect(roundsPage).toContain("จัดการผู้ส่งย้อนหลัง");
    expect(roundsPage).not.toContain("missingProposalProjects.map((project)");
  });

  it("renders a searchable list page for missed and late round cases", () => {
    expect(exceptionsPage).toContain("จัดการผู้ส่งย้อนหลัง / นักศึกษาที่พลาดรอบ");
    expect(exceptionsPage).toContain('name="status"');
    expect(exceptionsPage).toContain('name="q"');
    expect(exceptionsPage).toContain("<table");
    expect(exceptionsPage).toContain("เปิดส่งรายกรณี");
  });

  it("keeps late-open actions scoped and redirects back to the exception list when used there", () => {
    expect(exceptionsPage).toContain('name="return_to" value="/admin/round-exceptions"');
    expect(actionsSource).toContain('returnTo === "/admin/round-exceptions"');
    expect(actionsSource).toContain('revalidatePath("/admin/round-exceptions")');
  });
});
