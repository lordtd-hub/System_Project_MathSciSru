import type { AssessmentRoundType, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { roundTypeLabelTh } from "@/lib/assessments/courseRounds";
import { projectStatusLabelTh } from "@/lib/lifecycle/statusLabels";
import type { CsvValue } from "./csv";

type EvidenceAttempt = {
  officialScore: unknown;
  assessmentRound: { roundType: AssessmentRoundType };
  evaluatorAssignments: Array<{
    scoreSubmission: {
      status: string;
      submittedAt: Date | null;
    } | null;
  }>;
};

type EvidenceProject = {
  id: string;
  currentTitleTh: string | null;
  status: ProjectStatus;
  updatedAt: Date;
  student: { studentCode: string; firstNameTh: string; lastNameTh: string; generatedEmail: string };
  advisorRequests: Array<{ status: string; advisorTeacher: { academicPrefix: string; firstNameTh: string; lastNameTh: string } }>;
  committeeAssignments: Array<{ active: boolean; role: string; teacher: { academicPrefix: string; firstNameTh: string; lastNameTh: string } }>;
  attempts: EvidenceAttempt[];
  reportVersions: Array<{ submittedAt: Date; reviews: Array<{ decision: string; reviewedAt: Date }> }>;
  advisorScore: { status: string; score: unknown; submittedAt: Date | null } | null;
  timelineEvents: Array<{ occurredAt: Date }>;
  statusHistory: Array<{ occurredAt: Date }>;
  _count: { timelineEvents: number; statusHistory: number };
};

type EvidenceRubric = {
  id: string;
  roundType: AssessmentRoundType;
  name: string;
  version: number;
  items: Array<{ id: string }>;
};

type EvidenceScoreSubmission = {
  status: string;
  totalScore: unknown;
  scoreItems: Array<{ rubricItem: { rubricId: string } }>;
  evaluatorAssignment: {
    evaluatorUserId: string;
    assessmentAttempt: { assessmentRound: { roundType: AssessmentRoundType } };
  };
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
  invalidCourseOfferingId: string | null;
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
      !progress1Score ? "Progress 1 score evidence" : null,
      !progress2Score ? "Progress 2 score evidence" : null,
      !finalScore ? "Final presentation score evidence" : null,
      !reportApproval ? "Report approval evidence" : null,
      !advisorScore ? "Advisor score evidence" : null,
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

export function buildRubricEvidenceRows(rubrics: EvidenceRubric[], scoreSubmissions: EvidenceScoreSubmission[]): RubricEvidenceRow[] {
  const scoreByRound = new Map<AssessmentRoundType, EvidenceScoreSubmission[]>();
  for (const score of scoreSubmissions) {
    const roundType = score.evaluatorAssignment.assessmentAttempt.assessmentRound.roundType;
    scoreByRound.set(roundType, [...(scoreByRound.get(roundType) ?? []), score]);
  }

  return rubrics.map((rubric) => {
    const roundScores = scoreByRound.get(rubric.roundType) ?? [];
    const scores = roundScores.filter((score) => score.scoreItems.some((item) => item.rubricItem.rubricId === rubric.id));
    const submittedScores = scores.filter((score) => score.status === "SUBMITTED");
    const totalScore = submittedScores.reduce((sum, score) => sum + Number(score.totalScore), 0);
    const scoreItemCount = scores.reduce(
      (sum, score) => sum + score.scoreItems.filter((item) => item.rubricItem.rubricId === rubric.id).length,
      0
    );

    return {
      roundType: rubric.roundType,
      roundLabel: roundTypeLabelTh(rubric.roundType),
      rubricName: `${rubric.name} v${rubric.version}`,
      rubricItemCount: rubric.items.length,
      scoreSubmissionCount: submittedScores.length,
      scoreItemCount,
      evaluatorCount: new Set(scores.map((score) => score.evaluatorAssignment.evaluatorUserId)).size,
      averageScore: submittedScores.length ? Math.round((totalScore / submittedScores.length) * 100) / 100 : null
    };
  });
}

export async function getEvidenceDashboardData(courseOfferingId?: string): Promise<EvidenceDashboardData> {
  const offerings = await prisma.courseOffering.findMany({
    select: { id: true, courseTitle: true, term: { select: { displayName: true } } },
    orderBy: { id: "desc" },
    take: 20
  });
  const requestedOffering = courseOfferingId
    ? await prisma.courseOffering.findUnique({
        where: { id: courseOfferingId },
        select: { id: true, courseTitle: true, term: { select: { displayName: true } } }
      })
    : null;
  const selectedOffering = courseOfferingId ? requestedOffering : offerings[0] ?? null;
  const optionSource = requestedOffering && !offerings.some((offering) => offering.id === requestedOffering.id)
    ? [requestedOffering, ...offerings]
    : offerings;
  const offeringOptions = optionSource.map((offering) => ({ id: offering.id, label: `${offering.term.displayName} · ${offering.courseTitle}` }));
  const selectedLabel = selectedOffering ? `${selectedOffering.term.displayName} · ${selectedOffering.courseTitle}` : null;

  if (!selectedOffering) {
    return {
      offerings: offeringOptions,
      selectedOffering: null,
      invalidCourseOfferingId: courseOfferingId ?? null,
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
      select: {
        id: true,
        currentTitleTh: true,
        status: true,
        updatedAt: true,
        student: {
          select: {
            studentCode: true,
            firstNameTh: true,
            lastNameTh: true,
            generatedEmail: true
          }
        },
        advisorRequests: {
          select: {
            status: true,
            advisorTeacher: {
              select: {
                academicPrefix: true,
                firstNameTh: true,
                lastNameTh: true
              }
            }
          },
          orderBy: { requestedAt: "desc" }
        },
        committeeAssignments: {
          select: {
            active: true,
            role: true,
            teacher: {
              select: {
                academicPrefix: true,
                firstNameTh: true,
                lastNameTh: true
              }
            }
          }
        },
        attempts: {
          select: {
            officialScore: true,
            assessmentRound: { select: { roundType: true } },
            evaluatorAssignments: {
              select: {
                scoreSubmission: {
                  select: {
                    status: true,
                    submittedAt: true
                  }
                }
              }
            }
          }
        },
        reportVersions: {
          select: {
            submittedAt: true,
            reviews: {
              select: {
                decision: true,
                reviewedAt: true
              }
            }
          },
          orderBy: { versionNo: "desc" }
        },
        advisorScore: {
          select: {
            status: true,
            score: true,
            submittedAt: true
          }
        },
        timelineEvents: { select: { occurredAt: true }, orderBy: { occurredAt: "desc" }, take: 1 },
        statusHistory: { select: { occurredAt: true }, orderBy: { occurredAt: "desc" }, take: 1 },
        _count: { select: { timelineEvents: true, statusHistory: true } }
      }
    }),
    prisma.rubric.findMany({
      select: {
        id: true,
        roundType: true,
        name: true,
        version: true,
        items: { select: { id: true } }
      },
      orderBy: [{ roundType: "asc" }, { version: "desc" }]
    }),
    prisma.scoreSubmission.findMany({
      where: {
        evaluatorAssignment: {
          assessmentAttempt: {
            project: { courseOfferingId: selectedOffering.id }
          }
        }
      },
      select: {
        status: true,
        totalScore: true,
        scoreItems: {
          select: { rubricItem: { select: { rubricId: true } } }
        },
        evaluatorAssignment: {
          select: {
            evaluatorUserId: true,
            assessmentAttempt: {
              select: {
                assessmentRound: { select: { roundType: true } }
              }
            }
          }
        }
      }
    }),
    prisma.projectTimelineEvent.findMany({
      where: { project: { courseOfferingId: selectedOffering.id } },
      orderBy: { occurredAt: "desc" },
      take: 12,
      select: {
        id: true,
        projectId: true,
        eventTitle: true,
        eventType: true,
        occurredAt: true,
        actor: { select: { name: true, email: true } },
        project: {
          select: {
            currentTitleTh: true,
            student: { select: { studentCode: true } }
          }
        }
      }
    }),
    prisma.auditLog.findMany({
      orderBy: { occurredAt: "desc" },
      take: 12,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        occurredAt: true,
        actor: { select: { name: true, email: true } }
      }
    })
  ]);

  const projectRows = buildProjectEvidenceRows(projects);
  const rubricRows = buildRubricEvidenceRows(rubrics, scoreSubmissions);

  return {
    offerings: offeringOptions,
    selectedOffering: { id: selectedOffering.id, label: selectedLabel ?? selectedOffering.id },
    invalidCourseOfferingId: null,
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
  "progress1_score_evidence",
  "progress2_score_evidence",
  "final_score_evidence",
  "report_approval_evidence",
  "advisor_score_evidence",
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
