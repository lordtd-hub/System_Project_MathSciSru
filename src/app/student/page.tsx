import Link from "next/link";
import { auth } from "@/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { LifecycleStepper } from "@/components/ui/LifecycleStepper";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { NextActionCard } from "@/components/ui/NextActionCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TaskListCard, type TaskListItem } from "@/components/ui/TaskListCard";
import { TimelineCard } from "@/components/ui/TimelineCard";
import { WarningAlert, SuccessAlert, InfoAlert } from "@/components/ui/Alert";
import { prisma } from "@/lib/db";
import { isPresentationAssessmentComplete } from "@/lib/assessments/presentationCompletion";
import { createNavTimer } from "@/lib/diagnostics/navTiming";
import { formatThaiScheduleRange } from "@/lib/format/dateTime";
import { getNextActionForStudent, getStudentAvailableActions, type StudentWorkflowAction } from "@/lib/lifecycle/nextActions";
import { teacherDisplayName } from "@/lib/teachers/displayName";

function daysWaiting(from?: Date | null) {
  if (!from) return 0;
  return Math.floor((Date.now() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function assessmentKindLabel(kind?: string | null) {
  if (kind === "PROGRESS_1") return "Progress 1";
  if (kind === "PROGRESS_2") return "Progress 2";
  if (kind === "FINAL_PRESENTATION") return "Final Presentation";
  if (kind === "FINAL_PRESENT") return "Final Presentation";
  return "รอบสอบ";
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
    return [{ title: "กรอกข้อมูลนักศึกษา", description: "ต้องกรอกข้อมูลนี้ก่อนสร้างโปรเจค", href: "/student/profile", urgency: "สูง" }];
  }
  if (status === "DRAFT") {
    return [
      { title: "สร้าง/แก้ไขโปรเจค", description: "ระบุหัวข้อ เหตุผล และเลือกอาจารย์ที่ปรึกษา", href: "/student/project", urgency: "สูง" },
      { title: "ส่งคำขอให้อาจารย์ที่ปรึกษาอนุมัติ", description: "หลังส่งแล้วจะเข้าสู่สถานะรอที่ปรึกษา", href: "/student/project" }
    ];
  }
  if (status === "PROPOSAL_PENDING") {
    return [{ title: "ส่งข้อมูล Proposal", description: "แนบ abstract และลิงก์ Google Drive/Classroom", href: "/student/proposal", urgency: "สูง" }];
  }
  if (status === "IN_PROGRESS") {
    return [{ title: "เสนอวันสอบ Progress/Final", description: "กรรมการทุกคนต้องอนุมัติก่อนยืนยันตาราง", href: "/student/schedule" }];
  }
  if (["FINAL_DONE", "REPORT_REVIEW"].includes(status)) {
    return [{ title: "ส่งเล่มรายงาน version ใหม่", description: "ต้องใช้ลิงก์ Google Drive ใหม่ทุก version", href: "/student/report" }];
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
            take: 12
          },
          reportVersions: { select: { versionNo: true }, orderBy: { versionNo: "desc" }, take: 1 },
          presentationSubmissions: { select: { id: true }, orderBy: { createdAt: "desc" }, take: 1 },
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
            take: 8
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
        <PageHeader title={`สวัสดี, ${student.firstNameTh}`} description="ยังไม่มีโปรเจคในรายวิชานี้" />
        <EmptyState
          title="ยังไม่มีโปรเจค"
          description="เมื่อผู้ดูแลระบบนำเข้ารายชื่อและสร้างรายวิชาแล้ว โปรเจคของคุณจะแสดงที่นี่"
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
  const nextAction = getNextActionForStudent(project.status);
  const workflowActions = getStudentAvailableActions(project.status, assessmentStates);
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
          title: "ดำเนินการ Progress 1",
          description: "บันทึกเอกสาร/หลักฐาน Progress 1 แล้วเสนอวันสอบให้กรรมการยืนยัน",
          actionLabel: "เปิด Progress 1",
          href: "/student/schedule"
        }
      : assessmentStates.PROGRESS_2 !== "COMPLETED"
        ? {
            title: "ดำเนินการ Progress 2",
            description: "Progress 1 เสร็จแล้ว ขั้นตอนถัดไปคือบันทึกเอกสาร Progress 2 และเสนอวันสอบ",
            actionLabel: "เปิด Progress 2",
            href: "/student/schedule"
          }
        : assessmentStates.FINAL_PRESENT !== "COMPLETED"
          ? {
              title: "ดำเนินการ Final Presentation",
              description: "Progress 1 และ Progress 2 เสร็จแล้ว ขั้นตอนถัดไปคือบันทึกเอกสาร Final และเสนอวันสอบ",
              actionLabel: "เปิด Final Presentation",
              href: "/student/schedule"
            }
          : {
              title: "ส่งเล่มรายงานฉบับสมบูรณ์",
              description: "Final Presentation เสร็จแล้ว ขั้นตอนถัดไปคือแก้เล่มตามข้อเสนอแนะและส่งให้ที่ปรึกษา/กรรมการตรวจ",
              actionLabel: "เปิดหน้าส่งเล่ม",
              href: "/student/report",
              tone: "success" as const
            }
    : nextAction;
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
        : nextAssessmentAction;
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
            ? [{ title: "เตรียม Progress 1", description: "บันทึกเอกสาร/หลักฐาน Progress 1 แล้วเสนอวันสอบ", href: "/student/schedule", urgency: "สูง" }]
            : assessmentStates.PROGRESS_2 !== "COMPLETED"
              ? [{ title: "เตรียม Progress 2", description: "Progress 1 เสร็จแล้ว ขั้นตอนถัดไปคือ Progress 2", href: "/student/schedule", urgency: "สูง" }]
              : assessmentStates.FINAL_PRESENT !== "COMPLETED"
                ? [{ title: "เตรียม Final Presentation", description: "Progress 1 และ Progress 2 เสร็จแล้ว ขั้นตอนถัดไปคือ Final Presentation", href: "/student/schedule", urgency: "สูง" }]
                : [{ title: "ส่งเล่มรายงานฉบับสมบูรณ์", description: "แก้เล่มตามข้อเสนอแนะ แล้วส่ง version รายงานให้ที่ปรึกษาและกรรมการตรวจ", href: "/student/report", urgency: "สูง" }]
    : buildStudentTasks(project.status);
  const latestReport = project.reportVersions[0];
  const latestAdvisorRejected = project.status === "DRAFT" && advisorRequest?.status === "REJECTED";
  const visibleAssessmentResults = project.attempts
    .map((attempt) => {
      const round = attempt.assessmentRound;
      const roundClosed = ["SCORING_CLOSED", "RELEASED"].includes(round.status);
      const submittedScores = attempt.evaluatorAssignments
        .map((assignment) => assignment.scoreSubmission)
        .filter((score): score is NonNullable<typeof score> => score?.status === "SUBMITTED" || score?.status === "LOCKED");
      const hasSubmittedFeedback = submittedScores.some((score) => Boolean(score.overallComment?.trim()));
      const showScore = roundClosed || round.showScoreToStudent;
      const showFeedback = roundClosed || round.showFeedbackToStudent || hasSubmittedFeedback;
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
    { roundType: "PROGRESS_1" as const, label: "Progress 1", href: "/student/feedback?round=progress-1#progress-1" },
    { roundType: "PROGRESS_2" as const, label: "Progress 2", href: "/student/feedback?round=progress-2#progress-2" },
    { roundType: "FINAL_PRESENTATION" as const, label: "Final Presentation", href: "/student/feedback?round=final#final" }
  ].map((round) => ({ ...round, result: visibleResultByRound.get(round.roundType) }));
  timer.end();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`สวัสดี, ${student.firstNameTh}`}
        description="แดชบอร์ดนี้สรุปสถานะโครงงาน สิ่งที่ต้องทำ และหลักฐานสำคัญใน Project Lifecycle v2"
        actions={<StatusBadge status={project.status} />}
      />

      <div className="rounded-md border border-line bg-surface px-4 py-2 text-sm text-muted">
        วันนี้ {todayText}
      </div>
      <NextActionCard action={scheduleAwareStudentNextAction} />

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
                    <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-xs">{assignment.role}</span>
                  </div>
                ))
              ) : (
                <p className="text-muted">ยังไม่มีการแต่งตั้งกรรมการสอบ</p>
              )}
            </div>
            <div className="mt-3 border-t border-line pt-3 text-xs leading-5 text-muted">
              {latestSchedule ? (
                <p>
                  <span className="font-semibold text-ink">วันสอบล่าสุด:</span> {latestScheduleRoundLabel} · {latestScheduleDateText || "ยังไม่ระบุวันเวลา"} · {latestSchedule.status}
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
                      {item.result ? `${item.result.submittedCount}/${item.result.evaluatorCount} คน` : "ยังไม่เปิดผล"}
                    </span>
                  </div>
                  {item.result ? (
                    <div className="flex items-center justify-between gap-3">
                      {item.result.showScore ? <p className="mt-1 text-muted">คะแนนเฉลี่ย {formatScore(item.result.averageScore)} / 100</p> : <p className="mt-1 text-muted">ดู comment ได้ คะแนนยังไม่เปิด</p>}
                      <span className="text-xs font-semibold text-brand">ดูรายละเอียด</span>
                    </div>
                  ) : (
                    <p className="mt-1 text-muted">จะแสดง comment/คะแนนเมื่อระบบเปิดผลหรือกรรมการบันทึกตามเงื่อนไข</p>
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
              <div className="text-sm font-semibold">Proposal</div>
              <p className="mt-1 text-sm text-muted">{proposal ? "ส่งข้อมูล Proposal แล้ว" : "ยังไม่ได้ส่ง Proposal"}</p>
            </div>
            <div className="rounded-md border border-line bg-paper p-3">
              <div className="text-sm font-semibold">รายงาน</div>
              <p className="mt-1 text-sm text-muted">{latestReport ? `version ${latestReport.versionNo}` : "ยังไม่มี version รายงาน"}</p>
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
                description="ระบบล็อกไว้จนกว่า lifecycle จะถึงขั้นตอนนั้น"
                actions={workflowActions.locked_future}
                tone="locked"
                emptyText="ไม่มีขั้นตอนที่ล็อกอยู่"
              />
            </div>
            <StudentWorkflowGroup
              title="ประวัติการดำเนินงาน"
              description="รายการที่ทำแล้วหรือดูย้อนหลังได้ ไม่ใช่ action หลัก"
              actions={workflowActions.read_only_history}
              tone="history"
              emptyText="ยังไม่มีประวัติในขั้นก่อนหน้า"
            />
          </div>
        </section>

        <TaskListCard title="รายการที่ต้องติดตาม" tasks={studentTrackingTasks} />
      </div>

      <GuidancePanel
        title="คำแนะนำสำหรับนักศึกษา"
        current="ดูสถานะปัจจุบันและทำรายการที่ระบบแนะนำก่อน"
        next="ระบบจะบันทึกประวัติทุกครั้งเพื่อใช้เป็นหลักฐาน และแจ้งเตือนเมื่อมีผู้เกี่ยวข้องต้องดำเนินการ"
        actor="ขึ้นอยู่กับสถานะ อาจเป็นนักศึกษา อาจารย์ที่ปรึกษา กรรมการ หรือผู้ดูแลระบบ"
      />

      {project.status === "PROPOSAL_REVIEW" ? (
        <InfoAlert title="การแสดงผล Proposal">
          นักศึกษาจะเห็น comment และชื่ออาจารย์ทันที แต่คะแนน Proposal จะไม่แสดงให้นักศึกษาเห็น
        </InfoAlert>
      ) : null}

      <TimelineCard
        title="หลักฐานการดำเนินงานล่าสุด"
        events={project.timelineEvents.map((event) => ({
          id: event.id,
          occurredAt: event.occurredAt,
          eventTitle: event.eventTitle,
          eventDescription: event.eventDescription,
          actorName: event.actor?.name
        }))}
      />
    </div>
  );
}
