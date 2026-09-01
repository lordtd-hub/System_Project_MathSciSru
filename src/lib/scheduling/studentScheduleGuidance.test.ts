import { describe, expect, it } from "vitest";
import { getStudentScheduleGuidance } from "./studentScheduleGuidance";

const kinds = ["PROGRESS_1", "PROGRESS_2", "FINAL_PRESENT"] as const;

describe("student schedule guided actions", () => {
  it.each(kinds)("routes %s to evidence before scheduling", (kind) => {
    const guidance = getStudentScheduleGuidance({
      kind,
      completed: false,
      actionable: true,
      hasEvidence: false,
      scheduleStatus: "NONE"
    });

    expect(guidance.actionLabel).toBe("1. บันทึกหลักฐานก่อน");
    expect(guidance.href).toMatch(/^#evidence-form-/);
  });

  it.each(kinds)("routes %s to scheduling after evidence exists", (kind) => {
    const guidance = getStudentScheduleGuidance({
      kind,
      completed: false,
      actionable: true,
      hasEvidence: true,
      scheduleStatus: "NONE"
    });

    expect(guidance).toMatchObject({ actionLabel: "2. เสนอวันสอบ", href: "#schedule-proposal-form" });
  });

  it.each(["PROPOSED", "CONFIRMED"] as const)("routes a %s request to its latest status", (scheduleStatus) => {
    const guidance = getStudentScheduleGuidance({
      kind: "PROGRESS_1",
      completed: false,
      actionable: false,
      hasEvidence: true,
      scheduleStatus
    });

    expect(guidance.actionLabel).toBe("ดูสถานะวันสอบ");
    expect(guidance.href).toBe("#schedule-status-progress-1");
  });

  it("renders a blocked round as non-interactive guidance", () => {
    const guidance = getStudentScheduleGuidance({
      kind: "PROGRESS_2",
      completed: false,
      actionable: false,
      hasEvidence: false,
      scheduleStatus: "NONE",
      blockedReason: "รอสอบความก้าวหน้าครั้งที่ 1 เสร็จ"
    });

    expect(guidance).toEqual({
      title: "รอสอบความก้าวหน้าครั้งที่ 1 เสร็จ",
      description: "ขั้นตอนนี้ยังไม่เปิดให้บันทึกหลักฐานหรือเสนอวันสอบ"
    });
  });

  it.each(kinds)("routes completed %s to the matching feedback view", (kind) => {
    const guidance = getStudentScheduleGuidance({
      kind,
      completed: true,
      actionable: false,
      hasEvidence: true,
      scheduleStatus: "CONFIRMED"
    });

    expect(guidance.actionLabel).toBe("ดูข้อเสนอแนะ");
    expect(guidance.href).toContain("/student/feedback?round=");
  });

  it("keeps rejected schedules on step two when evidence already exists", () => {
    expect(getStudentScheduleGuidance({
      kind: "FINAL_PRESENT",
      completed: false,
      actionable: true,
      hasEvidence: true,
      scheduleStatus: "REJECTED"
    })).toMatchObject({ actionLabel: "2. เสนอวันสอบใหม่", href: "#schedule-proposal-form" });
  });
});
