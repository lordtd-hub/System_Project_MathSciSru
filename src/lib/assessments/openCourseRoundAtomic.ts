import type { PrismaClient } from "@prisma/client";
import {
  courseLevelRoundTypes,
  defaultCourseRoundName,
  defaultCourseRoundWeight,
  isRoundClosed,
  isRoundOpen,
  type CourseLevelRoundType
} from "@/lib/assessments/courseRounds";
import { getRoundEligibility } from "@/lib/assessments/roundEligibility";
import { getRoundOpenGate, roundSequenceReasonLabelTh } from "@/lib/assessments/roundSequence";
import { AdminRoundConflictError, AdminRoundValidationError } from "@/lib/assessments/adminRoundActionResult";

type MutationDb = Pick<PrismaClient, "$transaction">;

export type OpenCourseRoundInput = {
  actorUserId: string;
  requestId: string;
  courseOfferingId: string;
  roundType: CourseLevelRoundType;
  openMode: "NORMAL" | "SCHEDULED_ZERO_READY";
  reason: string | null;
};

export type OpenCourseRoundHooks = {
  fault?: (point: "round_opened" | "audit_created") => void | Promise<void>;
  now?: () => Date;
};

export type OpenCourseRoundOutcome = {
  roundId: string;
  eligibleProjectCount: number;
  scheduledZeroReady: boolean;
  unchanged: boolean;
};

export async function openCourseRoundAtomic(
  db: MutationDb,
  input: OpenCourseRoundInput,
  hooks: OpenCourseRoundHooks = {}
): Promise<OpenCourseRoundOutcome> {
  if (!courseLevelRoundTypes.includes(input.roundType)) {
    throw new AdminRoundValidationError("ROUND_TYPE_INVALID", "รอบสอบไม่ถูกต้อง", ["round_type"]);
  }
  if (!input.courseOfferingId) {
    throw new AdminRoundValidationError("COURSE_OFFERING_REQUIRED", "ไม่พบรายวิชาที่ต้องการเปิดรอบ", ["course_offering_id"]);
  }
  if (input.reason && input.reason.length > 500) {
    throw new AdminRoundValidationError("OVERRIDE_REASON_TOO_LONG", "เหตุผลต้องไม่เกิน 500 ตัวอักษร", ["override_reason"]);
  }
  if (input.openMode === "SCHEDULED_ZERO_READY" && input.roundType !== "PROGRESS_1") {
    throw new AdminRoundValidationError("OVERRIDE_ROUND_INVALID", "การเปิดรอบตามกำหนดการใช้ได้เฉพาะการสอบความก้าวหน้าครั้งที่ 1", ["round_type"]);
  }

  const now = hooks.now?.() ?? new Date();
  return db.$transaction(async (tx) => {
    const lockedOfferings = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "course_offerings" WHERE "id" = ${input.courseOfferingId} FOR UPDATE
    `;
    if (!lockedOfferings.length) {
      throw new AdminRoundConflictError("COURSE_OFFERING_NOT_FOUND", "ไม่พบรายวิชาล่าสุด กรุณารีเฟรชหน้าแล้วลองใหม่");
    }

    const existingRounds = await tx.assessmentRound.findMany({
      where: { courseOfferingId: input.courseOfferingId, roundType: { in: [...courseLevelRoundTypes] } },
      select: { id: true, roundType: true, status: true }
    });
    const currentRound = existingRounds.find((round) => round.roundType === input.roundType);
    if (currentRound && isRoundOpen(currentRound.status)) {
      return {
        roundId: currentRound.id,
        eligibleProjectCount: 0,
        scheduledZeroReady: input.openMode === "SCHEDULED_ZERO_READY",
        unchanged: true
      };
    }
    if (currentRound && isRoundClosed(currentRound.status)) {
      throw new AdminRoundConflictError("ROUND_ALREADY_CLOSED", "รอบนี้ปิดแล้ว หากต้องเปิดใหม่ควรจัดการเป็นกรณีพิเศษ");
    }

    const roundStatuses = Object.fromEntries(existingRounds.map((round) => [round.roundType, round.status]));
    const progress1Eligibility = input.roundType === "PROGRESS_1"
      ? await getRoundEligibility(input.courseOfferingId, "PROGRESS_1", tx)
      : null;
    const eligibleProjectCount = progress1Eligibility?.eligible.length ?? 0;
    const scheduledZeroReady = input.openMode === "SCHEDULED_ZERO_READY";

    if (scheduledZeroReady && eligibleProjectCount > 0) {
      throw new AdminRoundConflictError(
        "ZERO_READY_OVERRIDE_STALE",
        "ขณะนี้มีโครงงานพร้อมแล้ว กรุณารีเฟรชหน้าและใช้ปุ่มเปิดรอบปกติ"
      );
    }
    if (scheduledZeroReady && !input.reason) {
      throw new AdminRoundValidationError("OVERRIDE_REASON_REQUIRED", "กรุณาระบุเหตุผลการเปิดรอบตามกำหนดการ", ["override_reason"]);
    }

    const openGate = getRoundOpenGate(input.roundType, roundStatuses, {
      progress1EligibleCount: eligibleProjectCount,
      allowZeroReadyProgress1: scheduledZeroReady
    });
    if (!openGate.canOpen) {
      throw new AdminRoundConflictError(
        `ROUND_OPEN_BLOCKED_${openGate.reasonKey ?? "UNKNOWN"}`,
        roundSequenceReasonLabelTh(openGate.reasonKey)
      );
    }

    const round = await tx.assessmentRound.upsert({
      where: { courseOfferingId_roundType: { courseOfferingId: input.courseOfferingId, roundType: input.roundType } },
      update: {
        name: defaultCourseRoundName(input.roundType),
        status: input.roundType === "PROPOSAL" ? "SCORING_OPEN" : "SUBMISSION_OPEN",
        submissionOpenAt: now,
        closedAt: null,
        closedByAdminId: null,
        courseWeight: defaultCourseRoundWeight(input.roundType),
        rawScoreMax: 100,
        showScoreToStudent: false,
        showFeedbackToStudent: false,
        showEvaluatorNameToStudent: false
      },
      create: {
        courseOfferingId: input.courseOfferingId,
        roundType: input.roundType,
        name: defaultCourseRoundName(input.roundType),
        status: input.roundType === "PROPOSAL" ? "SCORING_OPEN" : "SUBMISSION_OPEN",
        submissionOpenAt: now,
        courseWeight: defaultCourseRoundWeight(input.roundType),
        rawScoreMax: 100,
        showScoreToStudent: false,
        showFeedbackToStudent: false,
        showEvaluatorNameToStudent: false
      }
    });
    await hooks.fault?.("round_opened");

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "ASSESSMENT_ROUND_OPENED",
        entityType: "AssessmentRound",
        entityId: round.id,
        afterJson: {
          status: round.status,
          submissionOpenAt: round.submissionOpenAt,
          closedAt: round.closedAt,
          closedByAdminId: round.closedByAdminId
        },
        metadataJson: {
          roundType: input.roundType,
          courseOfferingId: input.courseOfferingId,
          eligibleProjectCount,
          scheduledZeroReady,
          reason: scheduledZeroReady ? input.reason : null,
          requestId: input.requestId
        }
      }
    });
    await hooks.fault?.("audit_created");

    return {
      roundId: round.id,
      eligibleProjectCount,
      scheduledZeroReady,
      unchanged: false
    };
  });
}
