import type { AssessmentRoundType, AssessmentStatus } from "@prisma/client";

export const courseLevelRoundTypes = ["PROPOSAL", "PROGRESS_1", "PROGRESS_2", "FINAL_PRESENTATION"] as const satisfies AssessmentRoundType[];

export type CourseLevelRoundType = (typeof courseLevelRoundTypes)[number];

export function roundTypeLabelTh(roundType: AssessmentRoundType) {
  switch (roundType) {
    case "PROPOSAL":
      return "การเสนอหัวข้อ";
    case "PROGRESS_1":
      return "การสอบความก้าวหน้าครั้งที่ 1";
    case "PROGRESS_2":
      return "การสอบความก้าวหน้าครั้งที่ 2";
    case "FINAL_PRESENTATION":
      return "การสอบนำเสนอขั้นสุดท้าย";
    case "REPROPOSAL":
      return "การเสนอหัวข้อใหม่";
    default:
      return roundType;
  }
}

export function defaultCourseRoundName(roundType: AssessmentRoundType) {
  return roundTypeLabelTh(roundType);
}

export function defaultCourseRoundWeight(roundType: AssessmentRoundType) {
  return roundType === "REPROPOSAL" ? 0 : 10;
}

export function roundStatusLabelTh(status: AssessmentStatus) {
  switch (status) {
    case "DRAFT":
      return "ยังไม่เปิด";
    case "SUBMISSION_OPEN":
    case "SCORING_OPEN":
      return "เปิดอยู่";
    case "SUBMISSION_CLOSED":
    case "SCORING_CLOSED":
      return "ปิดแล้ว";
    case "RELEASED":
      return "เผยแพร่ผลแล้ว";
    default:
      return status;
  }
}

export function isRoundOpen(status: AssessmentStatus) {
  return status === "SUBMISSION_OPEN" || status === "SCORING_OPEN";
}

export function isRoundClosed(status: AssessmentStatus) {
  return status === "SUBMISSION_CLOSED" || status === "SCORING_CLOSED" || status === "RELEASED";
}
