import type { AssessmentRoundType, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export type CompletionCheckInput = {
  currentState: ProjectStatus;
  hasProgress1Score: boolean;
  hasProgress2Score: boolean;
  hasFinalPresentationScore: boolean;
  hasReachedReportApproved: boolean;
  hasAdvisorScore: boolean;
  hasUnresolvedReportRevision: boolean;
};

export type CompletionEligibility = CompletionCheckInput & {
  eligible: boolean;
  missingRequirements: string[];
};

export const completionRequirementLabels = {
  state: "โครงงานต้องอยู่ในขั้นตอนบันทึกคะแนนสรุปของอาจารย์ที่ปรึกษา",
  progress1: "ยังไม่มีคะแนนสอบความก้าวหน้าครั้งที่ 1",
  progress2: "ยังไม่มีคะแนนสอบความก้าวหน้าครั้งที่ 2",
  final: "ยังไม่มีคะแนนสอบนำเสนอขั้นสุดท้าย",
  reportApproved: "ยังไม่พบหลักฐานว่าเล่มรายงานผ่านแล้ว",
  advisorScore: "ยังไม่มีคะแนนสรุปของอาจารย์ที่ปรึกษา 25%",
  reportRevision: "ยังมีคำขอแก้ไขรายงานที่ยังไม่เสร็จสิ้น"
} as const;

export function evaluateCompletionEligibility(input: CompletionCheckInput): CompletionEligibility {
  const missingRequirements: string[] = [];

  if (input.currentState !== "ADVISOR_SCORING") missingRequirements.push(completionRequirementLabels.state);
  if (!input.hasProgress1Score) missingRequirements.push(completionRequirementLabels.progress1);
  if (!input.hasProgress2Score) missingRequirements.push(completionRequirementLabels.progress2);
  if (!input.hasFinalPresentationScore) missingRequirements.push(completionRequirementLabels.final);
  if (!input.hasReachedReportApproved) missingRequirements.push(completionRequirementLabels.reportApproved);
  if (!input.hasAdvisorScore) missingRequirements.push(completionRequirementLabels.advisorScore);
  if (input.hasUnresolvedReportRevision) missingRequirements.push(completionRequirementLabels.reportRevision);

  return {
    ...input,
    eligible: missingRequirements.length === 0,
    missingRequirements
  };
}

function hasSubmittedScoreForRound(
  attempts: Array<{
    officialScore: unknown;
    assessmentRound: { roundType: AssessmentRoundType };
    evaluatorAssignments: Array<{
      scoreSubmission: { status: string } | null;
    }>;
  }>,
  roundType: AssessmentRoundType
) {
  return attempts.some(
    (attempt) =>
      attempt.assessmentRound.roundType === roundType &&
      (attempt.officialScore != null || attempt.evaluatorAssignments.some((assignment) => assignment.scoreSubmission?.status === "SUBMITTED"))
  );
}

export async function getCompletionEligibility(projectId: string): Promise<CompletionEligibility> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      attempts: {
        include: {
          assessmentRound: true,
          evaluatorAssignments: {
            include: { scoreSubmission: true }
          }
        }
      },
      statusHistory: {
        where: { toStatus: "REPORT_APPROVED" },
        select: { id: true }
      },
      reportVersions: {
        orderBy: { versionNo: "desc" },
        take: 1,
        include: { reviews: true }
      },
      advisorScore: true
    }
  });

  const latestReportVersion = project.reportVersions[0];
  const hasUnresolvedReportRevision = latestReportVersion?.reviews.some((review) => review.decision === "FAIL") ?? false;
  const hasReportApprovalEvidence =
    project.status === "REPORT_APPROVED" ||
    project.status === "ADVISOR_SCORING" ||
    project.status === "COMPLETED" ||
    project.statusHistory.length > 0 ||
    Boolean(latestReportVersion?.reviews.some((review) => review.decision === "PASS"));

  return evaluateCompletionEligibility({
    currentState: project.status,
    hasProgress1Score: hasSubmittedScoreForRound(project.attempts, "PROGRESS_1"),
    hasProgress2Score: hasSubmittedScoreForRound(project.attempts, "PROGRESS_2"),
    hasFinalPresentationScore: hasSubmittedScoreForRound(project.attempts, "FINAL_PRESENTATION"),
    hasReachedReportApproved: hasReportApprovalEvidence,
    hasAdvisorScore: project.advisorScore?.status === "SUBMITTED" && project.advisorScore.score != null,
    hasUnresolvedReportRevision
  });
}
