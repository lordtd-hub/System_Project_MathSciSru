import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("dashboard clarity phase 2", () => {
  it("keeps student dashboard task-first without changing lifecycle helpers", () => {
    const page = readFileSync("src/app/student/page.tsx", "utf8");

    expect(page).toContain("getStudentAvailableActions(project.status, assessmentStates, reportStatus, studentWorkflowContext)");
    expect(page).toContain("StudentWorkflowGroup");
    expect(page).toContain("visibleAssessmentResults");
    expect(page).toContain("showScoreToStudent");
    expect(page).toContain("สถานะกรรมการ วันสอบ และผลประเมิน");
    expect(page).not.toContain("Assessment results");
    expect(page).not.toContain("Assessment & Committee Status");
    expect(page).toContain("workflowActions.available_now");
    expect(page).toContain("workflowActions.blocked_waiting_for");
    expect(page).toContain("workflowActions.locked_future");
  });

  it("surfaces teacher workload counts from existing query results", () => {
    const page = readFileSync("src/app/teacher/page.tsx", "utf8");

    expect(page).toContain("DashboardActionQueue");
    expect(page).toContain("teacherActionQueue");
    expect(page).toContain("workloadCards");
    expect(page).toContain("งานที่ต้องดำเนินการ");
    expect(page).toContain("ภาพรวมสถานะ");
    expect(page).toContain("advisorRequestCount");
    expect(page).toContain("pendingProposalScoreCount");
    expect(page).toContain("prisma.assessmentAttempt.count");
    expect(page).toContain("pendingProposalScoringAttemptWhere(evaluatorUserId)");
    expect(page).toContain("scheduleApprovalCount");
    expect(page).toContain("progress1ScoreReadyCount");
    expect(page).toContain("progress2ScoreReadyCount");
    expect(page).toContain("finalScoreReadyCount");
    expect(page).toContain("พร้อมให้คะแนน");
  });

  it("surfaces admin bottlenecks without new route or query architecture", () => {
    const page = readFileSync("src/app/admin/page.tsx", "utf8");

    expect(page).toContain("DashboardActionQueue");
    expect(page).toContain("adminActionQueue");
    expect(page).toContain("adminWorkflowCards");
    expect(page).toContain("งานที่ต้องดำเนินการ");
    expect(page).toContain("ภาพรวมสถานะ");
    expect(page).toContain("รอผู้ดูแลระบบยืนยัน");
    expect(page).toContain("รอตั้งกรรมการ");
    expect(page).toContain("เตรียมตรวจรายงานและยืนยันจบโครงงาน");
  });
});
