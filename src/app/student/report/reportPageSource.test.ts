import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(join(process.cwd(), "src/app/student/report/page.tsx"), "utf8");

describe("student report page source", () => {
  it("keeps the report page focused on report review rather than final presentation rubric", () => {
    const page = source();

    expect(page).not.toContain("FinalQaRubricPanel");
    expect(page).toContain("ข้อเสนอแนะที่ 1");
    expect(page).toContain("ตำแหน่งที่แก้ไขในเล่ม");
    expect(page).toContain("เหตุผลเชิงวิชาการ");
  });

  it("hides the report submit form while a submitted report is waiting for review", () => {
    const page = source();

    expect(page).toContain("gate.allowed ? (");
    expect(page).toContain("<InfoAlert title={reportActionLabel}>{reportSubmissionReasonLabel(gate.reason)}</InfoAlert>");
    expect(page).toContain("projectStatus: project.status");
  });

  it("does not unlock report submission only because the Final course round is closed", () => {
    const page = source();

    expect(page).toContain("isPresentationAssessmentComplete({");
    expect(page).not.toContain("roundStatus: project.courseOffering.assessmentRounds");
    expect(page).not.toContain('assessmentRounds: { where: { roundType: "FINAL_PRESENTATION" }');
  });
});
