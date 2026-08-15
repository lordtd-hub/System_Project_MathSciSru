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
    expect(pageSource).toContain("ดูสรุปกลุ่มที่ยังไม่พร้อม");
    expect(pageSource).toContain("courseLevelRoundTypes.map(async (roundType)");
    expect(pageSource).toContain("getRoundEligibility(offering.id, roundType)");
  });

  it("opens Progress 1 through one course-level upsert", () => {
    expect(actionSource).toContain("openCourseRound");
    expect(actionSource).toContain("openCourseRoundAtomic");
    expect(actionSource).toContain("AdminRoundActionResult");
  });

  it("uses lifecycle sequence gates before opening course rounds", () => {
    expect(pageSource).toContain("getRoundOpenGate");
    expect(pageSource).toContain("roundSequenceReasonLabelTh");
    expect(pageSource).toContain("AdminRoundActionForm");
    expect(pageSource).toContain("openGate.canOpen");
    expect(actionSource).toContain("runAdminRoundAction");
  });

  it("offers the audited Progress 1 zero-ready opening only with a reason and confirmation", () => {
    expect(pageSource).toContain("canScheduledZeroReadyOpen");
    expect(pageSource).toContain('name="open_mode" value="SCHEDULED_ZERO_READY"');
    expect(pageSource).toContain('name="override_reason"');
    expect(pageSource).toContain("maxLength={500}");
    expect(pageSource).toContain("โครงงานที่ยังไม่พร้อมจะยังส่งหลักฐานหรือนัดสอบไม่ได้");
  });

  it("checks active rubric versions instead of only version 1", () => {
    expect(pageSource).toContain("active: true");
    expect(pageSource).toContain('orderBy: [{ roundType: "asc" }, { version: "desc" }]');
    expect(pageSource).not.toContain("version: 1");
  });

  it("offers a safe reset only through the guarded course round reset action", () => {
    expect(pageSource).toContain("resetCourseRound");
    expect(pageSource).toContain("getCourseRoundResetState");
    expect(pageSource).toContain("รีเซตรอบ");
    expect(actionSource).toContain("resetCourseRound");
    expect(actionSource).toContain("round_reset_blocked");
    expect(actionSource).toContain("ASSESSMENT_ROUND_RESET");
    expect(actionSource).toContain("scheduleProposals");
  });

  it("does not create project-level AssessmentRound rows from the open action", () => {
    expect(actionSource).not.toContain("projectId_roundType");
    expect(actionSource).not.toContain("assessmentRound.createMany");
  });

  it("gates student Progress 1 scheduling on the course-level round", () => {
    expect(scheduleSource).toContain("รอบสอบความก้าวหน้าครั้งที่ 1 ยังไม่เปิด");
    expect(scheduleSource).toContain("isRoundAvailable(\"PROGRESS_1\")");
    expect(scheduleSource).toContain("hasOpenLateRoundException");
    expect(scheduleSource).toContain("getProgress1Readiness(project)");
  });
  it("counts Progress and Final submissions from assessment evidence instead of Proposal submissions", () => {
    expect(pageSource).toContain("roundEligibilityByType");
    expect(pageSource).toContain("eligibility.submitted.length");
    expect(pageSource).toContain("eligibility.completed.length");
    expect(pageSource).toContain("พร้อมเข้าสู่รอบนี้");
    expect(pageSource).toContain("ยังไม่พร้อมรอบนี้");
  });

  it("requires close acknowledgement only for eligible but incomplete non-Proposal projects", () => {
    expect(pageSource).toContain("eligibility.eligibleButIncomplete.length");
    expect(pageSource).toContain("requireIncompleteCloseAck");
    expect(pageSource).toContain("isRoundOpen(round.status)");
    expect(pageSource).toContain("acknowledge_incomplete_projects");
    expect(pageSource).toContain("ยืนยันก่อนปิดรอบ");
    expect(pageSource).toContain("โครงงานที่ยังไม่ผ่านรอบก่อนหน้าจะแยกอยู่ในกลุ่ม");
    expect(actionSource).toContain("eligibleButIncomplete");
    expect(actionSource).toContain("round_close_incomplete_ack_required");
  });

  it("uses the same warning pattern for close blockers and closed-round late management", () => {
    expect(pageSource).toContain('<WarningAlert title="จัดการผู้ส่งย้อนหลัง / นักศึกษาที่พลาดรอบ">');
    expect(pageSource).toContain("requireProposalCloseAck");
    expect(pageSource).toContain("requiresCloseAck ? \"basis-full space-y-2\" : \"\"");
  });

  it("warns about grade I risk when closing Final with eligible incomplete projects", () => {
    expect(pageSource).toContain("นักศึกษาอาจได้รับเกรด I");
    expect(actionSource).toContain("round_close_final_incomplete_ack_required");
  });

  it("summarizes not-ready projects by reason instead of rendering a long project list", () => {
    expect(pageSource).toContain("readinessReasonGroups");
    expect(pageSource).toContain("readinessReasonGroup");
    expect(pageSource).toContain("readinessActionForReason");
    expect(pageSource).toContain("ใช้ส่วนนี้เพื่อดูภาพรวมว่าโครงงานที่ยังไม่พร้อมติดเงื่อนไขใด");
    expect(pageSource).toContain("ยังไม่ได้แต่งตั้งกรรมการครบ");
    expect(pageSource).toContain("และรายการอื่นอีก");
    expect(pageSource).not.toContain("progress1Eligibility.notReady.map((item)");
  });
});
