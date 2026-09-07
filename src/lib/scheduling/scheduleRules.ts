import type { AssessmentRoundType, AssessmentSubmissionKind } from "@prisma/client";

export const schedulableRoundTypes = ["PROGRESS_1", "PROGRESS_2", "FINAL_PRESENTATION"] as const satisfies AssessmentRoundType[];

export type SchedulableRoundType = (typeof schedulableRoundTypes)[number];

export function isSchedulableRoundType(value: string): value is SchedulableRoundType {
  return schedulableRoundTypes.includes(value as SchedulableRoundType);
}

export function roundTypeToAssessmentKind(roundType: SchedulableRoundType): AssessmentSubmissionKind {
  return roundType === "FINAL_PRESENTATION" ? "FINAL_PRESENT" : roundType;
}

export function assessmentKindToRoundType(kind: AssessmentSubmissionKind): SchedulableRoundType {
  return kind === "FINAL_PRESENT" ? "FINAL_PRESENTATION" : kind;
}

export function parseScheduleDateTime(dateValue: string, timeValue: string, endTimeValue?: string) {
  if (!dateValue || !timeValue) throw new Error("กรุณาระบุวันที่และเวลาเริ่มสอบ");
  const normalizedDate = normalizeScheduleDateValue(dateValue);
  const start = parseBangkokCivilDateTime(normalizedDate, timeValue);
  if (Number.isNaN(start.getTime())) throw new Error("วันที่หรือเวลาเริ่มสอบไม่ถูกต้อง");

  let end: Date | null = null;
  if (endTimeValue) {
    end = parseBangkokCivilDateTime(normalizedDate, endTimeValue);
    if (Number.isNaN(end.getTime())) throw new Error("เวลาสิ้นสุดไม่ถูกต้อง");
    if (end <= start) throw new Error("เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มสอบ");
  }

  return { start, end };
}

export function normalizeScheduleDateValue(dateValue: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) throw new Error("วันที่สอบไม่ถูกต้อง");

  const inputYear = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const year = inputYear >= 2400 && inputYear <= 2699 ? inputYear - 543 : inputYear;

  if (year < 2000 || year > 2100) {
    throw new Error("ปีของวันสอบไม่ถูกต้อง กรุณาเลือกปี พ.ศ. 25xx หรือ ค.ศ. 20xx");
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) {
    throw new Error("วันที่สอบไม่ถูกต้อง");
  }

  return `${String(year).padStart(4, "0")}-${match[2]}-${match[3]}`;
}

function parseBangkokCivilDateTime(dateValue: string, timeValue: string) {
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !timeMatch) {
    return new Date(Number.NaN);
  }
  if (Number(timeMatch[1]) > 23 || Number(timeMatch[2]) > 59) {
    return new Date(Number.NaN);
  }

  return new Date(`${dateValue}T${timeValue}:00+07:00`);
}
