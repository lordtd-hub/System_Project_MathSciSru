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
  const start = new Date(`${dateValue}T${timeValue}:00`);
  if (Number.isNaN(start.getTime())) throw new Error("วันที่หรือเวลาเริ่มสอบไม่ถูกต้อง");

  let end: Date | null = null;
  if (endTimeValue) {
    end = new Date(`${dateValue}T${endTimeValue}:00`);
    if (Number.isNaN(end.getTime())) throw new Error("เวลาสิ้นสุดไม่ถูกต้อง");
    if (end <= start) throw new Error("เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มสอบ");
  }

  return { start, end };
}
