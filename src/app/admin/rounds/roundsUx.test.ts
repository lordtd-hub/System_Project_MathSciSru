import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin course round management UX", () => {
  const pageSource = readFileSync(join(process.cwd(), "src/app/admin/rounds/page.tsx"), "utf8");
  const actionSource = readFileSync(join(process.cwd(), "src/app/admin/actions.ts"), "utf8");
  const scheduleSource = readFileSync(join(process.cwd(), "src/app/student/schedule/page.tsx"), "utf8");

  it("adds a course-level round management page with Progress 1 actions", () => {
    expect(pageSource).toContain("รอบสอบของรายวิชา");
    expect(pageSource).toContain("เปิดรอบ");
    expect(pageSource).toContain("ดูโปรเจคที่ยังไม่พร้อม");
    expect(pageSource).toContain("getRoundEligibility(offering.id, \"PROGRESS_1\")");
  });

  it("opens Progress 1 through one course-level upsert", () => {
    expect(actionSource).toContain("openCourseRound");
    expect(actionSource).toContain("courseOfferingId_roundType");
    expect(actionSource).toContain("progress_1_opened");
  });

  it("uses lifecycle sequence gates before opening course rounds", () => {
    expect(pageSource).toContain("getRoundOpenGate");
    expect(pageSource).toContain("roundSequenceReasonLabelTh");
    expect(pageSource).toContain("disabled={!openGate.canOpen}");
    expect(actionSource).toContain("getRoundOpenGate");
    expect(actionSource).toContain("redirect(`/admin/rounds?error=${openGate.reasonKey}`)");
  });

  it("does not create project-level AssessmentRound rows from the open action", () => {
    expect(actionSource).toContain("prisma.assessmentRound.upsert");
    expect(actionSource).not.toContain("projectId_roundType");
    expect(actionSource).not.toContain("assessmentRound.createMany");
  });

  it("gates student Progress 1 scheduling on the course-level round", () => {
    expect(scheduleSource).toContain("รอบ Progress 1 ยังไม่เปิด");
    expect(scheduleSource).toContain("isRoundOpen(progress1Round.status)");
    expect(scheduleSource).toContain("getProgress1Readiness(project)");
  });
});
