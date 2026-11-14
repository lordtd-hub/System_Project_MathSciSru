import type { AssessmentRoundType, Prisma, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isSubmittedScoreStatus } from "@/lib/scoring/scoreSubmissionStatus";
import { allRequiredReportReviewersPassed, requiredReportReviewerIds } from "@/lib/reports/reportWorkflow";
import { readExternalEvidence } from "@/lib/terms/incompleteExternalEvidence";
import { workflowDigest } from "@/lib/terms/workflowDigest";
import { advisorCriteria, totalAdvisorScore, validateAdvisorScore, type AdvisorScoreInput } from "@/lib/scoring/advisorScoring";

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
  workflowVersion?: string;
  closedIncomplete?: boolean;
  externalEvidenceId?: string | null;
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

export function evaluateCompletionEligibility(input: CompletionCheckInput, options: { allowVerifiedExternalState?: boolean } = {}): CompletionEligibility {
  const missingRequirements: string[] = [];

  if (input.currentState !== "ADVISOR_SCORING" && !options.allowVerifiedExternalState) missingRequirements.push(completionRequirementLabels.state);
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
      (attempt.officialScore != null || attempt.evaluatorAssignments.some((assignment) => isSubmittedScoreStatus(assignment.scoreSubmission?.status)))
  );
}

type Reader = Pick<Prisma.TransactionClient, "project" | "auditLog">;
export async function getCompletionEligibilityFromDb(db: Reader, projectId: string, options: { allowCompleted?: boolean } = {}): Promise<CompletionEligibility> {
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      academicResult: true,
      courseOffering: { include: { term: true } },
      committeeAssignments: { orderBy: { id: "asc" } },
      advisorRequests: { orderBy: { id: "asc" } },
      attempts: {
        orderBy: [{ attemptNo: "desc" }, { id: "asc" }],
        include: {
          assessmentRound: true,
          evaluatorAssignments: {
            orderBy: { id: "asc" },
            include: { scoreSubmission: { include: { scoreItems: { orderBy: { id: "asc" } } } } }
          }
        }
      },
      statusHistory: {
        where: { toStatus: "REPORT_APPROVED" },
        select: { id: true }
      },
      reportVersions: {
        orderBy: { versionNo: "desc" },
        include: { reviews: { orderBy: { id: "asc" } } }
      },
      advisorScore: true
    }
  });

  const closedIncomplete = project.courseOffering.status === "CLOSED" && project.academicResult?.status === "INCOMPLETE";
  const external = closedIncomplete ? await readExternalEvidence(db, project) : null;

  const latestReportVersion = project.reportVersions[0];
  const hasUnresolvedReportRevision = !external?.valid && (latestReportVersion?.reviews.some((review) => review.decision === "FAIL") ?? false);
  const hasReportApprovalEvidence = closedIncomplete
    ? external?.valid || !!latestReportVersion && allRequiredReportReviewersPassed({ requiredReviewerIds: requiredReportReviewerIds(project.committeeAssignments, project.advisorRequests), reviews: latestReportVersion.reviews })
    :
    project.status === "REPORT_APPROVED" ||
    project.status === "ADVISOR_SCORING" ||
    project.status === "COMPLETED" ||
    project.statusHistory.length > 0 ||
    Boolean(latestReportVersion?.reviews.some((review) => review.decision === "PASS"));

  const strictRoundComplete = (roundType: AssessmentRoundType) => {
    const committee = project.committeeAssignments.filter(a => a.active && ["HEAD", "MEMBER"].includes(a.role));
    if (!committee.some(a => a.role === "HEAD") || !committee.some(a => a.role === "MEMBER") || new Set(committee.map(a => a.teacherId)).size < 2) return false;
    const attempt = project.attempts.find(a => a.assessmentRound.roundType === roundType);
    return committee.every(a => attempt?.evaluatorAssignments.some(e => e.teacherId === a.teacherId
      && isSubmittedScoreStatus(e.scoreSubmission?.status) && e.scoreSubmission?.totalScore != null
      && Number.isFinite(Number(e.scoreSubmission.totalScore)) && Number(e.scoreSubmission.totalScore) >= 0 && Number(e.scoreSubmission.totalScore) <= 100));
  };
  const advisor = project.advisorScore;
  const advisorMarks = advisor ? { responsibility: advisor.responsibilityScore, researchProcess: advisor.researchProcessScore,
    problemSolving: advisor.problemSolvingScore, communication: advisor.communicationScore, professionalism: advisor.professionalismScore } : null;
  const actualAdvisor = !!advisor && (project.committeeAssignments.some(a => a.active && a.role === "ADVISOR" && a.teacherId === advisor.advisorTeacherId)
    || project.advisorRequests.some(a => a.status === "APPROVED" && a.advisorTeacherId === advisor.advisorTeacherId));
  const strictAdvisor = actualAdvisor && advisor?.status === "SUBMITTED" && advisor.score != null && advisorMarks
    && advisorCriteria.every(c => advisorMarks[c.key] !== null) && validateAdvisorScore(advisorMarks as AdvisorScoreInput).length === 0
    && Number(advisor.score) === totalAdvisorScore(advisorMarks as AdvisorScoreInput);
  const scoreIds = project.attempts.flatMap(a => a.evaluatorAssignments.flatMap(e => e.scoreSubmission ? [e.scoreSubmission.id] : []));
  const auditVersions = await db.auditLog.findMany({ where: { OR: [
    { entityType: "ScoreSubmission", entityId: { in: scoreIds } }, ...(advisor ? [{ entityType: "AdvisorScore", entityId: advisor.id }] : [])
  ] }, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], distinct: ["entityType", "entityId"], select: { id: true, entityType: true, entityId: true } });
  const allowedExternalState = closedIncomplete && ["IN_PROGRESS", "FINAL_DONE", "REPORT_REVIEW", "REPORT_APPROVED", "ADVISOR_SCORING"].includes(project.status);
  const evaluated = evaluateCompletionEligibility({
    currentState: project.status,
    hasProgress1Score: closedIncomplete ? strictRoundComplete("PROGRESS_1") : hasSubmittedScoreForRound(project.attempts, "PROGRESS_1"),
    hasProgress2Score: closedIncomplete ? strictRoundComplete("PROGRESS_2") : hasSubmittedScoreForRound(project.attempts, "PROGRESS_2"),
    hasFinalPresentationScore: closedIncomplete ? strictRoundComplete("FINAL_PRESENTATION") : hasSubmittedScoreForRound(project.attempts, "FINAL_PRESENTATION"),
    hasReachedReportApproved: !!hasReportApprovalEvidence,
    hasAdvisorScore: closedIncomplete ? !!strictAdvisor : project.advisorScore?.status === "SUBMITTED" && project.advisorScore.score != null,
    hasUnresolvedReportRevision
  }, { allowVerifiedExternalState: allowedExternalState || !!options.allowCompleted && project.status === "COMPLETED" });
  return { ...evaluated, closedIncomplete, externalEvidenceId: external?.valid ? external.latest!.id : null,
    workflowVersion: workflowDigest({ project, externalEvidenceId: external?.latest?.id ?? null, externalValid: external?.valid ?? false, auditVersions }) };
}
export async function getCompletionEligibility(projectId: string): Promise<CompletionEligibility> {
  return getCompletionEligibilityFromDb(prisma, projectId);
}
