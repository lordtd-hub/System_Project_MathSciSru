import type { AssessmentRoundType, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { roundTypeLabelTh } from "@/lib/assessments/courseRounds";
import { projectStatusLabelTh } from "@/lib/lifecycle/statusLabels";
import type { CsvValue } from "./csv";

type EvidenceAttempt = {
  officialScore: unknown;
  assessmentRound: { roundType: AssessmentRoundType };
  evaluatorAssignments: Array<{
    evaluatorUserId: string;
    scoreSubmission: {
      id: string;
      status: string;
      totalScore: unknown;
      submittedAt: Date | null;
      scoreItems: Array<{ id: string }>;
    } | null;
  }>;
};

type EvidenceProject = {
  id: string;
  currentTitleTh: string | null;
  status: ProjectStatus;
  updatedAt: Date;
  student: { studentCode: string; firstNameTh: string; lastNameTh: string; generatedEmail: string };
  advisorRequests: Array<{ status: string; reviewedAt: Date | null; advisorTeacher: { academicPrefix: string; firstNameTh: string; lastNameTh: string } }>;
  committeeAssignments: Array<{ active: boolean; role: string; teacher: { academicPrefix: string; firstNameTh: string; lastNameTh: string } }>;
  attempts: EvidenceAttempt[];
  reportVersions: Array<{ id: string; versionNo: number; submittedAt: Date; reviews: Array<{ decision: string; reviewedAt: Date }> }>;
  advisorScore: { status: string; score: unknown; submittedAt: Date | null } | null;
  timelineEvents: Array<{ occurredAt: Date }>;
  statusHistory: Array<{ occurredAt: Date }>;
  _count: { timelineEvents: number; statusHistory: number };
};

export type ProjectEvidenceRow = {
  projectId: string;
  studentCode: string;
  studentName: string;
  studentEmail: string;
  projectTitle: string;
  advisorName: string;
  committeeSummary: string;
  status: ProjectStatus;
  statusLabel: string;
  progress1Score: boolean;
  progress2Score: boolean;
  finalScore: boolean;
  reportApproval: boolean;
  advisorScore: boolean;
  completed: boolean;
  missingEvidence: string[];
  timelineEventCount: number;
  statusHistoryCount: number;
  lastEvidenceUpdate: Date | null;
};

export type RubricEvidenceRow = {
  roundType: AssessmentRoundType;
  roundLabel: string;
  rubricName: string;
  rubricItemCount: number;
  scoreSubmissionCount: number;
  scoreItemCount: number;
  evaluatorCount: number;
  averageScore: number | null;
};

export type EvidenceDashboardData = {
  offerings: Array<{ id: string; label: string }>;
  selectedOffering: { id: string; label: string } | null;
  projectRows: ProjectEvidenceRow[];
  rubricRows: RubricEvidenceRow[];
  recentTimelineEvents: Array<{
    id: string;
    projectId: string;
    eventTitle: string;
    eventType: string;
    occurredAt: Date;
    actorName: string;
    projectTitle: string;
    studentCode: string;
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    occurredAt: Date;
    actorName: string;
  }>;
};

function teacherName(teacher?: { academicPrefix: string; firstNameTh: string; lastNameTh: string } | null) {
  if (!teacher) return "ไม่มีข้อมูล";
  return `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}`;
}

function hasSubmittedScoreForRound(attempts: EvidenceAttempt[], roundType: AssessmentRoundType) {
  return attempts.some(
    (attempt) =>
      attempt.assessmentRound.roundType === roundType &&
      (attempt.officialScore != null || attempt.evaluatorAssignments.some((assignment) => assignment.scoreSubmission?.status === "SUBMITTED"))
  );
}

function latestDate(dates: Array<Date | null | undefined>) {
  const timestamps = dates.filter(Boolean).map((date) => date!.getTime());
  if (!timestamps.length) return null;
  return new Date(Math.max(...timestamps));
}

export function buildProjectEvidenceRows(projects: EvidenceProject[]): ProjectEvidenceRow[] {
  return projects.map((project) => {
    const approvedAdvisor = project.advisorRequests.find((request) => request.status === "APPROVED")?.advisorTeacher;
    const activeCommittee = project.committeeAssignments.filter((assignment) => assignment.active);
    const progress1Score = hasSubmittedScoreForRound(project.attempts, "PROGRESS_1");
    const progress2Score = hasSubmittedScoreForRound(project.attempts, "PROGRESS_2");
    const finalScore = hasSubmittedScoreForRound(project.attempts, "FINAL_PRESENTATION");
    const reportApproval =
      ["REPORT_APPROVED", "ADVISOR_SCORING", "COMPLETED"].includes(project.status) ||
      project.reportVersions.some((version) => version.reviews.some((review) => review.decision === "PASS"));
    const advisorScore = project.advisorScore?.status === "SUBMITTED" && project.advisorScore.score != null;
    const completed = project.status === "COMPLETED";
    const missingEvidence = [
      !progress1Score ? "Progress 1 score" : null,
      !progress2Score ? "Progress 2 score" : null,
      !finalScore ? "Final presentation score" : null,
      !reportApproval ? "Report approval" : null,
      !advisorScore ? "Advisor score" : null,
      !completed ? "Admin closeout" : null
    ].filter(Boolean) as string[];

    return {
      projectId: project.id,
      studentCode: project.student.studentCode,
      studentName: `${project.student.firstNameTh} ${project.student.lastNameTh}`,
      studentEmail: project.student.generatedEmail,
      projectTitle: project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ",
      advisorName: teacherName(approvedAdvisor),
      committeeSummary: activeCommittee.length
        ? activeCommittee.map((assignment) => `${assignment.role}: ${teacherName(assignment.teacher)}`).join("; ")
        : "ไม่มีข้อมูล",
      status: project.status,
      statusLabel: projectStatusLabelTh(project.status),
      progress1Score,
      progress2Score,
      finalScore,
      reportApproval,
      advisorScore,
      completed,
      missingEvidence,
      timelineEventCount: project._count.timelineEvents,
      statusHistoryCount: project._count.statusHistory,
      lastEvidenceUpdate: latestDate([
        project.updatedAt,
        ...project.timelineEvents.map((event) => event.occurredAt),
        ...project.statusHistory.map((event) => event.occurredAt),
        ...project.attempts.flatMap((attempt) => attempt.evaluatorAssignments.map((assignment) => assignment.scoreSubmission?.submittedAt)),
        ...project.reportVersions.map((version) => version.submittedAt),
        ...project.reportVersions.flatMap((version) => version.reviews.map((review) => review.reviewedAt)),
        project.advisorScore?.submittedAt
      ])
    };
  });
}

export async function getEvidenceDashboardData(courseOfferingId?: string): Promise<EvidenceDashboardData> {
  const offerings = await prisma.courseOffering.findMany({
    select: { id: true, courseTitle: true, term: { select: { displayName: true } } },
    orderBy: { id: "desc" },
    take: 20
  });
  const selectedOfferingId = courseOfferingId ?? offerings[0]?.id;
  const selectedOffering = offerings.find((offering) => offering.id === selectedOfferingId) ?? offerings[0] ?? null;
  const offeringOptions = offerings.map((offering) => ({ id: offering.id, label: `${offering.term.displayName} · ${offering.courseTitle}` }));
  const selectedLabel = selectedOffering ? `${selectedOffering.term.displayName} · ${selectedOffering.courseTitle}` : null;

  if (!selectedOffering) {
    return {
      offerings: offeringOptions,
      selectedOffering: null,
      projectRows: [],
      rubricRows: [],
      recentTimelineEvents: [],
      recentAuditLogs: []
    };
  }

  const [projects, rubrics, scoreSubmissions, recentTimelineEvents, recentAuditLogs] = await Promise.all([
    prisma.project.findMany({
      where: { courseOfferingId: selectedOffering.id },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        student: true,
        advisorRequests: { include: { advisorTeacher: true }, orderBy: { requestedAt: "desc" } },
        committeeAssignments: { include: { teacher: true } },
        attempts: {
          include: {
            assessmentRound: true,
            evaluatorAssignments: {
              include: { scoreSubmission: { include: { scoreItems: true } } }
            }
          }
        },
        reportVersions: { include: { reviews: true }, orderBy: { versionNo: "desc" } },
        advisorScore: true,
        timelineEvents: { select: { occurredAt: true }, orderBy: { occurredAt: "desc" }, take: 1 },
        statusHistory: { select: { occurredAt: true }, orderBy: { occurredAt: "desc" }, take: 1 },
        _count: { select: { timelineEvents: true, statusHistory: true } }
      }
    }),
    prisma.rubric.findMany({ include: { items: true }, orderBy: [{ roundType: "asc" }, { version: "desc" }] }),
    prisma.scoreSubmission.findMany({
      where: {
        evaluatorAssignment: {
          assessmentAttempt: {
            project: { courseOfferingId: selectedOffering.id }
          }
        }
      },
      include: {
        scoreItems: true,
        evaluatorAssignment: {
          include: {
            assessmentAttempt: { include: { assessmentRound: true } }
          }
        }
      }
    }),
    prisma.projectTimelineEvent.findMany({
      where: { project: { courseOfferingId: selectedOffering.id } },
      orderBy: { occurredAt: "desc" },
      take: 12,
      include: { actor: true, project: { include: { student: true } } }
    }),
    prisma.auditLog.findMany({
      orderBy: { occurredAt: "desc" },
      take: 12,
      include: { actor: true }
    })
  ]);

  const projectRows = buildProjectEvidenceRows(projects);
  const scoreByRound = new Map<AssessmentRoundType, typeof scoreSubmissions>();
  for (const score of scoreSubmissions) {
    const roundType = score.evaluatorAssignment.assessmentAttempt.assessmentRound.roundType;
    scoreByRound.set(roundType, [...(scoreByRound.get(roundType) ?? []), score]);
  }
  const rubricRows = rubrics.map((rubric) => {
    const scores = scoreByRound.get(rubric.roundType) ?? [];
    const submittedScores = scores.filter((score) => score.status === "SUBMITTED");
    const totalScore = submittedScores.reduce((sum, score) => sum + Number(score.totalScore), 0);
    return {
      roundType: rubric.roundType,
      roundLabel: roundTypeLabelTh(rubric.roundType),
      rubricName: `${rubric.name} v${rubric.version}`,
      rubricItemCount: rubric.items.length,
      scoreSubmissionCount: submittedScores.length,
      scoreItemCount: scores.reduce((sum, score) => sum + score.scoreItems.length, 0),
      evaluatorCount: new Set(scores.map((score) => score.evaluatorAssignment.evaluatorUserId)).size,
      averageScore: submittedScores.length ? Math.round((totalScore / submittedScores.length) * 100) / 100 : null
    };
  });

  return {
    offerings: offeringOptions,
    selectedOffering: { id: selectedOffering.id, label: selectedLabel ?? selectedOffering.id },
    projectRows,
    rubricRows,
    recentTimelineEvents: recentTimelineEvents.map((event) => ({
      id: event.id,
      projectId: event.projectId,
      eventTitle: event.eventTitle,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      actorName: event.actor?.name ?? event.actor?.email ?? "ระบบ",
      projectTitle: event.project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ",
      studentCode: event.project.student.studentCode
    })),
    recentAuditLogs: recentAuditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      occurredAt: log.occurredAt,
      actorName: log.actor?.name ?? log.actor?.email ?? "ระบบ"
    }))
  };
}

export const projectEvidenceHeaders = [
  "project_id",
  "student_code",
  "student_name",
  "student_email",
  "project_title",
  "advisor",
  "committee",
  "status",
  "progress1_score",
  "progress2_score",
  "final_score",
  "report_approval",
  "advisor_score",
  "completed",
  "missing_evidence",
  "timeline_event_count",
  "status_history_count",
  "last_evidence_update"
];

export function projectEvidenceCsvRows(rows: ProjectEvidenceRow[]): CsvValue[][] {
  return rows.map((row) => [
    row.projectId,
    row.studentCode,
    row.studentName,
    row.studentEmail,
    row.projectTitle,
    row.advisorName,
    row.committeeSummary,
    row.statusLabel,
    row.progress1Score,
    row.progress2Score,
    row.finalScore,
    row.reportApproval,
    row.advisorScore,
    row.completed,
    row.missingEvidence.join("; "),
    row.timelineEventCount,
    row.statusHistoryCount,
    row.lastEvidenceUpdate
  ]);
}
