import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("report workflow actions", () => {
  it("student report submission moves FINAL_DONE projects to REPORT_REVIEW and keeps version history", () => {
    const source = read("src/app/student/actions.ts");
    expect(source).toContain("submitReportVersion");
    expect(source).toContain('project.status === "FINAL_DONE"');
    expect(source).toContain('data: { status: "REPORT_REVIEW" }');
    expect(source).toContain("reportVersion.create");
    expect(source).toContain("_max: { versionNo: true }");
    expect(source).toContain('eventType: "REPORT_VERSION_SUBMITTED"');
  });

  it("teacher report review is approved-teacher only and updates existing reviews", () => {
    const source = read("src/app/teacher/actions.ts");
    expect(source).toContain("reviewReportVersion");
    expect(source).toContain('user.role !== "TEACHER"');
    expect(source).toContain("isAssignedReportReviewer");
    expect(source).toContain("reportReview.upsert");
    expect(source).toContain("latestReportVersionHasRevisionRequest");
    expect(source).toContain('data: { status: "REPORT_APPROVED" }');
    expect(source).toContain('toStatus: "REPORT_APPROVED"');
  });

  it("report loop stops before advisor scoring and completion", () => {
    const studentActions = read("src/app/student/actions.ts");
    const teacherActions = read("src/app/teacher/actions.ts");
    const reviewStart = teacherActions.indexOf("export async function reviewReportVersion");
    const advisorStart = teacherActions.indexOf("export async function submitAdvisorScore");
    const reportReviewAction = teacherActions.slice(reviewStart, advisorStart);
    expect(studentActions).not.toContain("ADVISOR_SCORING");
    expect(studentActions).not.toContain('toStatus: "COMPLETED"');
    expect(reportReviewAction).not.toContain("ADVISOR_SCORING");
    expect(reportReviewAction).not.toContain('toStatus: "COMPLETED"');
  });
});
