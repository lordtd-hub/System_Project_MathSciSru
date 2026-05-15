import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("late round policy source coverage", () => {
  it("requires admin acknowledgement before closing Proposal with missing submissions", () => {
    const adminActions = read("src/app/admin/actions.ts");
    expect(adminActions).toContain("getMissingProposalProjects");
    expect(adminActions).toContain("acknowledge_missing_projects");
    expect(adminActions).toContain("round_close_missing_ack_required");
  });

  it("provides audited per-project late round reopening", () => {
    const adminActions = read("src/app/admin/actions.ts");
    expect(adminActions).toContain("openLateRoundSubmissionForProject");
    expect(adminActions).toContain("LATE_ROUND_SUBMISSION_OPENED");
    expect(adminActions).toContain("penaltyPercent");
  });

  it("allows late overrides while preserving the default lock for closed Proposal", () => {
    const studentActions = read("src/app/student/actions.ts");
    expect(studentActions).toContain("hasOpenLateRoundException");
    expect(studentActions).toContain("proposal_round_closed_contact_admin");
    expect(studentActions).toContain("latePenaltyRequired");
  });

  it("lets eligible projects enter an open Progress/Final round normally and requires late override after close", () => {
    const studentActions = read("src/app/student/actions.ts");
    expect(studentActions).toContain("if (!isRoundOpen(round.status) && !hasLateOverride)");
    expect(studentActions).toContain('redirectWithQuery("/student/schedule", { error: "schedule_round_not_open" })');
    expect(studentActions).toContain("await assertPreviousPresentationRoundComplete(project.id, roundType)");
  });

  it("keeps late-open Progress/Final recovery actionable in student and teacher UI", () => {
    const studentSchedule = read("src/app/student/schedule/page.tsx");
    const teacherSchedules = read("src/app/teacher/schedules/page.tsx");
    const teacherActions = read("src/app/teacher/actions.ts");
    expect(studentSchedule).toContain("openLateRoundTypes");
    expect(studentSchedule).toContain("isRoundAvailable");
    expect(teacherSchedules).toContain("isScheduleRoundReviewable");
    expect(teacherSchedules).toContain("hasOpenLateRoundException([exception])");
    expect(teacherActions).toContain("hasLateRoundOverride");
    expect(teacherActions).toContain("schedule_round_not_open");
  });

  it("deducts late-round penalty at scoring submission time", () => {
    const teacherActions = read("src/app/teacher/actions.ts");
    expect(teacherActions).toContain("getLateRoundScoreAdjustment");
    expect(teacherActions).toContain("applyLatePenalty");
    expect(teacherActions).toContain("hasOpenLateRoundException");
    expect(teacherActions).toContain("rawTotalScore");
  });

  it("keeps late Proposal scoring visible after the normal round is closed", () => {
    const teacherDashboard = read("src/app/teacher/page.tsx");
    const teacherProposalList = read("src/app/teacher/proposals/page.tsx");
    const teacherScoringPage = read("src/app/teacher/scoring/[assignmentId]/page.tsx");
    expect(teacherDashboard).toContain("LATE_ROUND_EXCEPTION_TYPE");
    expect(teacherProposalList).toContain("LATE_ROUND_EXCEPTION_TYPE");
    expect(teacherScoringPage).toContain("hasLateRoundOverride");
    expect(teacherScoringPage).toContain("เปิดประเมินย้อนหลังเป็นรายกรณี");
  });
});
