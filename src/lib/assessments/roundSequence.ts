import type { AssessmentStatus } from "@prisma/client";
import { type CourseLevelRoundType, isRoundClosed, isRoundOpen } from "@/lib/assessments/courseRounds";

export type RoundSequenceReasonKey =
  | "round_already_open"
  | "round_already_closed"
  | "proposal_must_close_first"
  | "progress_1_not_ready"
  | "progress_1_must_close_first"
  | "progress_2_must_close_first";

type RoundStatusByType = Partial<Record<CourseLevelRoundType, AssessmentStatus | null | undefined>>;

export function getRoundOpenGate(
  roundType: CourseLevelRoundType,
  statuses: RoundStatusByType,
  options: { progress1EligibleCount?: number } = {}
) {
  const currentStatus = statuses[roundType] ?? "DRAFT";
  if (isRoundOpen(currentStatus)) return { canOpen: false, reasonKey: "round_already_open" as const };
  if (isRoundClosed(currentStatus)) return { canOpen: false, reasonKey: "round_already_closed" as const };

  if (roundType === "PROPOSAL") return { canOpen: true, reasonKey: null };

  if (roundType === "PROGRESS_1") {
    if (!isRoundClosed(statuses.PROPOSAL ?? "DRAFT")) {
      return { canOpen: false, reasonKey: "proposal_must_close_first" as const };
    }
    if ((options.progress1EligibleCount ?? 0) <= 0) {
      return { canOpen: false, reasonKey: "progress_1_not_ready" as const };
    }
    return { canOpen: true, reasonKey: null };
  }

  if (roundType === "PROGRESS_2" && !isRoundClosed(statuses.PROGRESS_1 ?? "DRAFT")) {
    return { canOpen: false, reasonKey: "progress_1_must_close_first" as const };
  }

  if (roundType === "FINAL_PRESENTATION" && !isRoundClosed(statuses.PROGRESS_2 ?? "DRAFT")) {
    return { canOpen: false, reasonKey: "progress_2_must_close_first" as const };
  }

  return { canOpen: true, reasonKey: null };
}

export function roundSequenceReasonLabelTh(reasonKey?: RoundSequenceReasonKey | null) {
  switch (reasonKey) {
    case "round_already_open":
      return "รอบนี้เปิดอยู่แล้ว";
    case "round_already_closed":
      return "รอบนี้ปิดแล้ว หากต้องเปิดใหม่ควรจัดการเป็นกรณีพิเศษ";
    case "proposal_must_close_first":
      return "ต้องเปิดและปิดรอบการเสนอหัวข้อก่อน แล้วจึงเปิดรอบสอบความก้าวหน้าครั้งที่ 1";
    case "progress_1_not_ready":
      return "ยังไม่มีโครงงานที่พร้อมเข้าสู่การสอบความก้าวหน้าครั้งที่ 1";
    case "progress_1_must_close_first":
      return "ต้องเปิดและปิดรอบสอบความก้าวหน้าครั้งที่ 1 ก่อน แล้วจึงเปิดรอบสอบความก้าวหน้าครั้งที่ 2";
    case "progress_2_must_close_first":
      return "ต้องเปิดและปิดรอบสอบความก้าวหน้าครั้งที่ 2 ก่อน แล้วจึงเปิดรอบสอบนำเสนอขั้นสุดท้าย";
    default:
      return "พร้อมเปิดรอบตามลำดับการดำเนินงาน";
  }
}
