import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(join(process.cwd(), "src/app/teacher/page.tsx"), "utf8");

describe("teacher dashboard source", () => {
  it("derives report and schedule counters from teacher-scoped actionable work", () => {
    const page = source();

    expect(page).not.toContain('prisma.reportReview.count({ where: { reviewerTeacherId: teacherId, decision: "FAIL" } })');
    expect(page).toContain('status: "REPORT_REVIEW"');
    expect(page).toContain("reportVersions");
    expect(page).toContain('review.decision === "FAIL"');
    expect(page).toContain("review.reviewerTeacherId === teacherId");
    expect(page).toContain("teacherProjectInvolvementWhere");
    expect(page).toContain('status: "CONFIRMED"');
  });

  it("keeps teacher notifications and proposal links reviewer-specific", () => {
    const page = source();

    expect(page).toContain("teacherActionableTaskCount");
    expect(page).toContain("มีงานที่ต้องดำเนินการ");
    expect(page).toContain("การแจ้งเตือน");
    expect(page).toContain("assignmentSubmitted");
    expect(page).toContain("ดูผลประเมินที่ส่งแล้ว");
    expect(page).toContain("pendingProposalScores.length");
  });
});
