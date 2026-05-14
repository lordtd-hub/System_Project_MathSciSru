import Link from "next/link";
import { auth } from "@/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { LifecycleStepper } from "@/components/ui/LifecycleStepper";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { NextActionCard } from "@/components/ui/NextActionCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TaskListCard, type TaskListItem } from "@/components/ui/TaskListCard";
import { TimelineCard } from "@/components/ui/TimelineCard";
import { WarningAlert, SuccessAlert, InfoAlert } from "@/components/ui/Alert";
import { isRoundClosed, isRoundOpen } from "@/lib/assessments/courseRounds";
import { roundExceptionLabel, requiresLateRoundPenalty } from "@/lib/assessments/roundExceptions";
import { prisma } from "@/lib/db";
import { isPresentationAssessmentComplete } from "@/lib/assessments/presentationCompletion";
import { createNavTimer } from "@/lib/diagnostics/navTiming";
import { formatThaiScheduleRange } from "@/lib/format/dateTime";
import { getNextActionForStudent, getStudentAvailableActions, type StudentWorkflowAction } from "@/lib/lifecycle/nextActions";
import { getStudentReportActionLabel } from "@/lib/reports/reportWorkflow";
import { teacherDisplayName } from "@/lib/teachers/displayName";

function daysWaiting(from?: Date | null) {
  if (!from) return 0;
  return Math.floor((Date.now() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function assessmentKindLabel(kind?: string | null) {
  if (kind === "PROGRESS_1") return "การสอบความก้าวหน้าครั้งที่ 1";
  if (kind === "PROGRESS_2") return "การสอบความก้าวหน้าครั้งที่ 2";
  if (kind === "FINAL_PRESENTATION") return "การสอบนำเสนอขั้นสุดท้าย";
  if (kind === "FINAL_PRESENT") return "การสอบนำเสนอขั้นสุดท้าย";
  return "รอบสอบ";
}

function scheduleStatusLabel(status?: string | null) {
  if (status === "PROPOSED") return "รอกรรมการยืนยัน";
  if (status === "CONFIRMED") return "ยืนยันแล้ว";
  if (status === "REJECTED") return "มีกรรมการไม่สะดวก";
  return status ?? "-";
}

function committeeRoleLabel(role?: string | null) {
  if (role === "ADVISOR") return "อาจารย์ที่ปรึกษา";
  if (role === "HEAD") return "ประธานกรรมการ";
  if (role === "MEMBER") return "กรรมการ";
  return role ?? "-";
}

function displayTimelineText(value?: string | null) {
  if (!value) return value ?? undefined;
  return value
    .replaceAll("PROGRESS_1", "ความก้าวหน้าครั้งที่ 1")
    .replaceAll("PROGRESS_2", "ความก้าวหน้าครั้งที่ 2")
    .replaceAll("FINAL_PRESENT", "สอบนำเสนอขั้นสุดท้าย")
    .replaceAll("FINAL_PRESENTATION", "สอบนำเสนอขั้นสุดท้าย")
    .replaceAll("CONFIRMED", "ยืนยันแล้ว")
    .replaceAll("REJECTED", "มีกรรมการไม่สะดวก")
    .replaceAll("PROPOSED", "รอกรรมการยืนยัน");
}

function scoreAverage(scores: number[]) {
  if (!scores.length) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function formatScore(score: number | null) {
  if (score === null) return "-";
  return Number.isInteger(score) ? String(score) : score.toFixed(2);
}

function buildStudentTasks(status: string): TaskListItem[] {
  if (status === "STUDENT_PROFILE") {
    return [{ title: "กรอกข้อมูลนักศึกษา", description: "ต้องกรอกข้อมูลนี้ก่อนสร้างโครงงาน", href: "/student/profile", urgency: "สูง" }];
  }
  if (status === "DRAFT") {
    return [
      { title: "สร้าง/แก้ไขร่างโครงงาน", description: "ระบุหัวข้อ เหตุผล และเลือกอาจารย์ที่ปรึกษา", href: "/student/project", urgency: "สูง" },
      { title: "ส่งคำขอให้อาจารย์ที่ปรึกษาอนุมัติ", description: "หลังส่งแล้วจะเข้าสู่สถานะรอที่ปรึกษา", href: "/student/project" }
    ];
  }
  if (status === "PROPOSAL_PENDING") {
    return [{ title: "ส่งเอกสารเสนอหัวข้อ", description: "แนบบทคัดย่อและลิงก์ Google Drive หรือ Google Classroom", href: "/student/proposal", urgency: "สูง" }];
  }
  if (status === "IN_PROGRESS") {
    return [{ title: "เสนอวันสอบความก้าวหน้าหรือสอบขั้นสุดท้าย", description: "กรรมการทุกคนต้องอนุมัติก่อนยืนยันตารางสอบ", href: "/student/schedule" }];
  }
  if (status === "FINAL_DONE") {
    return [{ title: "ส่งเล่มรายงานฉบับสมบูรณ์", description: "ส่งเล่มรายงานครั้งแรกหลังการสอบนำเสนอขั้นสุดท้ายเสร็จสมบูรณ์", href: "/student/report" }];
  }
  if (status === "REPORT_REVIEW") {
    return [{ title: "แก้ไขเล่มรายงานตามข้อเสนอแนะของผู้ตรวจ และส่งฉบับใหม่", description: "ส่งได้เมื่อผู้ตรวจขอให้แก้ไขเล่มรายงาน", href: "/student/report" }];
  }
  if (status === "COMPLETED") {
    return [];
  }
  return [{ title: "ติดตามสถานะ", description: "ขั้นตอนนี้กำลังรอบุคคลที่เกี่ยวข้องดำเนินการ", urgency: "รอคนอื่น" }];
}

function StudentWorkflowGroup({
  title,
  description,
  actions,
  tone,
  emptyText
}: {
  title: string;
  description: string;
  actions: StudentWorkflowAction[];
  tone: "current" | "history" | "waiting" | "locked";
  emptyText: string;
}) {
  const toneClass =
    tone === "current"
      ? "workflow-group-current"
      : tone === "history"
        ? "workflow-group-complete"
        : tone === "waiting"
          ? "workflow-group-waiting"
          : "workflow-group-locked";
  const actionClass = tone === "current" ? "button" : tone === "history" ? "button-secondary" : "workflow-chip text-muted";

  return (
    <div className={`workflow-group ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
        </div>
        <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs font-semibold text-muted">{actions.length}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.length ? actions.map((item) =>
          item.href && tone !== "waiting" && tone !== "locked" ? (
            <Link key={item.key} className={`${actionClass} w-full sm:w-auto`} href={item.href}>
              {item.title}
            </Link>
          ) : (
            <span key={item.key} className={actionClass}>
              {item.title}
            </span>
          )
        ) : <span className="text-sm text-muted">{emptyText}</span>}
      </div>
    </div>
  );
}

export default async function StudentDashboardPage() {
  const timer = createNavTimer("/student");
  const authStart = timer.startBlock();
  const session = await auth();
  timer.endBlock("auth_session", authStart);
  const roleStart = timer.startBlock();
  const isNotStudent = session?.user.role !== "STUDENT";
  timer.endBlock("role_guard", roleStart);
  if (isNotStudent || !session?.user.email) {
    timer.end("unauthorized");
    return <div className="panel">หน้านี้สำหรับนักศึกษาเท่านั้น</div>;
  }
  // Roster lookup stays tied to the authenticated student email: generatedEmail: session.user.email.toLowerCase()
  const studentEmail = session.user.email.toLowerCase();

  const student = await timer.measure("student_dashboard_query", () => prisma.student.findUnique({
    where: { generatedEmail: studentEmail },
    select: {
      firstNameTh: true,
      projects: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          currentTitleTh: true,
          courseOffering: {
            select: {
              assessmentRounds: {
                select: {
                  roundType: true,
                  status: true,
                  showScoreToStudent: true,
                  showFeedbackToStudent: true,
                  showEvaluatorNameToStudent: true
                }
              }
            }
          },
          advisorRequests: {
            select: {
              requestedAt: true,
              status: true,
              advisorComment: true,
              advisorTeacher: { select: { academicPrefix: true, firstNameTh: true, lastNameTh: true } }
            },
            orderBy: { requestedAt: "desc" },
            take: 1
          },
          committeeAssignments: {
            select: {
              id: true,
              role: true,
              active: true,
              teacherId: true,
              teacher: { select: { academicPrefix: true, firstNameTh: true, lastNameTh: true } }
            },
            orderBy: { appointedAt: "asc" }
          },
          scheduleProposals: {
            select: {
              assessmentKind: true,
              status: true,
              proposedStartAt: true,
              proposedEndAt: true,
              room: true,
              approvals: {
                select: {
                  decision: true,
                  teacher: { select: { academicPrefix: true, firstNameTh: true, lastNameTh: true } }
                }
              }
            },
            orderBy: { createdAt: "desc" },
            take: 6
          },
          reportVersions: { select: { versionNo: true, reviews: { select: { decision: true } } }, orderBy: { versionNo: "desc" }, take: 1 },
          presentationSubmissions: { select: { id: true }, orderBy: { createdAt: "desc" }, take: 1 },
          roundExceptions: {
            where: { status: "OPEN" },
            select: {
              id: true,
              exceptionType: true,
              status: true,
              reason: true,
              assessmentRound: { select: { roundType: true } }
            }
          },
          attempts: {
            where: { attemptType: { in: ["PROGRESS_1", "PROGRESS_2", "FINAL_PRESENTATION"] } },
            select: {
              id: true,
              attemptType: true,
              officialScore: true,
              assessmentRound: {
                select: {
                  roundType: true,
                  status: true,
                  closedAt: true,
                  showScoreToStudent: true,
                  showFeedbackToStudent: true,
                  showEvaluatorNameToStudent: true
                }
              },
              evaluatorAssignments: {
                select: {
                  id: true,
                  teacherId: true,
                  evaluatorDisplayNameSnapshot: true,
                  scoreSubmission: {
                    select: {
                      totalScore: true,
                      overallComment: true,
                      status: true,
                      submittedAt: true
                    }
                  }
                },
                orderBy: { assignedAt: "asc" }
              }
            },
            orderBy: { createdAt: "asc" }
          },
          timelineEvents: {
            select: { id: true, occurredAt: true, eventTitle: true, eventDescription: true, actor: { select: { name: true } } },
            orderBy: { occurredAt: "desc" },
            take: 4
          }
        }
      }
    }
  }));
  const project = student?.projects[0];

  if (!student) {
    timer.end("missing_student_record");
    return (
      <EmptyState
        title="ยังไม่พบข้อมูลนักศึกษา"
        description="บัญชีนี้ยังไม่ถูกนำเข้าระบบ กรุณาติดต่อผู้ดูแลระบบ"
        actionLabel="กลับหน้าแรก"
        href="/"
      />
    );
  }

  if (!project) {
    timer.end("missing_project");
    return (
      <div className="space-y-6">
        <PageHeader title={`สวัสดี, ${student.firstNameTh}`} description="ยังไม่มีโครงงานในรายวิชานี้" />
        <EmptyState
          title="ยังไม่มีโครงงาน"
          description="เมื่อผู้ดูแลระบบนำเข้ารายชื่อและสร้างรายวิชาแล้ว โครงงานของคุณจะแสดงที่นี่"
          actionLabel="ดูข้อมูลนักศึกษา"
          href="/student/profile"
        />
      </div>
    );
  }

  const advisorRequest = project.advisorRequests[0];
  const waitingDays = daysWaiting(advisorRequest?.requestedAt);
  const roundStatusByType = new Map(project.courseOffering.assessmentRounds.map((round) => [round.roundType, round.status]));
  const hasCompletedScores = (roundType: "PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENTATION") => {
    return isPresentationAssessmentComplete({
      roundStatus: roundStatusByType.get(roundType),
      committeeAssignments: project.committeeAssignments,
      scoreSubmissions: project.attempts
        .filter((item) => item.assessmentRound.roundType === roundType || item.attemptType === roundType)
        .flatMap((attempt) =>
          attempt.evaluatorAssignments.map((assignment) => ({
            teacherId: assignment.teacherId,
            status: assignment.scoreSubmission?.status ?? null
          }))
        )
    });
  };
  const assessmentStates = {
    PROGRESS_1: hasCompletedScores("PROGRESS_1") ? "COMPLETED" as const : "NOT_STARTED" as const,
    PROGRESS_2: hasCompletedScores("PROGRESS_2") ? "COMPLETED" as const : "NOT_STARTED" as const,
    FINAL_PRESENT: hasCompletedScores("FINAL_PRESENTATION") ? "COMPLETED" as const : "NOT_STARTED" as const
  };
  const latestReport = project.reportVersions[0];
  const latestReportHasRevisionRequest = Boolean(latestReport?.reviews.some((review) => review.decision === "FAIL"));
  const reportStatus = !latestReport
    ? "NONE" as const
    : latestReportHasRevisionRequest
      ? "REVISION_REQUIRED" as const
      : project.status === "REPORT_APPROVED"
        ? "APPROVED" as const
        : "SUBMITTED" as const;
  const reportActionLabel = getStudentReportActionLabel({
    hasReportVersion: Boolean(latestReport),
    latestReportHasRevisionRequest,
    projectStatus: project.status
  });
  const reportActionDescription = !latestReport
    ? "ส่งเล่มรายงานฉบับสมบูรณ์ครั้งแรกหลังการสอบนำเสนอขั้นสุดท้ายเสร็จสมบูรณ์"
    : latestReportHasRevisionRequest
      ? "แก้ไขเล่มรายงานตามข้อเสนอแนะของผู้ตรวจ แล้วส่งฉบับใหม่ให้ผู้ตรวจพิจารณาอีกครั้ง"
      : project.status === "REPORT_APPROVED"
        ? "รายงานได้รับการอนุมัติแล้ว ขั้นตอนถัดไปคือคะแนนสรุปของอาจารย์ที่ปรึกษาและการปิดโครงงาน"
        : "ส่งรายงานแล้ว ขณะนี้อยู่ระหว่างรอผู้ตรวจพิจารณารายงาน";
  const baseNextAction = getNextActionForStudent(project.status);
  const nextAction = ["FINAL_DONE", "REPORT_REVIEW", "REPORT_APPROVED"].includes(project.status)
    ? {
        ...baseNextAction,
        title: reportActionLabel,
        description: reportActionDescription,
        actionLabel: project.status === "REPORT_REVIEW" && !latestReportHasRevisionRequest ? "ดูสถานะรายงาน" : reportActionLabel,
        href: "/student/report",
        tone: project.status === "REPORT_APPROVED" ? "success" as const : baseNextAction.tone
      }
    : baseNextAction;
  const studentWorkflowContext = {
    proposalRoundOpen: Boolean(roundStatusByType.get("PROPOSAL") && isRoundOpen(roundStatusByType.get("PROPOSAL")!)),
    roundAvailability: {
      PROGRESS_1: Boolean(roundStatusByType.get("PROGRESS_1") && isRoundOpen(roundStatusByType.get("PROGRESS_1")!)),
      PROGRESS_2: Boolean(roundStatusByType.get("PROGRESS_2") && isRoundOpen(roundStatusByType.get("PROGRESS_2")!)),
      FINAL_PRESENT: Boolean(roundStatusByType.get("FINAL_PRESENTATION") && isRoundOpen(roundStatusByType.get("FINAL_PRESENTATION")!))
    }
  };
  const finalRoundClosed = Boolean(roundStatusByType.get("FINAL_PRESENTATION") && isRoundClosed(roundStatusByType.get("FINAL_PRESENTATION")!));
  const hasIncompleteAfterFinal = finalRoundClosed && project.status !== "COMPLETED";
  const lateRoundExceptions = project.roundExceptions ?? [];
  const workflowActions = getStudentAvailableActions(project.status, assessmentStates, reportStatus, studentWorkflowContext);
  const blockedPrimaryWorkflowAction = workflowActions.blocked_waiting_for[0];
  const roundAwareBaseNextAction = project.status === "PROPOSAL_PENDING" && blockedPrimaryWorkflowAction
    ? {
        title: blockedPrimaryWorkflowAction.title,
        description: blockedPrimaryWorkflowAction.description,
        tone: "warning" as const
      }
    : nextAction;
  const proposal = project.presentationSubmissions[0];
  const activeSchedule = project.scheduleProposals.find((schedule) => {
    if (schedule.assessmentKind === "PROGRESS_1") return assessmentStates.PROGRESS_1 !== "COMPLETED";
    if (schedule.assessmentKind === "PROGRESS_2") return assessmentStates.PROGRESS_2 !== "COMPLETED";
    if (schedule.assessmentKind === "FINAL_PRESENT") return assessmentStates.FINAL_PRESENT !== "COMPLETED";
    return true;
  });
  const latestSchedule = activeSchedule ?? project.scheduleProposals[0];
  const actionableSchedule = activeSchedule;
  const latestScheduleApprovedCount = latestSchedule?.approvals.filter((approval) => approval.decision === "APPROVE").length ?? 0;
  const latestScheduleRejectedCount = latestSchedule?.approvals.filter((approval) => approval.decision === "REJECT").length ?? 0;
  const latestScheduleTotalCount = latestSchedule?.approvals.length ?? 0;
  const latestSchedulePendingCount = Math.max(latestScheduleTotalCount - latestScheduleApprovedCount - latestScheduleRejectedCount, 0);
  const latestScheduleRoundLabel = assessmentKindLabel(latestSchedule?.assessmentKind);
  const actionableScheduleApprovedCount = actionableSchedule?.approvals.filter((approval) => approval.decision === "APPROVE").length ?? 0;
  const actionableScheduleRejectedCount = actionableSchedule?.approvals.filter((approval) => approval.decision === "REJECT").length ?? 0;
  const actionableScheduleTotalCount = actionableSchedule?.approvals.length ?? 0;
  const actionableSchedulePendingCount = Math.max(actionableScheduleTotalCount - actionableScheduleApprovedCount - actionableScheduleRejectedCount, 0);
  const actionableScheduleRoundLabel = assessmentKindLabel(actionableSchedule?.assessmentKind);
  const todayText = new Date().toLocaleDateString("th-TH", { dateStyle: "full", timeZone: "Asia/Bangkok" });
  const latestScheduleDateText = latestSchedule
    ? `${formatThaiScheduleRange(latestSchedule.proposedStartAt, latestSchedule.proposedEndAt)}${latestSchedule.room ? ` · ห้อง ${latestSchedule.room}` : ""}`
    : "";
  const actionableScheduleDateText = actionableSchedule
    ? `${formatThaiScheduleRange(actionableSchedule.proposedStartAt, actionableSchedule.proposedEndAt)}${actionableSchedule.room ? ` · ห้อง ${actionableSchedule.room}` : ""}`
    : "";
  const nextAssessmentAction = project.status === "IN_PROGRESS"
    ? assessmentStates.PROGRESS_1 !== "COMPLETED"
      ? {
          title: "ดำเนินการสอบความก้าวหน้าครั้งที่ 1",
          description: "บันทึกเอกสาร/หลักฐานการสอบความก้าวหน้าครั้งที่ 1 แล้วเสนอวันสอบให้กรรมการยืนยัน",
          actionLabel: "เปิดการสอบความก้าวหน้าครั้งที่ 1",
          href: "/student/schedule"
        }
      : assessmentStates.PROGRESS_2 !== "COMPLETED"
        ? {
            title: "ดำเนินการสอบความก้าวหน้าครั้งที่ 2",
            description: "การสอบความก้าวหน้าครั้งที่ 1 เสร็จแล้ว ขั้นตอนถัดไปคือบันทึกเอกสารการสอบความก้าวหน้าครั้งที่ 2 และเสนอวันสอบ",
            actionLabel: "เปิดการสอบความก้าวหน้าครั้งที่ 2",
            href: "/student/schedule"
          }
        : assessmentStates.FINAL_PRESENT !== "COMPLETED"
          ? {
              title: "ดำเนินการสอบนำเสนอขั้นสุดท้าย",
              description: "การสอบความก้าวหน้าครั้งที่ 1 และครั้งที่ 2 เสร็จแล้ว ขั้นตอนถัดไปคือบันทึกเอกสารสอบนำเสนอขั้นสุดท้ายและเสนอวันสอบ",
              actionLabel: "เปิดการสอบนำเสนอขั้นสุดท้าย",
              href: "/student/schedule"
            }
          : {
              title: reportActionLabel,
              description: reportActionDescription,
              actionLabel: "เปิดหน้าส่งเล่ม",
              href: "/student/report",
              tone: "success" as const
            }
    : roundAwareBaseNextAction;
  const primaryWorkflowAction = workflowActions.available_now[0] ?? workflowActions.blocked_waiting_for[0];
  const roundAwareNextAssessmentAction = project.status === "IN_PROGRESS" && primaryWorkflowAction
    ? {
        title: primaryWorkflowAction.title,
        description: primaryWorkflowAction.description,
        actionLabel: primaryWorkflowAction.state === "available" ? "เปิดงานนี้" : undefined,
        href: primaryWorkflowAction.state === "available" ? primaryWorkflowAction.href : undefined,
        tone: primaryWorkflowAction.state === "blocked" ? "warning" as const : undefined
      }
    : nextAssessmentAction;
  const studentNextAction = actionableSchedule?.status === "REJECTED"
    ? {
        title: `${actionableScheduleRoundLabel} มีอาจารย์ไม่สะดวก`,
        description: "กรุณาเสนอวันสอบใหม่ ระบบจะแจ้งกรรมการทุกคนให้พิจารณารอบใหม่อีกครั้ง",
        actionLabel: "เสนอวันสอบใหม่",
        href: "/student/schedule",
        tone: "warning" as const
      }
    : actionableSchedule?.status === "PROPOSED"
      ? {
          title: `รอกรรมการยืนยันวันสอบ ${actionableScheduleRoundLabel}`,
          description: `อนุมัติแล้ว ${actionableScheduleApprovedCount}/${actionableScheduleTotalCount} คน ยังรอ ${actionableSchedulePendingCount} คน เมื่อครบแล้วจึงเข้าสอบและรอกรรมการบันทึกคะแนน`,
          actionLabel: "ดูสถานะวันสอบ",
          href: "/student/schedule",
          tone: "warning" as const
        }
      : actionableSchedule?.status === "CONFIRMED"
        ? {
            title: `${actionableScheduleRoundLabel} ยืนยันวันสอบแล้ว`,
            description: "ขั้นตอนถัดไปคือเข้าสอบตามวันเวลาที่เสนอไว้ หลังสอบแล้วรอกรรมการบันทึกคะแนนในระบบ",
            actionLabel: "ดูรายละเอียดวันสอบ",
            href: "/student/schedule",
            tone: "success" as const
          }
        : roundAwareNextAssessmentAction;
  const scheduleAwareStudentNextAction = actionableSchedule && ["PROPOSED", "CONFIRMED"].includes(actionableSchedule.status)
    ? { ...studentNextAction, description: `${actionableScheduleDateText} · ${studentNextAction.description}` }
    : studentNextAction;
  const studentTrackingTasks: TaskListItem[] = project.status === "IN_PROGRESS"
    ? actionableSchedule?.status === "REJECTED"
      ? [{
          title: `${actionableScheduleRoundLabel} มีอาจารย์ไม่สะดวก`,
          description: `มีผู้ไม่สะดวก ${actionableScheduleRejectedCount} คน กรุณาเสนอวันสอบใหม่เพื่อให้กรรมการทุกคนพิจารณาอีกครั้ง`,
          href: "/student/schedule",
          urgency: "สูง"
        }]
      : actionableSchedule?.status === "PROPOSED"
        ? [{
            title: `รอกรรมการยืนยันวันสอบ ${actionableScheduleRoundLabel}`,
            description: `อนุมัติแล้ว ${actionableScheduleApprovedCount}/${actionableScheduleTotalCount} คน ยังรอ ${actionableSchedulePendingCount} คน`,
            href: "/student/schedule",
            urgency: "รอคนอื่น"
          }]
        : actionableSchedule?.status === "CONFIRMED"
          ? [{
              title: `${actionableScheduleRoundLabel} ยืนยันวันสอบแล้ว`,
              description: `${actionableScheduleDateText} หลังสอบแล้วรอกรรมการบันทึกคะแนน`,
              href: "/student/schedule"
            }]
          : assessmentStates.PROGRESS_1 !== "COMPLETED"
            ? [{ title: "เตรียมสอบความก้าวหน้าครั้งที่ 1", description: "บันทึกเอกสาร/หลักฐานการสอบความก้าวหน้าครั้งที่ 1 แล้วเสนอวันสอบ", href: "/student/schedule", urgency: "สูง" }]
            : assessmentStates.PROGRESS_2 !== "COMPLETED"
              ? [{ title: "เตรียมสอบความก้าวหน้าครั้งที่ 2", description: "การสอบความก้าวหน้าครั้งที่ 1 เสร็จแล้ว ขั้นตอนถัดไปคือการสอบความก้าวหน้าครั้งที่ 2", href: "/student/schedule", urgency: "สูง" }]
              : assessmentStates.FINAL_PRESENT !== "COMPLETED"
                ? [{ title: "เตรียมสอบนำเสนอขั้นสุดท้าย", description: "การสอบความก้าวหน้าครั้งที่ 1 และครั้งที่ 2 เสร็จแล้ว ขั้นตอนถัดไปคือการสอบนำเสนอขั้นสุดท้าย", href: "/student/schedule", urgency: "สูง" }]
              : [{ title: reportActionLabel, description: reportActionDescription, href: "/student/report", urgency: latestReportHasRevisionRequest ? "สูง" : undefined }]
    : ["FINAL_DONE", "REPORT_REVIEW", "REPORT_APPROVED"].includes(project.status)
      ? [{
          title: reportActionLabel,
          description: reportActionDescription,
          href: "/student/report",
          urgency: !latestReport || latestReportHasRevisionRequest ? "สูง" : "รอคนอื่น"
        }]
      : buildStudentTasks(project.status);
  const roundAwareStudentTrackingTasks: TaskListItem[] = project.status === "IN_PROGRESS" && !actionableSchedule && !workflowActions.available_now.length && workflowActions.blocked_waiting_for.length
    ? workflowActions.blocked_waiting_for.slice(0, 1).map((item) => ({
        title: item.title,
        description: item.description,
        href: item.href,
        urgency: "รอเปิดรอบ"
      }))
    : studentTrackingTasks;
  const displayStudentTrackingTasks: TaskListItem[] = project.status === "PROPOSAL_PENDING" && blockedPrimaryWorkflowAction
    ? [{
        title: blockedPrimaryWorkflowAction.title,
        description: blockedPrimaryWorkflowAction.description,
        urgency: "พ้นกำหนด"
      }]
    : roundAwareStudentTrackingTasks;
  const shouldShowStudentTrackingCard = displayStudentTrackingTasks.length > 1;
  const latestAdvisorRejected = project.status === "DRAFT" && advisorRequest?.status === "REJECTED";
  const visibleAssessmentResults = project.attempts
    .map((attempt) => {
      const submittedScores = attempt.evaluatorAssignments
        .map((assignment) => assignment.scoreSubmission)
        .filter((score): score is NonNullable<typeof score> => score?.status === "SUBMITTED" || score?.status === "LOCKED");
      const hasSubmittedFeedback = submittedScores.some((score) => Boolean(score.overallComment?.trim()));
      const showScore = submittedScores.length > 0;
      const showFeedback = hasSubmittedFeedback || submittedScores.length > 0;
      const scores = submittedScores.map((score) => Number(score.totalScore));
      return {
        attempt,
        showScore,
        showFeedback,
        averageScore: attempt.officialScore != null ? Number(attempt.officialScore) : scoreAverage(scores),
        submittedCount: submittedScores.length,
        evaluatorCount: attempt.evaluatorAssignments.length
      };
    })
    .filter((result) => result.showScore || result.showFeedback)
    .sort((a, b) => {
      const order = { PROGRESS_1: 1, PROGRESS_2: 2, FINAL_PRESENTATION: 3 } as const;
      return (order[a.attempt.assessmentRound.roundType as keyof typeof order] ?? 99) - (order[b.attempt.assessmentRound.roundType as keyof typeof order] ?? 99);
    });
  const visibleResultByRound = new Map(visibleAssessmentResults.map((result) => [result.attempt.assessmentRound.roundType, result]));
  const assessmentResultCards = [
    { roundType: "PROGRESS_1" as const, label: "ความก้าวหน้าครั้งที่ 1", href: "/student/feedback?round=progress-1#progress-1" },
    { roundType: "PROGRESS_2" as const, label: "ความก้าวหน้าครั้งที่ 2", href: "/student/feedback?round=progress-2#progress-2" },
    { roundType: "FINAL_PRESENTATION" as const, label: "สอบนำเสนอขั้นสุดท้าย", href: "/student/feedback?round=final#final" }
  ].map((round) => ({ ...round, result: visibleResultByRound.get(round.roundType) }));
  timer.end();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`สวัสดี, ${student.firstNameTh}`}
        description="แดชบอร์ดนี้เน้นสิ่งที่ต้องทำตอนนี้และสถานะล่าสุด รายละเอียดทั้งหมดอ่านได้ในแฟ้มโครงงาน"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={project.status} />
            <Link className="button-secondary" href={`/projects/${project.id}`}>
              ดูแฟ้มโครงงาน
            </Link>
          </div>
        }
      />

      <div className="rounded-md border border-line bg-surface px-4 py-2 text-sm text-muted">
        วันนี้ {todayText}
      </div>
      <NextActionCard action={scheduleAwareStudentNextAction} />

      {hasIncompleteAfterFinal ? (
        <WarningAlert title="รอบสอบขั้นสุดท้ายปิดแล้ว แต่โครงงานยังไม่ครบถ้วน">
          หากยังมีรายการค้างหลังปิดรอบ Final นักศึกษาอาจได้รับเกรด I กรุณาติดต่ออาจารย์ผู้รับผิดชอบและดำเนินการตามรายการที่ระบบแจ้งให้ครบถ้วน
        </WarningAlert>
      ) : null}

      {lateRoundExceptions.length ? (
        <WarningAlert title="มีรายการดำเนินการไม่ตรงรอบ">
          <div className="space-y-1">
            {lateRoundExceptions.map((exception) => (
              <p key={exception.id}>
                {roundExceptionLabel(exception.assessmentRound.roundType)}: {requiresLateRoundPenalty([exception])
                  ? "ติดป้ายส่ง/สอบหลังปิดรอบ และหักคะแนนรอบนี้ 10%"
                  : "เปิดย้อนหลังเป็นกรณีพิเศษโดยไม่หักคะแนน"}
              </p>
            ))}
          </div>
        </WarningAlert>
      ) : null}

      {actionableSchedule?.status === "REJECTED" ? (
        <WarningAlert title="มีอาจารย์ไม่สะดวกตามวันสอบที่เสนอ">
          <div className="space-y-2">
            <p>
              สถานะล่าสุด: อนุมัติ {actionableScheduleApprovedCount}/{actionableScheduleTotalCount} · ไม่สะดวก {actionableScheduleRejectedCount} · รอ {actionableSchedulePendingCount}
              {" "}กรุณาเข้าไปเสนอวันสอบใหม่อีกครั้ง
            </p>
            <Link className="button-secondary inline-flex" href="/student/schedule">เสนอวันสอบใหม่</Link>
          </div>
        </WarningAlert>
      ) : actionableSchedule?.status === "PROPOSED" ? (
        <InfoAlert title="รอกรรมการยืนยันวันสอบ">
          สถานะล่าสุด: อนุมัติ {actionableScheduleApprovedCount}/{actionableScheduleTotalCount} · ไม่สะดวก {actionableScheduleRejectedCount} · รอ {actionableSchedulePendingCount}
        </InfoAlert>
      ) : actionableSchedule?.status === "CONFIRMED" ? (
        <SuccessAlert title="วันสอบได้รับการยืนยันแล้ว">
          กรรมการอนุมัติครบ {actionableScheduleApprovedCount}/{actionableScheduleTotalCount} คน สำหรับ {actionableScheduleRoundLabel} แล้ว ขั้นตอนถัดไปคือเข้าสอบตามวันเวลา และรอกรรมการบันทึกคะแนนหลังสอบ
        </SuccessAlert>
      ) : null}

      {latestAdvisorRejected ? (
        <WarningAlert title="คำขอที่ปรึกษาถูกปฏิเสธ">
          <div className="space-y-2">
            <p>
              {advisorRequest?.advisorTeacher ? `${teacherDisplayName(advisorRequest.advisorTeacher)} ปฏิเสธคำขอที่ปรึกษา` : "อาจารย์ที่ปรึกษาปฏิเสธคำขอ"}
              {" "}กรุณาแก้ไขข้อมูลหัวข้อก่อนส่งคำขอใหม่
            </p>
            {advisorRequest?.advisorComment ? (
              <MarkdownLatexViewer className="rounded-md border border-line bg-surface p-3 text-sm text-muted" value={advisorRequest.advisorComment} />
            ) : null}
            <Link className="button-secondary inline-flex" href="/student/project">ไปแก้ไขร่างโครงงาน</Link>
          </div>
        </WarningAlert>
      ) : null}

      {project.status === "PENDING_ADVISOR" && waitingDays > 7 ? (
        <WarningAlert title="รอการตอบรับเกิน 7 วัน">
          ระบบจะแจ้งเตือนอาจารย์ที่ปรึกษาและผู้ดูแลระบบ นักศึกษายังไม่สามารถไปขั้นถัดไปจนกว่าจะอนุมัติ
        </WarningAlert>
      ) : null}

      {project.status === "COMPLETED" ? (
        <SuccessAlert title="โครงงานเสร็จสมบูรณ์">ระบบเก็บประวัติและหลักฐานสำคัญไว้เรียบร้อยแล้ว</SuccessAlert>
      ) : null}

      <LifecycleStepper status={project.status} />

      <section className="panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="mt-1 text-lg font-semibold">สถานะกรรมการ วันสอบ และผลประเมิน</h2>
          </div>
          <Link className="button-secondary" href="/student/schedule">ดูรายละเอียดรอบสอบ</Link>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="rounded-md border border-line bg-paper p-3">
            <h3 className="text-sm font-semibold">กรรมการและที่ปรึกษา</h3>
            <div className="mt-3 space-y-2 text-sm">
              {project.committeeAssignments.length ? (
                project.committeeAssignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface p-2">
                    <span>{teacherDisplayName(assignment.teacher)}</span>
                    <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-xs">{committeeRoleLabel(assignment.role)}</span>
                  </div>
                ))
              ) : (
                <p className="text-muted">ยังไม่มีการแต่งตั้งกรรมการสอบ</p>
              )}
            </div>
            <div className="mt-3 border-t border-line pt-3 text-xs leading-5 text-muted">
              {latestSchedule ? (
                <p>
                  <span className="font-semibold text-ink">วันสอบล่าสุด:</span> {latestScheduleRoundLabel} · {latestScheduleDateText || "ยังไม่ระบุวันเวลา"} · {scheduleStatusLabel(latestSchedule.status)}
                  {" "}· อนุมัติ {latestScheduleApprovedCount}/{latestScheduleTotalCount}
                  {latestScheduleRejectedCount ? ` · ไม่สะดวก ${latestScheduleRejectedCount}` : ""}
                  {latestSchedulePendingCount ? ` · รอ ${latestSchedulePendingCount}` : ""}
                </p>
              ) : (
                <p>ยังไม่มีการเสนอวันสอบ Progress/Final</p>
              )}
            </div>
          </div>
          <div className="rounded-md border border-line bg-paper p-3">
            <h3 className="text-sm font-semibold">ผลการประเมินรอบสอบ</h3>
            <div className="mt-3 space-y-2 text-sm">
              {assessmentResultCards.map((item) => (
                <Link key={item.roundType} className="block rounded-md border border-line bg-surface p-2 hover:border-brand" href={item.href}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-xs text-muted">
                      {item.result ? `${item.result.submittedCount}/${item.result.evaluatorCount} คน` : "ยังไม่มีคะแนน"}
                    </span>
                  </div>
                  {item.result ? (
                    <div className="flex items-center justify-between gap-3">
                      {item.result.showScore ? <p className="mt-1 text-muted">คะแนนเฉลี่ย {formatScore(item.result.averageScore)} / 100</p> : <p className="mt-1 text-muted">มีข้อเสนอแนะ แต่ยังไม่มีคะแนนที่บันทึก</p>}
                      <span className="text-xs font-semibold text-brand">ดูรายละเอียด</span>
                    </div>
                  ) : (
                    <p className="mt-1 text-muted">จะแสดงเมื่อกรรมการบันทึกคะแนนหรือข้อเสนอแนะ</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="dashboard-metric dashboard-metric-current">
          <div className="dashboard-metric-value">{workflowActions.available_now.length}</div>
          <div className="dashboard-metric-label">ทำได้ตอนนี้</div>
        </div>
        <div className="dashboard-metric dashboard-metric-waiting">
          <div className="dashboard-metric-value">{workflowActions.blocked_waiting_for.length}</div>
          <div className="dashboard-metric-label">รอผู้อื่น</div>
        </div>
        <div className="dashboard-metric dashboard-metric-complete">
          <div className="dashboard-metric-value">{workflowActions.read_only_history.length}</div>
          <div className="dashboard-metric-label">เสร็จแล้ว/ดูย้อนหลัง</div>
        </div>
        <div className="dashboard-metric dashboard-metric-muted">
          <div className="dashboard-metric-value">{workflowActions.locked_future.length}</div>
          <div className="dashboard-metric-label">ขั้นตอนที่ล็อก</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="panel action-queue-panel lg:col-span-2">
          <h2 className="text-lg font-semibold">ข้อมูลโครงงาน</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-line bg-paper p-3">
              <div className="text-sm font-semibold">ชื่อหัวข้อ</div>
              <p className="mt-1 text-sm text-muted">{project.currentTitleTh ?? "ยังไม่ได้ระบุหัวข้อ"}</p>
            </div>
            <div className="rounded-md border border-line bg-paper p-3">
              <div className="text-sm font-semibold">อาจารย์ที่ปรึกษา</div>
              <p className="mt-1 text-sm text-muted">
                {advisorRequest ? teacherDisplayName(advisorRequest.advisorTeacher) : "ยังไม่ได้เลือกที่ปรึกษา"}
              </p>
            </div>
            <div className="rounded-md border border-line bg-paper p-3">
              <div className="text-sm font-semibold">เอกสารเสนอหัวข้อ</div>
              <p className="mt-1 text-sm text-muted">{proposal ? "ส่งเอกสารเสนอหัวข้อแล้ว" : "ยังไม่ได้ส่งเอกสารเสนอหัวข้อ"}</p>
            </div>
            <div className="rounded-md border border-line bg-paper p-3">
              <div className="text-sm font-semibold">รายงาน</div>
              <p className="mt-1 text-sm text-muted">{latestReport ? `ฉบับที่ ${latestReport.versionNo}` : "ยังไม่มีรายงานที่ส่ง"}</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <StudentWorkflowGroup
              title="ทำได้ตอนนี้"
              description="รายการที่นักศึกษาสามารถกดทำต่อได้ในสถานะปัจจุบัน"
              actions={workflowActions.available_now}
              tone="current"
              emptyText="ยังไม่มีรายการที่ต้องทำตอนนี้"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <StudentWorkflowGroup
                title="รอผู้อื่นดำเนินการ"
                description="สถานะที่ต้องรออาจารย์หรือผู้ดูแลระบบก่อน"
                actions={workflowActions.blocked_waiting_for}
                tone="waiting"
                emptyText="ยังไม่มีรายการที่ต้องรอ"
              />
              <StudentWorkflowGroup
                title="ขั้นตอนในอนาคต"
                description="ระบบล็อกไว้จนกว่าขั้นตอนโครงงานจะพร้อมดำเนินการ"
                actions={workflowActions.locked_future}
                tone="locked"
                emptyText="ไม่มีขั้นตอนที่ล็อกอยู่"
              />
            </div>
            <StudentWorkflowGroup
              title="ประวัติการดำเนินงาน"
              description="รายการที่ทำแล้วหรือดูย้อนหลังได้ ไม่ใช่งานหลักที่ต้องดำเนินการ"
              actions={workflowActions.read_only_history}
              tone="history"
              emptyText="ยังไม่มีประวัติในขั้นก่อนหน้า"
            />
          </div>
        </section>

        {shouldShowStudentTrackingCard ? <TaskListCard title="รายการที่ต้องติดตาม" tasks={displayStudentTrackingTasks} /> : null}
      </div>

      {project.status === "PROPOSAL_REVIEW" ? (
        <InfoAlert title="การแสดงผลการเสนอหัวข้อ">
          นักศึกษาจะเห็นข้อเสนอแนะและชื่ออาจารย์ทันที แต่คะแนนการเสนอหัวข้อจะไม่แสดงให้นักศึกษาเห็น
        </InfoAlert>
      ) : null}

      <TimelineCard
        title="หลักฐานการดำเนินงานล่าสุด"
        events={project.timelineEvents.map((event) => ({
          id: event.id,
          occurredAt: event.occurredAt,
          eventTitle: displayTimelineText(event.eventTitle) ?? event.eventTitle,
          eventDescription: displayTimelineText(event.eventDescription),
          actorName: event.actor?.name
        }))}
      />
    </div>
  );
}
