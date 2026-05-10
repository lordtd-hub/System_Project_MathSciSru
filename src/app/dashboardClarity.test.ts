import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("dashboard clarity phase 2", () => {
  it("keeps student dashboard task-first without changing lifecycle helpers", () => {
    const page = readFileSync("src/app/student/page.tsx", "utf8");

    expect(page).toContain("getStudentAvailableActions(project.status, assessmentStates)");
    expect(page).toContain("StudentWorkflowGroup");
    expect(page).toContain("visibleAssessmentResults");
    expect(page).toContain("showScoreToStudent");
    expect(page).toContain("Assessment results");
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
    expect(page).toContain("pendingProposalScores.length");
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
    expect(page).toContain("รอ Admin ยืนยัน");
    expect(page).toContain("รอตั้งกรรมการ");
    expect(page).toContain("พร้อมตรวจ closeout");
  });
});
