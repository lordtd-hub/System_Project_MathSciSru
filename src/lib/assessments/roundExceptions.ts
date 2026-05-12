import type { AssessmentRoundType } from "@prisma/client";

export const LATE_ROUND_EXCEPTION_TYPE = "LATE_ASSESSMENT_ROUND";
export const LATE_ROUND_EXCUSED_EXCEPTION_TYPE = "EXCUSED_LATE_ASSESSMENT_ROUND";
export const DEFAULT_LATE_ROUND_PENALTY_PERCENT = 10;

export const lateRoundPenaltyNotice =
  `กรณีนี้เป็นการส่ง/สอบไม่ตรงรอบ ระบบต้องหักคะแนน ${DEFAULT_LATE_ROUND_PENALTY_PERCENT}% จากคะแนนที่กรรมการประเมินในรอบนั้น เว้นแต่ผู้ดูแลระบบระบุว่าเป็นเหตุสุดวิสัย`;

export function roundExceptionLabel(roundType: AssessmentRoundType) {
  if (roundType === "PROPOSAL") return "Proposal";
  if (roundType === "PROGRESS_1") return "ความก้าวหน้าครั้งที่ 1";
  if (roundType === "PROGRESS_2") return "ความก้าวหน้าครั้งที่ 2";
  if (roundType === "FINAL_PRESENTATION") return "สอบนำเสนอขั้นสุดท้าย";
  return roundType;
}

export function hasOpenLateProposalException(
  exceptions?: Array<{ exceptionType: string; status: string }> | null
) {
  return hasOpenLateRoundException(exceptions);
}

export function hasOpenLateRoundException(
  exceptions?: Array<{ exceptionType: string; status: string }> | null
) {
  return Boolean(
    exceptions?.some(
      (exception) =>
        (exception.exceptionType === LATE_ROUND_EXCEPTION_TYPE ||
          exception.exceptionType === LATE_ROUND_EXCUSED_EXCEPTION_TYPE) &&
        exception.status === "OPEN"
    )
  );
}

export function requiresLateRoundPenalty(
  exceptions?: Array<{ exceptionType: string; status: string }> | null
) {
  return Boolean(
    exceptions?.some(
      (exception) =>
        exception.exceptionType === LATE_ROUND_EXCEPTION_TYPE &&
        exception.status === "OPEN"
    )
  );
}

export function applyLatePenalty(score: number, penaltyPercent = DEFAULT_LATE_ROUND_PENALTY_PERCENT) {
  return Number((score * (1 - penaltyPercent / 100)).toFixed(2));
}
