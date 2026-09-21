import type { AssessmentStatus, AssessmentSubmissionKind } from "@prisma/client";
import { isRoundOpen } from "@/lib/assessments/courseRounds";
import { validateMaterialLink } from "@/lib/validators/materialLink";

export const teacherVisibleScheduleKinds = ["PROGRESS_1", "PROGRESS_2", "FINAL_PRESENT"] as const satisfies AssessmentSubmissionKind[];

export const teacherScheduleAttachmentSelect = {
  kind: true,
  title: true,
  materialLink: true,
  submittedAt: true
} as const;

export type TeacherScheduleDisplayState = "UPCOMING" | "HISTORY";

export function teacherScheduleDisplayState({
  proposedStartAt,
  proposedEndAt,
  roundStatus,
  now = new Date()
}: {
  proposedStartAt: Date;
  proposedEndAt?: Date | null;
  roundStatus?: AssessmentStatus | null;
  now?: Date;
}): TeacherScheduleDisplayState {
  if (roundStatus && !isRoundOpen(roundStatus)) return "HISTORY";
  const effectiveEndAt = proposedEndAt ?? proposedStartAt;
  return effectiveEndAt.getTime() < now.getTime() ? "HISTORY" : "UPCOMING";
}

export function teacherScheduleOfferingWhere(activeOfferingId: string) {
  return {
    OR: [
      { courseOfferingId: activeOfferingId },
      { courseOfferingId: null, project: { courseOfferingId: activeOfferingId } }
    ]
  };
}

export function confirmedTeacherScheduleWhere(activeOfferingId: string) {
  return {
    status: "CONFIRMED" as const,
    assessmentKind: { in: [...teacherVisibleScheduleKinds] },
    ...teacherScheduleOfferingWhere(activeOfferingId)
  };
}

type AssessmentAttachment = {
  kind: AssessmentSubmissionKind;
  title: string | null;
  materialLink: string;
  submittedAt: Date;
};

export function latestAllowedAssessmentAttachment(
  assessmentKind: AssessmentSubmissionKind,
  submissions: AssessmentAttachment[]
) {
  let latest: AssessmentAttachment | null = null;

  for (const submission of submissions) {
    if (submission.kind !== assessmentKind || !validateMaterialLink(submission.materialLink).ok) continue;
    if (!latest || submission.submittedAt.getTime() > latest.submittedAt.getTime()) latest = submission;
  }

  return latest;
}
