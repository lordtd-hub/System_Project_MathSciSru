import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("self-scheduling and progress scoring source guards", () => {
  it("keeps student scheduling tied to course-level rounds and student ownership", () => {
    const actions = read("src/app/student/actions.ts");
    expect(actions).toContain("requireStudentContext()");
    expect(actions).toContain("submitExamSchedule");
    expect(actions).toContain("กรุณาเลือกอาจารย์ที่ปรึกษาก่อนส่งคำขอ");
    expect(actions).toContain("proposal_round_not_open");
    expect(actions).toContain("courseOfferingId_roundType");
    expect(actions).toContain("isRoundOpen(round.status)");
    expect(actions).toContain('project.status !== "IN_PROGRESS"');
    expect(actions).toContain("assessmentRoundId: round.id");
    expect(actions).toContain("saveAssessmentEvidence");
    expect(actions).toContain("assessment_evidence_required");
    expect(actions).toContain("findFirst");
    expect(actions).toContain("examScheduleProposal.update");
    expect(actions).toContain("examScheduleProposal.create");
  });

  it("keeps schedule views role guarded", () => {
    expect(read("src/app/admin/schedules/page.tsx")).toContain('session?.user.role !== "ADMIN"');
    expect(read("src/app/teacher/schedules/page.tsx")).toContain("hasApprovedTeacherCapability(session?.user)");
  });

  it("keeps student schedule rubric guidance separated by round", () => {
    const page = read("src/app/student/schedule/page.tsx");
    expect(page).toContain("ProgressQaRubricPanel");
    expect(page).toContain("FinalQaRubricPanel");
    expect(page).toContain("visibleGuidanceRounds.map");
    expect(page).toContain('roundType === "PROGRESS_1" || roundType === "PROGRESS_2"');
    expect(page).toContain('roundType === "FINAL_PRESENTATION"');
    expect(page).toContain("บันทึกเอกสาร/หลักฐานสำหรับรอบสอบ");
    expect(page).toContain("saveAssessmentEvidence");
    expect(page).toContain("schedulableRoundsWithEvidence");
  });

  it("shows assessment evidence to committee teachers before scoring", () => {
    const teacherSchedules = read("src/app/teacher/schedules/page.tsx");
    const progress1 = read("src/app/teacher/progress1/page.tsx");
    const progress2 = read("src/app/teacher/progress2/page.tsx");
    expect(teacherSchedules).toContain("assessmentSubmissions");
    expect(teacherSchedules).toContain("เปิดเอกสาร/หลักฐาน");
    expect(progress1).toContain('where: { kind: "PROGRESS_1" }');
    expect(progress2).toContain('where: { kind: "PROGRESS_2" }');
  });

  it("keeps Progress 1 scoring assigned-teacher only and duplicate-safe", () => {
    const actions = read("src/app/teacher/actions.ts");
    expect(actions).toContain("submitProgress1Score");
    expect(actions).toContain("hasApprovedTeacherCapability(user)");
    expect(actions).toContain('project.status !== "IN_PROGRESS"');
    expect(actions).toContain('["HEAD", "MEMBER"].includes(assignment.role)');
    expect(actions).toContain("assessmentAttempt.upsert");
    expect(actions).toContain("evaluatorAssignment.upsert");
    expect(actions).toContain("scoreSubmission.upsert");
  });

  it("keeps Progress 2 scoring assigned-teacher only and duplicate-safe", () => {
    const actions = read("src/app/teacher/actions.ts");
    const page = read("src/app/teacher/progress2/page.tsx");
    expect(actions).toContain("submitProgress2Score");
    expect(actions).toContain('roundType: "PROGRESS_2"');
    expect(actions).toContain('attemptType: "PROGRESS_2"');
    expect(actions).toContain("validateProgress2Score");
    expect(actions).toContain("assessmentAttempt.upsert");
    expect(actions).toContain("evaluatorAssignment.upsert");
    expect(actions).toContain("scoreSubmission.upsert");
    expect(page).toContain("hasApprovedTeacherCapability(session?.user)");
    expect(page).toContain("Progress 2");
    expect(page).toContain("submitProgress2Score");
  });

  it("keeps Final Presentation scoring assigned-teacher only and duplicate-safe", () => {
    const actions = read("src/app/teacher/actions.ts");
    const page = read("src/app/teacher/final/page.tsx");
    expect(actions).toContain("submitFinalPresentationScore");
    expect(actions).toContain('roundType: "FINAL_PRESENTATION"');
    expect(actions).toContain('attemptType: "FINAL_PRESENTATION"');
    expect(actions).toContain("finalQaRubricItems");
    expect(actions).toContain("calculateFinalQaCriterionScore");
    expect(actions).toContain("assessmentAttempt.upsert");
    expect(actions).toContain("evaluatorAssignment.upsert");
    expect(actions).toContain("scoreSubmission.upsert");
    expect(page).toContain("hasApprovedTeacherCapability(session?.user)");
    expect(page).toContain("Final Presentation");
    expect(page).toContain("submitFinalPresentationScore");
  });

  it("keeps /student robust for missing student/project states", () => {
    const studentPage = read("src/app/student/page.tsx");
    expect(studentPage).toContain("if (!student)");
    expect(studentPage).toContain("if (!project)");
    expect(studentPage).toContain("EmptyState");
    expect(studentPage).toContain("generatedEmail: session.user.email.toLowerCase()");
  });
});
