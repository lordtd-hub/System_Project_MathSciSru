import { describe, expect, it } from "vitest";
import { formatThaiScheduleRange } from "@/lib/format/dateTime";
import { assessmentKindToRoundType, isSchedulableRoundType, parseScheduleDateTime, roundTypeToAssessmentKind } from "./scheduleRules";

describe("schedule rules", () => {
  it("accepts only Progress/Final schedulable rounds", () => {
    expect(isSchedulableRoundType("PROGRESS_1")).toBe(true);
    expect(isSchedulableRoundType("PROGRESS_2")).toBe(true);
    expect(isSchedulableRoundType("FINAL_PRESENTATION")).toBe(true);
    expect(isSchedulableRoundType("PROPOSAL")).toBe(false);
  });

  it("maps course-level round type to existing assessment kind", () => {
    expect(roundTypeToAssessmentKind("PROGRESS_1")).toBe("PROGRESS_1");
    expect(roundTypeToAssessmentKind("FINAL_PRESENTATION")).toBe("FINAL_PRESENT");
    expect(assessmentKindToRoundType("FINAL_PRESENT")).toBe("FINAL_PRESENTATION");
  });

  it("validates schedule date and time input", () => {
    const parsed = parseScheduleDateTime("2026-05-06", "09:00", "10:00");
    expect(parsed.start.toISOString()).toContain("2026-05-06");
    expect(parsed.end?.getTime()).toBeGreaterThan(parsed.start.getTime());
    expect(() => parseScheduleDateTime("2026-05-06", "10:00", "09:00")).toThrow("เวลาสิ้นสุด");
    expect(() => parseScheduleDateTime("", "10:00")).toThrow("กรุณาระบุวันที่");
  });
  it("treats schedule form input as Bangkok civil time", () => {
    const parsed = parseScheduleDateTime("2026-05-22", "09:00", "10:00");

    expect(parsed.start.toISOString()).toBe("2026-05-22T02:00:00.000Z");
    expect(parsed.end?.toISOString()).toBe("2026-05-22T03:00:00.000Z");
    expect(formatThaiScheduleRange(parsed.start, parsed.end)).toContain("09:00 - 10:00");
  });
});
