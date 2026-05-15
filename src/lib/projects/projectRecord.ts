import type { AssessmentRoundType, CommitteeRole, ProjectStatus } from "@prisma/client";
import type { Session } from "next-auth";
import { prisma } from "@/lib/db";
import { projectStatusLabelTh } from "@/lib/lifecycle/statusLabels";
import { teacherDisplayName } from "@/lib/teachers/displayName";

type Viewer = Session["user"] | null | undefined;

export type ProjectRecordViewerRole = "ADMIN" | "STUDENT" | "TEACHER";

type ProjectRecordAccessProject = {
  student: { generatedEmail: string };
  advisorRequests: { advisorTeacherId: string }[];
  committeeAssignments: { teacherId: string; active: boolean }[];
  scheduleProposals: { approvals: { teacherId: string }[] }[];
  attempts: { evaluatorAssignments: { teacherId: string | null }[] }[];
  reportVersions: { reviews: { reviewerTeacherId: string }[] }[];
  advisorScore: { advisorTeacherId: string } | null;
};

export type ProjectRecordAccessDecision =
  | { allowed: true; viewerRole: ProjectRecordViewerRole }
  | { allowed: false };

export function canViewProjectRecord(project: ProjectRecordAccessProject, viewer: Viewer): ProjectRecordAccessDecision {
  if (!viewer) return { allowed: false };
  const email = viewer.email?.toLowerCase() ?? "";
  const roles = new Set([viewer.role, ...(viewer.roles ?? [])].filter(Boolean));

  if (roles.has("ADMIN")) {
    return { allowed: true, viewerRole: "ADMIN" };
  }

  if (roles.has("STUDENT") && email && project.student.generatedEmail.toLowerCase() === email) {
    return { allowed: true, viewerRole: "STUDENT" };
  }

  const teacherId = viewer.teacherId ?? null;
  if (!roles.has("TEACHER") || !teacherId) {
    return { allowed: false };
  }

  const teacherRelated =
    project.advisorRequests.some((request) => request.advisorTeacherId === teacherId) ||
    project.committeeAssignments.some((assignment) => assignment.active && assignment.teacherId === teacherId) ||
    project.scheduleProposals.some((schedule) => schedule.approvals.some((approval) => approval.teacherId === teacherId)) ||
    project.attempts.some((attempt) => attempt.evaluatorAssignments.some((assignment) => assignment.teacherId === teacherId)) ||
    project.reportVersions.some((report) => report.reviews.some((review) => review.reviewerTeacherId === teacherId)) ||
    project.advisorScore?.advisorTeacherId === teacherId;

  return teacherRelated ? { allowed: true, viewerRole: "TEACHER" } : { allowed: false };
}

export type ProjectRecordActionLink = {
  label: string;
  href: string;
};

export type ProjectRecordDto = {
  viewerRole: ProjectRecordViewerRole;
  summary: {
    id: string;
    titleTh: string;
    titleEn: string | null;
    status: ProjectStatus;
    statusLabel: string;
    createdAt: Date;
    updatedAt: Date;
  };
  student: {
    id: string;
    studentCode: string;
    name: string;
    email: string;
  };
  courseOffering: {
    id: string;
    courseTitle: string;
    termDisplayName: string;
  };
  advisorRequests: {
    id: string;
    status: string;
    advisorName: string;
    requestedAt: Date;
    reviewedAt: Date | null;
  }[];
  committee: {
    id: string;
    teacherName: string;
    role: CommitteeRole;
    active: boolean;
  }[];
  origin: {
    titleTh: string;
    titleEn: string | null;
    status: string;
    submittedAt: Date | null;
    tentativeAdvisorName: string | null;
    materialLink: string | null;
    versionCount: number;
  } | null;
  schedules: {
    id: string;
    roundType: AssessmentRoundType | null;
    assessmentKind: string;
    status: string;
    proposedStartAt: Date;
    proposedEndAt: Date | null;
    room: string | null;
    approvals: { teacherName: string; decision: string; decidedAt: Date | null }[];
  }[];
  assessmentAttempts: {
    id: string;
    roundType: AssessmentRoundType;
    attemptNo: number;
    status: string;
    isOfficialScore: boolean;
    officialScore: string | null;
    finalDecision: string | null;
    requiredReviewers: number;
    submittedReviewers: number;
    canShowStudentScore: boolean;
  }[];
  reports: {
    id: string;
    versionNo: number;
    submittedAt: Date;
    driveLink: string;
    reviews: { reviewerName: string; decision: string; reviewedAt: Date }[];
  }[];
  advisorScore: {
    status: string;
    score: string | null;
    submittedAt: Date | null;
    advisorName: string;
  } | null;
  exceptions: {
    id: string;
    roundType: AssessmentRoundType;
    exceptionType: string;
    status: string;
    reason: string;
    createdAt: Date;
  }[];
  timeline: {
    id: string;
    title: string;
    description: string | null;
    occurredAt: Date;
    actorName: string | null;
  }[];
  actionLinks: ProjectRecordActionLink[];
};

export type ProjectRecordResult =
  | { status: "OK"; record: ProjectRecordDto }
  | { status: "NOT_FOUND" }
  | { status: "UNAUTHORIZED" };

function decimalToString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toString" in value && typeof value.toString === "function") {
    return value.toString();
  }
  return null;
}

function buildActionLinks(viewerRole: ProjectRecordViewerRole): ProjectRecordActionLink[] {
  if (viewerRole === "STUDENT") {
    return [
      { label: "ข้อมูลโครงงาน", href: "/student/project" },
      { label: "ส่งเอกสารเสนอหัวข้อ", href: "/student/proposal" },
      { label: "รอบสอบ", href: "/student/schedule" },
      { label: "รายงาน", href: "/student/report" },
      { label: "ผลและข้อเสนอแนะ", href: "/student/feedback" }
    ];
  }
  if (viewerRole === "TEACHER") {
    return [
      { label: "ตารางสอบ", href: "/teacher/schedules" },
      { label: "ประเมิน Proposal", href: "/teacher/proposals" },
      { label: "Progress 1", href: "/teacher/progress1" },
      { label: "Progress 2", href: "/teacher/progress2" },
      { label: "Final", href: "/teacher/final" },
      { label: "ตรวจรายงาน", href: "/teacher/reports" },
      { label: "คะแนนที่ปรึกษา", href: "/teacher/advisor-score" }
    ];
  }
  return [
    { label: "รอบประเมิน", href: "/admin/rounds" },
    { label: "Proposal", href: "/admin/proposals" },
    { label: "ตารางสอบ", href: "/admin/schedules" },
    { label: "รายงาน", href: "/admin/reports" },
    { label: "ปิดโครงงาน", href: "/admin/closeout" },
    { label: "หลักฐาน/ส่งออก", href: "/admin/evidence" }
  ];
}

export async function getProjectRecordForViewer(projectId: string, viewer: Viewer): Promise<ProjectRecordResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      currentTitleTh: true,
      currentTitleEn: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      student: {
        select: {
          id: true,
          studentCode: true,
          firstNameTh: true,
          lastNameTh: true,
          generatedEmail: true
        }
      },
      courseOffering: {
        select: {
          id: true,
          courseTitle: true,
          term: { select: { displayName: true } }
        }
      },
      origin: {
        select: {
          initialProjectTitleTh: true,
          initialProjectTitleEn: true,
          status: true,
          submittedAt: true,
          materialLink: true,
          tentativeAdvisor: { select: { academicPrefix: true, firstNameTh: true, lastNameTh: true } },
          versions: { select: { id: true } }
        }
      },
      advisorRequests: {
        select: {
          id: true,
          advisorTeacherId: true,
          status: true,
          requestedAt: true,
          reviewedAt: true,
          advisorTeacher: { select: { academicPrefix: true, firstNameTh: true, lastNameTh: true } }
        },
        orderBy: { requestedAt: "desc" }
      },
      committeeAssignments: {
        select: {
          id: true,
          teacherId: true,
          role: true,
          active: true,
          teacher: { select: { academicPrefix: true, firstNameTh: true, lastNameTh: true } }
        },
        orderBy: { appointedAt: "asc" }
      },
      scheduleProposals: {
        select: {
          id: true,
          roundType: true,
          assessmentKind: true,
          status: true,
          proposedStartAt: true,
          proposedEndAt: true,
          room: true,
          approvals: {
            select: {
              teacherId: true,
              decision: true,
              decidedAt: true,
              teacher: { select: { academicPrefix: true, firstNameTh: true, lastNameTh: true } }
            },
            orderBy: { teacherId: "asc" }
          }
        },
        orderBy: { createdAt: "desc" }
      },
      attempts: {
        select: {
          id: true,
          attemptNo: true,
          status: true,
          isOfficialScore: true,
          officialScore: true,
          finalDecision: true,
          assessmentRound: {
            select: {
              roundType: true,
              showScoreToStudent: true
            }
          },
          evaluatorAssignments: {
            select: {
              teacherId: true,
              isRequired: true,
              scoreSubmission: { select: { status: true } }
            }
          }
        },
        orderBy: [{ assessmentRoundId: "asc" }, { attemptNo: "asc" }]
      },
      reportVersions: {
        select: {
          id: true,
          versionNo: true,
          driveLink: true,
          submittedAt: true,
          reviews: {
            select: {
              reviewerTeacherId: true,
              decision: true,
              reviewedAt: true,
              reviewerTeacher: { select: { academicPrefix: true, firstNameTh: true, lastNameTh: true } }
            },
            orderBy: { reviewedAt: "desc" }
          }
        },
        orderBy: { versionNo: "desc" }
      },
      advisorScore: {
        select: {
          advisorTeacherId: true,
          status: true,
          score: true,
          submittedAt: true,
          advisorTeacher: { select: { academicPrefix: true, firstNameTh: true, lastNameTh: true } }
        }
      },
      roundExceptions: {
        select: {
          id: true,
          exceptionType: true,
          reason: true,
          status: true,
          createdAt: true,
          assessmentRound: { select: { roundType: true } }
        },
        orderBy: { createdAt: "desc" }
      },
      timelineEvents: {
        select: {
          id: true,
          eventTitle: true,
          eventDescription: true,
          occurredAt: true,
          actor: { select: { name: true, email: true } }
        },
        orderBy: { occurredAt: "desc" },
        take: 30
      }
    }
  });

  if (!project) return { status: "NOT_FOUND" };

  const access = canViewProjectRecord(project, viewer);
  if (!access.allowed) return { status: "UNAUTHORIZED" };

  const viewerRole = access.viewerRole;
  const studentCanSeeRawAttemptScore = viewerRole !== "STUDENT";

  return {
    status: "OK",
    record: {
      viewerRole,
      summary: {
        id: project.id,
        titleTh: project.currentTitleTh ?? project.origin?.initialProjectTitleTh ?? "ยังไม่ได้ระบุชื่อโครงงาน",
        titleEn: project.currentTitleEn ?? project.origin?.initialProjectTitleEn ?? null,
        status: project.status,
        statusLabel: projectStatusLabelTh(project.status),
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      },
      student: {
        id: project.student.id,
        studentCode: project.student.studentCode,
        name: `${project.student.firstNameTh} ${project.student.lastNameTh}`,
        email: project.student.generatedEmail
      },
      courseOffering: {
        id: project.courseOffering.id,
        courseTitle: project.courseOffering.courseTitle,
        termDisplayName: project.courseOffering.term.displayName
      },
      advisorRequests: project.advisorRequests.map((request) => ({
        id: request.id,
        status: request.status,
        advisorName: teacherDisplayName(request.advisorTeacher),
        requestedAt: request.requestedAt,
        reviewedAt: request.reviewedAt
      })),
      committee: project.committeeAssignments.map((assignment) => ({
        id: assignment.id,
        teacherName: teacherDisplayName(assignment.teacher),
        role: assignment.role,
        active: assignment.active
      })),
      origin: project.origin
        ? {
            titleTh: project.origin.initialProjectTitleTh,
            titleEn: project.origin.initialProjectTitleEn,
            status: project.origin.status,
            submittedAt: project.origin.submittedAt,
            tentativeAdvisorName: project.origin.tentativeAdvisor ? teacherDisplayName(project.origin.tentativeAdvisor) : null,
            materialLink: project.origin.materialLink,
            versionCount: project.origin.versions.length
          }
        : null,
      schedules: project.scheduleProposals.map((schedule) => ({
        id: schedule.id,
        roundType: schedule.roundType,
        assessmentKind: schedule.assessmentKind,
        status: schedule.status,
        proposedStartAt: schedule.proposedStartAt,
        proposedEndAt: schedule.proposedEndAt,
        room: schedule.room,
        approvals: schedule.approvals.map((approval) => ({
          teacherName: teacherDisplayName(approval.teacher),
          decision: approval.decision,
          decidedAt: approval.decidedAt
        }))
      })),
      assessmentAttempts: project.attempts.map((attempt) => {
        const requiredReviewers = attempt.evaluatorAssignments.filter((assignment) => assignment.isRequired).length;
        const submittedReviewers = attempt.evaluatorAssignments.filter((assignment) => assignment.scoreSubmission?.status === "SUBMITTED").length;
        const canShowStudentScore = viewerRole !== "STUDENT" || attempt.assessmentRound.showScoreToStudent;
        return {
          id: attempt.id,
          roundType: attempt.assessmentRound.roundType,
          attemptNo: attempt.attemptNo,
          status: attempt.status,
          isOfficialScore: attempt.isOfficialScore,
          officialScore: studentCanSeeRawAttemptScore || canShowStudentScore ? decimalToString(attempt.officialScore) : null,
          finalDecision: attempt.finalDecision,
          requiredReviewers,
          submittedReviewers,
          canShowStudentScore
        };
      }),
      reports: project.reportVersions.map((report) => ({
        id: report.id,
        versionNo: report.versionNo,
        submittedAt: report.submittedAt,
        driveLink: report.driveLink,
        reviews:
          viewerRole === "STUDENT"
            ? []
            : report.reviews.map((review) => ({
                reviewerName: teacherDisplayName(review.reviewerTeacher),
                decision: review.decision,
                reviewedAt: review.reviewedAt
              }))
      })),
      advisorScore: project.advisorScore
        ? {
            status: project.advisorScore.status,
            score: viewerRole === "STUDENT" && project.status !== "COMPLETED" ? null : decimalToString(project.advisorScore.score),
            submittedAt: project.advisorScore.submittedAt,
            advisorName: teacherDisplayName(project.advisorScore.advisorTeacher)
          }
        : null,
      exceptions: project.roundExceptions.map((exception) => ({
        id: exception.id,
        roundType: exception.assessmentRound.roundType,
        exceptionType: exception.exceptionType,
        status: exception.status,
        reason: exception.reason,
        createdAt: exception.createdAt
      })),
      timeline: project.timelineEvents.map((event) => ({
        id: event.id,
        title: event.eventTitle,
        description: event.eventDescription,
        occurredAt: event.occurredAt,
        actorName: event.actor?.name ?? event.actor?.email ?? null
      })),
      actionLinks: buildActionLinks(viewerRole)
    }
  };
}
