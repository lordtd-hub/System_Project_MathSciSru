import type { AssessmentStatus, ProjectStatus } from "@prisma/client";
import { isRoundOpen } from "@/lib/assessments/courseRounds";
import { hasOpenLateRoundException } from "@/lib/assessments/roundExceptions";

type RoundException = { exceptionType?: string | null; status: string };

export function isProposalScoreEditable({
  roundStatus,
  hasAdminDecision,
  roundExceptions
}: {
  roundStatus: AssessmentStatus;
  hasAdminDecision: boolean;
  roundExceptions?: RoundException[] | null;
}) {
  return !hasAdminDecision && (roundStatus === "SCORING_OPEN" || hasOpenLateRoundException(roundExceptions));
}

export function isPresentationScoreEditable({
  roundStatus,
  roundExceptions
}: {
  roundStatus: AssessmentStatus;
  roundExceptions?: RoundException[] | null;
}) {
  return isRoundOpen(roundStatus) || hasOpenLateRoundException(roundExceptions);
}

export function isAdvisorScoreEditable(projectStatus: ProjectStatus) {
  return projectStatus === "REPORT_APPROVED" || projectStatus === "ADVISOR_SCORING";
}
