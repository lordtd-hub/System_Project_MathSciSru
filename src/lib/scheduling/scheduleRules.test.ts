import { describe, expect, it } from "vitest";
import { formatThaiScheduleRange } from "@/lib/format/dateTime";
import {
  assessmentKindToRoundType,
  isSchedulableRoundType,
  normalizeScheduleDateValue,
  parseScheduleDateTime,
  roundTypeToAssessmentKind
} from "./scheduleRules";

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

  it("normalizes a Buddhist Era year submitted by localized browsers", () => {
    expect(normalizeScheduleDateValue("2569-09-10")).toBe("2026-09-10");

    const parsed = parseScheduleDateTime("2569-09-10", "09:00", "10:00");
    expect(parsed.start.toISOString()).toBe("2026-09-10T02:00:00.000Z");
    expect(formatThaiScheduleRange(parsed.start, parsed.end)).toContain("2569");
    expect(formatThaiScheduleRange(parsed.start, parsed.end)).not.toContain("3112");
  });

  it("keeps Gregorian years unchanged and validates real calendar dates", () => {
    expect(normalizeScheduleDateValue("2026-09-10")).toBe("2026-09-10");
    expect(normalizeScheduleDateValue("2567-02-29")).toBe("2024-02-29");
    expect(() => normalizeScheduleDateValue("2569-02-29")).toThrow("วันที่สอบไม่ถูกต้อง");
    expect(() => normalizeScheduleDateValue("3112-09-10")).toThrow("ปีของวันสอบไม่ถูกต้อง");
    expect(() => parseScheduleDateTime("2026-09-10", "24:00")).toThrow("วันที่หรือเวลาเริ่มสอบไม่ถูกต้อง");
  });
});
