import { describe, expect, it } from "vitest";
import { buildCourseGradeExportRows, courseGradeExportCsvRows } from "@/lib/evidence/adminEvidence";

describe("I/E exports preserve the existing recorded score components", () => {
  const project = { id: "old-project", currentTitleTh: "Synthetic", status: "IN_PROGRESS" as const,
    student: { studentCode: "0000000000001", firstNameTh: "Synthetic", lastNameTh: "Only" },
    attempts: [{ officialScore: 80, assessmentRound: { roundType: "PROPOSAL" as const }, evaluatorAssignments: [] }], advisorScore: null };
  it.each(["I", "E"])("records explicit %s without inventing missing scores or changing the existing weighting", grade => {
    const base = buildCourseGradeExportRows([project], [])[0];
    const row = buildCourseGradeExportRows([{ ...project, academicResult: { status: grade === "I" ? "INCOMPLETE" : "FINALIZED", originalGrade: grade, resolutionGrade: null, reference: "instructor-evidence" } }], [])[0];
    expect(row.academicResultCode).toBe(grade);
    expect(row.recordedTotalScore).toBe(base.recordedTotalScore);
    expect(row.proposalWeightedScore).toBe(base.proposalWeightedScore);
    expect(row.finalWeightedScore).toBeNull();
    expect(row.advisorWeightedScore).toBeNull();
    expect(row.missingScoreComponents).toEqual(base.missingScoreComponents);
    expect(courseGradeExportCsvRows([row])[0].slice(-3)).toEqual([grade, grade === "I" ? "INCOMPLETE" : "FINALIZED", "instructor-evidence"]);
  });
  it("exports a separately confirmed resolution while preserving the original I reference", () => {
    const row = buildCourseGradeExportRows([{ ...project, academicResult: { status: "RESOLVED", originalGrade: "I", resolutionGrade: "A", reference: "original-I", resolutionReference: "resolution-evidence" } }], [])[0];
    expect(row.academicResultCode).toBe("A");
    expect(row.resultReference).toBe("resolution-evidence");
    expect(row.finalWeightedScore).toBeNull();
  });
});
