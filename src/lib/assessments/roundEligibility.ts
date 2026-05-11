import type { AssessmentRoundType, CommitteeRole, Decision, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export type RoundEligibilityProject = {
  id: string;
  status: ProjectStatus;
  student?: { studentCode: string; firstNameTh: string; lastNameTh: string };
  currentTitleTh?: string | null;
  proposalResults?: Array<{ finalDecision: Decision }>;
  committeeAssignments?: Array<{ role: CommitteeRole; active: boolean }>;
  roundExceptions?: Array<{ status: string; reason: string }>;
};

export type ProjectReadiness = {
  project: RoundEligibilityProject;
  eligible: boolean;
  reasons: string[];
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
      committeeAssignments: { select: { role: true, active: true } },
      roundExceptions: {
        where: { assessmentRound: { roundType } },
        select: { status: true, reason: true },
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  const readiness = roundType === "PROGRESS_1"
    ? projects.map((project) => getProgress1Readiness(project))
    : projects.map((project) => ({ project, eligible: false, reasons: ["ยังไม่เปิดใช้ flow นี้"] }));

  return {
    eligible: readiness.filter((item) => item.eligible),
    notReady: readiness.filter((item) => !item.eligible)
  };
}
