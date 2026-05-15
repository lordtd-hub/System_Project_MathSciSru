import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("advisor score workflow source guards", () => {
  it("keeps advisor score page approved-teacher guarded", () => {
    const page = read("src/app/teacher/advisor-score/page.tsx");
    expect(page).toContain("auth()");
    expect(page).toContain("hasApprovedTeacherCapability(session?.user)");
    expect(page).toContain("คะแนนสรุปของอาจารย์ที่ปรึกษา 25%");
    expect(page).toContain("submitAdvisorScore");
  });

  it("shows advisor score as read-only after the advisor has submitted", () => {
    const page = read("src/app/teacher/advisor-score/page.tsx");
    expect(page).toContain("const submitted = previous?.status === \"SUBMITTED\" && previous.score != null");
    expect(page).toContain('"COMPLETED"');
    expect(page).toContain("บันทึกคะแนนสรุปแล้ว");
    expect(page).toContain("advisorScoreSummary(previous)");
  });

  it("keeps advisor score action advisor-only and report-approved gated", () => {
    const actions = read("src/app/teacher/actions.ts");
    expect(actions).toContain("submitAdvisorScore");
    expect(actions).toContain("hasApprovedTeacherCapability(user)");
    expect(actions).toContain("validateAdvisorScore");
    expect(actions).toContain('assignment.role === "ADVISOR"');
    expect(actions).toContain('project.status !== "REPORT_APPROVED" && project.status !== "ADVISOR_SCORING"');
    expect(actions).toContain("advisorScore.upsert");
  });

  it("moves only to ADVISOR_SCORING and does not complete the project", () => {
    const actions = read("src/app/teacher/actions.ts");
    const start = actions.indexOf("export async function submitAdvisorScore");
    const end = actions.indexOf('redirectWithQuery("/teacher/advisor-score"', start);
    const slice = actions.slice(start, end);
    expect(slice).toContain('toStatus: "ADVISOR_SCORING"');
    expect(slice).not.toContain("COMPLETED");
  });
});
