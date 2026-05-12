import type { AssessmentRoundType, CommitteeRole, Decision, ProjectStatus, ScoreStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isPresentationAssessmentComplete } from "./presentationCompletion";

export type RoundEligibilityProject = {
  id: string;
  status: ProjectStatus;
  student?: { studentCode: string; firstNameTh: string; lastNameTh: string };
  currentTitleTh?: string | null;
  proposalResults?: Array<{ finalDecision: Decision }>;
  committeeAssignments?: Array<{ role: CommitteeRole; active: boolean; teacherId?: string | null }>;
  roundExceptions?: Array<{ status: string; reason: string }>;
  assessmentSubmissions?: Array<{ kind: "PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENT" }>;
  attempts?: Array<{
    status: string;
    finalDecision?: Decision | null;
    assessmentRound?: { roundType: AssessmentRoundType };
    presentationSubmission?: { status: string } | null;
    evaluatorAssignments: Array<{
      teacherId?: string | null;
      scoreSubmission?: { status: ScoreStatus } | null;
    }>;
  }>;
};

export type ProjectReadiness = {
  project: RoundEligibilityProject;
  eligible: boolean;
  reasons: string[];
};

export type RoundEligibilityBuckets = {
  eligible: ProjectReadiness[];
  notReady: ProjectReadiness[];
  submitted: ProjectReadiness[];
  completed: ProjectReadiness[];
  eligibleButIncomplete: ProjectReadiness[];
};

function hasCommittee(project: RoundEligibilityProject, role: CommitteeRole) {
  return project.committeeAssignments?.some((assignment) => assignment.active && assignment.role === role) ?? false;
}

export function getProgress1Readiness(project: RoundEligibilityProject): ProjectReadiness {
  const reasons: string[] = [];
  const finalDecision = project.proposalResults?.[0]?.finalDecision;
  const hasBlockingException = project.roundExceptions?.some((exception) => exception.status !== "RESOLVED") ?? false;

  if (["DRAFT", "STUDENT_PROFILE"].includes(project.status)) reasons.push("project in DRAFT");
  if (project.status === "PENDING_ADVISOR") reasons.push("project still PENDING_ADVISOR");
  if (project.status === "PENDING_ADMIN") reasons.push("project still PENDING_ADMIN");
  if (!finalDecision && ["PROPOSAL_REVIEW", "PROPOSAL_ADMIN_DECISION", "PROPOSAL_PENDING"].includes(project.status)) reasons.push("waiting proposal final decision");
  if (finalDecision && finalDecision !== "PASS") reasons.push("proposal failed/revise");
  if (!hasCommittee(project, "ADVISOR")) reasons.push("committee not assigned");
  if (!hasCommittee(project, "HEAD")) reasons.push("missing HEAD");
  if (!hasCommittee(project, "MEMBER")) reasons.push("missing MEMBER");
  if (hasBlockingException) reasons.push(project.roundExceptions?.find((exception) => exception.status !== "RESOLVED")?.reason ?? "project has blocking exception");

  const eligible = ["TOPIC_APPROVED", "IN_PROGRESS"].includes(project.status) && finalDecision === "PASS" && reasons.length === 0;
  return { project, eligible, reasons };
}

function assessmentKindForRound(roundType: AssessmentRoundType) {
  if (roundType === "PROGRESS_1") return "PROGRESS_1" as const;
  if (roundType === "PROGRESS_2") return "PROGRESS_2" as const;
  if (roundType === "FINAL_PRESENTATION") return "FINAL_PRESENT" as const;
  return null;
}

export function hasCompletedPresentationRound(
  project: RoundEligibilityProject,
  roundType: Extract<AssessmentRoundType, "PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENTATION">
) {
  return project.attempts?.some((attempt) =>
    attempt.assessmentRound?.roundType === roundType &&
    isPresentationAssessmentComplete({
      roundStatus: attempt.status as Parameters<typeof isPresentationAssessmentComplete>[0]["roundStatus"],
      committeeAssignments: (project.committeeAssignments ?? []).map((assignment) => ({
        ...assignment,
        teacherId: assignment.teacherId ?? null
      })),
      scoreSubmissions: attempt.evaluatorAssignments.map((assignment) => ({
        teacherId: assignment.teacherId ?? null,
        status: assignment.scoreSubmission?.status ?? null
      }))
    })
  ) ?? false;
}

export function hasSubmittedRoundEvidence(project: RoundEligibilityProject, roundType: AssessmentRoundType) {
  if (roundType === "PROPOSAL") {
    return project.attempts?.some((attempt) =>
      attempt.assessmentRound?.roundType === "PROPOSAL" &&
      ["SUBMITTED", "LOCKED"].includes(attempt.presentationSubmission?.status ?? "")
    ) ?? false;
  }

  const kind = assessmentKindForRound(roundType);
  return Boolean(kind && project.assessmentSubmissions?.some((submission) => submission.kind === kind));
}

export function hasCompletedCurrentRound(project: RoundEligibilityProject, roundType: AssessmentRoundType) {
  if (roundType === "PROPOSAL") return Boolean(project.proposalResults?.[0]?.finalDecision);
  if (roundType === "PROGRESS_1" || roundType === "PROGRESS_2" || roundType === "FINAL_PRESENTATION") {
    return hasCompletedPresentationRound(project, roundType);
  }
  return false;
}

export function getRoundReadiness(project: RoundEligibilityProject, roundType: AssessmentRoundType): ProjectReadiness {
  if (roundType === "PROPOSAL") return { project, eligible: true, reasons: [] };
  if (roundType === "PROGRESS_1") return getProgress1Readiness(project);

  const previousRoundType = roundType === "PROGRESS_2" ? "PROGRESS_1" : "PROGRESS_2";
  const previousReadiness = roundType === "PROGRESS_2" ? getProgress1Readiness(project) : getRoundReadiness(project, "PROGRESS_2");
  const reasons = [...previousReadiness.reasons];

  if (!previousReadiness.eligible) {
    reasons.push(roundType === "PROGRESS_2" ? "previous proposal gate not passed" : "previous progress 1 gate not passed");
  } else if (!hasCompletedPresentationRound(project, previousRoundType)) {
    reasons.push(roundType === "PROGRESS_2" ? "progress 1 assessment incomplete" : "progress 2 assessment incomplete");
  }

  return { project, eligible: reasons.length === 0, reasons };
}

export function buildRoundEligibilityBuckets(projects: RoundEligibilityProject[], roundType: AssessmentRoundType): RoundEligibilityBuckets {
  const readiness = projects.map((project) => getRoundReadiness(project, roundType));
  const eligible = readiness.filter((item) => item.eligible);
  const notReady = readiness.filter((item) => !item.eligible);
  const submitted = eligible.filter((item) => hasSubmittedRoundEvidence(item.project, roundType));
  const completed = eligible.filter((item) => hasCompletedCurrentRound(item.project, roundType));
  const completedProjectIds = new Set(completed.map((item) => item.project.id));

  return {
    eligible,
    notReady,
    submitted,
    completed,
    eligibleButIncomplete: eligible.filter((item) => !completedProjectIds.has(item.project.id))
  };
}

export function reasonLabelTh(reason: string) {
  switch (reason) {
    case "waiting proposal final decision":
      return "ยังมีโครงงานที่ยังไม่ได้ตัดสินผลการเสนอหัวข้อ";
    case "proposal failed/revise":
      return "ยังไม่ผ่านการเสนอหัวข้อ";
    case "committee not assigned":
      return "ยังไม่ได้แต่งตั้งกรรมการ";
    case "missing HEAD":
      return "ยังไม่ได้แต่งตั้งประธานกรรมการ";
    case "missing MEMBER":
      return "ยังไม่ได้แต่งตั้งกรรมการ";
    case "project still PENDING_ADVISOR":
      return "ยังรออาจารย์ที่ปรึกษาอนุมัติ";
    case "project still PENDING_ADMIN":
      return "ยังรอผู้ดูแลระบบยืนยัน";
    case "project in DRAFT":
      return "โครงงานยังอยู่ในขั้นร่างหัวข้อ";
    case "previous proposal gate not passed":
      return "ยังไม่ผ่านเกณฑ์จากการเสนอหัวข้อ";
    case "previous progress 1 gate not passed":
      return "ยังไม่ผ่านเกณฑ์จากการสอบความก้าวหน้าครั้งที่ 1";
    case "progress 1 assessment incomplete":
      return "ยังประเมินการสอบความก้าวหน้าครั้งที่ 1 ไม่ครบ";
    case "progress 2 assessment incomplete":
      return "ยังประเมินการสอบความก้าวหน้าครั้งที่ 2 ไม่ครบ";
    default:
      return reason;
  }
}

export async function getRoundEligibility(courseOfferingId: string, roundType: AssessmentRoundType) {
  const projects = await prisma.project.findMany({
    where: { courseOfferingId },
    select: {
      id: true,
      status: true,
      currentTitleTh: true,
      student: { select: { studentCode: true, firstNameTh: true, lastNameTh: true } },
      proposalResults: { select: { finalDecision: true }, orderBy: { decidedAt: "desc" }, take: 1 },
      committeeAssignments: { select: { role: true, active: true, teacherId: true } },
      assessmentSubmissions: { select: { kind: true } },
      attempts: {
        where: { assessmentRound: { roundType: { in: ["PROPOSAL", "PROGRESS_1", "PROGRESS_2", "FINAL_PRESENTATION"] } } },
        select: {
          status: true,
          finalDecision: true,
          assessmentRound: { select: { roundType: true } },
          presentationSubmission: { select: { status: true } },
          evaluatorAssignments: {
            select: {
              teacherId: true,
              scoreSubmission: { select: { status: true } }
            }
          }
        }
      },
      roundExceptions: {
        where: { assessmentRound: { roundType } },
        select: { status: true, reason: true },
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  return buildRoundEligibilityBuckets(projects, roundType);
}
