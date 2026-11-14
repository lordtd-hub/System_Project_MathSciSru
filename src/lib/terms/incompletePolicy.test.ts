import { describe, expect, it } from "vitest";
import { canContinueCourse, missingPresentationTypes, validateClosingDecisions } from "./incompletePolicy";
import { applyLatePenalty, hasOpenLateRoundException, requiresLateRoundPenalty } from "@/lib/assessments/roundExceptions";

describe("explicit academic I/E policy", () => {
  it("requires a reasoned per-person I/E decision, never inferring a grade from missing exams", () => {
    expect(validateClosingDecisions(["old-a", "old-b"], [{ projectId: "old-a", grade: "I", reason: "extra time" }, { projectId: "old-b", grade: "E", reason: "instructor decision" }])).toBe(true);
    expect(validateClosingDecisions(["old-a"], [])).toBe(false);
    expect(validateClosingDecisions(["old-a"], [{ projectId: "new-a", grade: "I", reason: "wrong term" }])).toBe(false);
    expect(validateClosingDecisions(["old-a"], [{ projectId: "old-a", grade: "", reason: "not decided" }])).toBe(false);
    expect(validateClosingDecisions(["old-a"], [{ projectId: "old-a", grade: "I", reason: " " }])).toBe(false);
    expect(validateClosingDecisions(["old-a", "old-b"], [{ projectId: "old-a", grade: "I", reason: "reason" }, { projectId: "old-a", grade: "E", reason: "duplicate" }])).toBe(false);
  });
  it("keeps unresolved I accessible after course closure while resolved results remain readable only", () => {
    expect(canContinueCourse("CLOSED", "INCOMPLETE")).toBe(true);
    expect(canContinueCourse("CLOSED", "FINALIZED")).toBe(false);
    expect(canContinueCourse("CLOSED", "RESOLVED")).toBe(false);
    expect(canContinueCourse("CLOSED")).toBe(false);
    expect(canContinueCourse("ACTIVE")).toBe(true);
  });
  it("distinguishes missing evidence from a real submitted zero", () => {
    const attempt = (type: string, status: string) => ({ assessmentRound: { roundType: type }, evaluatorAssignments: [{ scoreSubmission: { status } }] });
    expect(missingPresentationTypes([attempt("PROPOSAL", "SUBMITTED"), attempt("PROGRESS_1", "LOCKED"), attempt("FINAL_PRESENTATION", "DRAFT")])).toEqual(["PROGRESS_2", "FINAL_PRESENTATION"]);
    expect(missingPresentationTypes([{ officialScore: 0, assessmentRound: { roundType: "PROPOSAL" }, evaluatorAssignments: [] }])).not.toContain("PROPOSAL");
  });
  it("does not reuse I as a late override or silently waive existing 10% flags", () => {
    expect(hasOpenLateRoundException([{ exceptionType: "INCOMPLETE_CONTINUATION", status: "OPEN" }])).toBe(false);
    expect(requiresLateRoundPenalty([{ exceptionType: "INCOMPLETE_CONTINUATION", status: "OPEN" }])).toBe(false);
    expect(requiresLateRoundPenalty([{ exceptionType: "LATE_ASSESSMENT_ROUND", status: "OPEN" }])).toBe(true);
    expect(applyLatePenalty(80)).toBe(72);
  });
});
