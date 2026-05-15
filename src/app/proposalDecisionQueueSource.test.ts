import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("proposal decision queue source checks", () => {
  it("removes Proposal scoring work after Admin records the Proposal decision", () => {
    const teacherDashboard = read("src/app/teacher/page.tsx");
    const teacherProposalList = read("src/app/teacher/proposals/page.tsx");
    const teacherActions = read("src/app/teacher/actions.ts");
    const teacherScoringPage = read("src/app/teacher/scoring/[assignmentId]/page.tsx");

    expect(teacherDashboard).toContain("proposalResult: { is: null }");
    expect(teacherProposalList).toContain("proposalResult: { is: null }");
    expect(teacherActions).toContain("proposal_decision_already_saved");
    expect(teacherScoringPage).toContain("hasAdminProposalDecision");
    expect(teacherScoringPage).toContain("ผู้ดูแลระบบบันทึกผลการเสนอหัวข้อแล้ว");
  });
});
