import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("dashboard clarity phase 2", () => {
  it("keeps student dashboard task-first without changing lifecycle helpers", () => {
    const page = readFileSync("src/app/student/page.tsx", "utf8");

    expect(page).toContain("getStudentAvailableActions(project.status)");
    expect(page).toContain("StudentWorkflowGroup");
    expect(page).toContain("ทำได้ตอนนี้");
    expect(page).toContain("รอผู้อื่นดำเนินการ");
    expect(page).toContain("ขั้นตอนในอนาคต");
  });

  it("surfaces teacher workload counts from existing query results", () => {
    const page = readFileSync("src/app/teacher/page.tsx", "utf8");

    expect(page).toContain("workloadCards");
    expect(page).toContain("ภาพรวมงานของอาจารย์");
    expect(page).toContain("advisorRequests.length");
    expect(page).toContain("pendingProposalScores.length");
    expect(page).toContain("scheduleApprovals.length");
  });

  it("surfaces admin bottlenecks without new route or query architecture", () => {
    const page = readFileSync("src/app/admin/page.tsx", "utf8");

    expect(page).toContain("adminWorkflowCards");
    expect(page).toContain("ภาพรวมงานปฏิบัติการ");
    expect(page).toContain("รอ Admin ยืนยัน");
    expect(page).toContain("รอตั้งกรรมการ");
    expect(page).toContain("พร้อมตรวจ closeout");
  });
});
