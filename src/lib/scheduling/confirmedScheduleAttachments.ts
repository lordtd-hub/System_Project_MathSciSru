import type { AssessmentSubmissionKind } from "@prisma/client";
import { validateMaterialLink } from "@/lib/validators/materialLink";

export const teacherVisibleScheduleKinds = ["PROGRESS_1", "PROGRESS_2", "FINAL_PRESENT"] as const satisfies AssessmentSubmissionKind[];

export const teacherScheduleAttachmentSelect = {
  kind: true,
  title: true,
  materialLink: true,
  submittedAt: true
} as const;

export function confirmedTeacherScheduleWhere(activeOfferingId: string) {
  return {
    status: "CONFIRMED" as const,
    assessmentKind: { in: [...teacherVisibleScheduleKinds] },
    OR: [
      { courseOfferingId: activeOfferingId },
      { courseOfferingId: null, project: { courseOfferingId: activeOfferingId } }
    ]
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