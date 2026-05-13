import Link from "next/link";
import type { ComponentProps } from "react";
import type { AssessmentRoundType, AssessmentStatus, CommitteeRole, ScoreStatus } from "@prisma/client";
import { auth } from "@/auth";
import { hasApprovedTeacherCapability, isPendingTeacherClaim } from "@/lib/auth/capabilities";
import { CompactMetricRow, DashboardActionQueue, DashboardSectionHeader, type DashboardActionQueueItem } from "@/components/ui/DashboardActionQueue";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { NextActionCard } from "@/components/ui/NextActionCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { TaskListCard, type TaskListItem } from "@/components/ui/TaskListCard";
import { TeacherWorkloadSummary, type TeacherWorkloadMetric } from "@/components/ui/TeacherWorkloadQueue";
import { WarningAlert, InfoAlert } from "@/components/ui/Alert";
import { FigmaMetricCard, FigmaPageHeader, FigmaPanel, FigmaStatusBadge } from "@/components/redesign/VisualSurfaces";
import { prisma } from "@/lib/db";
import { createNavTimer } from "@/lib/diagnostics/navTiming";
import { formatThaiScheduleRange } from "@/lib/format/dateTime";
import { getNextActionForTeacher } from "@/lib/lifecycle/nextActions";
import { LATE_ROUND_EXCEPTION_TYPE, LATE_ROUND_EXCUSED_EXCEPTION_TYPE } from "@/lib/assessments/roundExceptions";
import { teacherDisplayName } from "@/lib/teachers/displayName";
import { getUiMode } from "@/lib/uiMode";
import { openProposalScoring } from "./actions";

function assessmentKindLabel(kind?: string | null) {
  if (kind === "PROGRESS_1") return "การสอบความก้าวหน้าครั้งที่ 1";
  if (kind === "PROGRESS_2") return "การสอบความก้าวหน้าครั้งที่ 2";
  if (kind === "FINAL_PRESENT") return "การสอบนำเสนอขั้นสุดท้าย";
  return "รอบสอบ";
}

function teacherRoleBadgeLabel(role: CommitteeRole | "ADVISOR") {
  if (role === "ADVISOR") return "อาจารย์ที่ปรึกษา";
  if (role === "HEAD") return "ประธานกรรมการ";
  if (role === "MEMBER") return "กรรมการ";
  return role;
}

async function getTeacherWorkloadCounts(teacherId: string) {
  const openScoringRoundStatuses: AssessmentStatus[] = ["SUBMISSION_OPEN", "SCORING_OPEN"];
  const scoringCommitteeRoles: CommitteeRole[] = ["HEAD", "MEMBER"];
  const submittedScoreStatus: ScoreStatus = "SUBMITTED";
  const teacherProjectInvolvementWhere = {
    OR: [
      { project: { committeeAssignments: { some: { teacherId, active: true } } } },
      { project: { advisorRequests: { some: { advisorTeacherId: teacherId, status: "APPROVED" as const } } } }
    ]
  };
  const teacherReportProjectWhere = {
    OR: [
      { committeeAssignments: { some: { teacherId, active: true, role: { in: scoringCommitteeRoles } } } },
      { advisorRequests: { some: { advisorTeacherId: teacherId, status: "APPROVED" as const } } }
    ]
  };
  const readyScoreWhere = (assessmentKind: "PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENT") => {
    const roundType: AssessmentRoundType = assessmentKind === "FINAL_PRESENT" ? "FINAL_PRESENTATION" : assessmentKind;
    return ({
    status: "CONFIRMED" as const,
    assessmentKind,
    assessmentRound: { status: { in: openScoringRoundStatuses } },
    project: {
      status: "IN_PROGRESS" as const,
      committeeAssignments: { some: { teacherId, active: true, role: { in: scoringCommitteeRoles } } },
      NOT: {
        attempts: {
          some: {
            assessmentRound: { roundType },
            evaluatorAssignments: {
              some: {
                teacherId,
                scoreSubmission: { is: { status: submittedScoreStatus } }
              }
            }
          }
        }
      }
    }
    });
  };

  const [
    advisorRequestCount,
    scheduleApprovalCount,
    reportReviewProjects,
    advisorScoreProjectCount,
    progress1ScoreReadyCount,
    progress2ScoreReadyCount,
    finalScoreReadyCount,
    confirmedScheduleCalendarCount
  ] = await Promise.all([
    prisma.advisorRequest.count({ where: { advisorTeacherId: teacherId, status: "PENDING" } }),
    prisma.examScheduleProposal.count({
      where: {
        status: "PROPOSED",
        assessmentRound: { status: { in: ["SUBMISSION_OPEN", "SCORING_OPEN"] } },
        OR: [
          { approvals: { some: { teacherId, decision: "PENDING" } } },
          { project: { committeeAssignments: { some: { teacherId, active: true, role: { in: ["ADVISOR", "HEAD", "MEMBER"] } } } } },
          { project: { advisorRequests: { some: { advisorTeacherId: teacherId, status: "APPROVED" } } } }
        ],
        NOT: { approvals: { some: { teacherId, decision: { in: ["APPROVE", "REJECT"] } } } }
      }
    }),
    prisma.project.findMany({
      where: {
        status: "REPORT_REVIEW",
        ...teacherReportProjectWhere
      },
      select: {
        reportVersions: {
          orderBy: { versionNo: "desc" },
          take: 1,
          select: {
            id: true,
            reviews: {
              select: { id: true, reviewerTeacherId: true, decision: true }
            }
          }
        }
      }
    }),
    prisma.project.count({
      where: {
        status: "REPORT_APPROVED",
        OR: [
          { advisorRequests: { some: { advisorTeacherId: teacherId, status: "APPROVED" } } },
          { committeeAssignments: { some: { teacherId, active: true, role: "ADVISOR" } } }
        ]
      }
    }),
    prisma.examScheduleProposal.count({ where: readyScoreWhere("PROGRESS_1") }),
    prisma.examScheduleProposal.count({ where: readyScoreWhere("PROGRESS_2") }),
    prisma.examScheduleProposal.count({ where: readyScoreWhere("FINAL_PRESENT") }),
    prisma.examScheduleProposal.count({
      where: {
        status: "CONFIRMED",
        ...teacherProjectInvolvementWhere
      }
    })
  ]);
  const reportReviewCount = reportReviewProjects.filter((project) => {
    const latestReport = project.reportVersions[0];
    if (!latestReport) return false;
    if (latestReport.reviews.some((review) => review.decision === "FAIL")) return false;
    return !latestReport.reviews.some((review) => review.reviewerTeacherId === teacherId);
  }).length;

  return [
    advisorRequestCount,
    scheduleApprovalCount,
    reportReviewCount,
    advisorScoreProjectCount,
    progress1ScoreReadyCount,
    progress2ScoreReadyCount,
    finalScoreReadyCount,
    confirmedScheduleCalendarCount
  ] as const;
}

type TeacherDashboardTeacher = {
  academicPrefix: string;
  firstNameTh: string;
  lastNameTh: string;
  email: string | null;
};

type TeacherDashboardStudent = {
  studentCode: string;
  firstNameTh: string;
  lastNameTh: string;
};

type TeacherDashboardSchedule = {
  id: string;
  assessmentKind: string | null;
  proposedStartAt: Date;
  proposedEndAt: Date | null;
  room: string | null;
  project: {
    currentTitleTh: string | null;
    student: TeacherDashboardStudent;
    committeeAssignments: Array<{ role: CommitteeRole }>;
    advisorRequests: Array<{ id: string }>;
  };
};

type TeacherDashboardAttempt = {
  id: string;
  presentationSubmission: { titleTh: string | null } | null;
  project: { student: TeacherDashboardStudent };
  evaluatorAssignments: Array<{
    id: string;
    scoreSubmission: { status: ScoreStatus } | null;
  }>;
};

type TeacherDashboardNotification = {
  id: string;
  title: string;
  body: string | null;
};

type TeacherDashboardMetricCard = {
  label: string;
  value: number;
  href: string;
  tone?: "urgent" | "ready" | "waiting" | "complete" | "quiet";
};

type TeacherDashboardViewProps = {
  teacher: TeacherDashboardTeacher;
  teacherWorkloadSummaryMetrics: TeacherWorkloadMetric[];
  activeTeacherActionQueue: DashboardActionQueueItem[];
  teacherNextAction: ComponentProps<typeof NextActionCard>["action"];
  ownConfirmedScheduleAgenda: TeacherDashboardSchedule[];
  workloadCards: TeacherDashboardMetricCard[];
  attempts: TeacherDashboardAttempt[];
  teacherWorkspaceTasks: TaskListItem[];
  notifications: TeacherDashboardNotification[];
  teacherActionableTaskCount: number;
  submittedScoreStatus: ScoreStatus;
};

function figmaMetricTone(tone?: TeacherDashboardMetricCard["tone"]): ComponentProps<typeof FigmaMetricCard>["tone"] {
  if (tone === "urgent" || tone === "ready") return "action";
  if (tone === "waiting") return "warning";
  if (tone === "complete") return "success";
  return "muted";
}

function FigmaTeacherDashboardView({
  teacher,
  teacherWorkloadSummaryMetrics,
  activeTeacherActionQueue,
  teacherNextAction,
  ownConfirmedScheduleAgenda,
  workloadCards,
  attempts,
  teacherWorkspaceTasks,
  notifications,
  teacherActionableTaskCount,
  submittedScoreStatus
}: TeacherDashboardViewProps) {
  const totalWorkload = workloadCards.reduce((sum, card) => sum + card.value, 0);
  const needsAction = teacherWorkloadSummaryMetrics.find((metric) => metric.tone === "action")?.count ?? 0;

  return (
    <div className="figma-dashboard-page figma-teacher-dashboard">
      <FigmaPageHeader
        eyebrow="พื้นที่ทำงานอาจารย์"
        title="แดชบอร์ดอาจารย์"
        description="รวมงานที่ต้องดำเนินการ ตารางสอบ งานตรวจรายงาน และสถานะที่เกี่ยวข้อง โดยแยกงานเร่งด่วนออกจากงานติดตามให้สแกนได้เร็วขึ้น"
      />

      <div className="figma-kpi-grid">
        <FigmaMetricCard label="ต้องทำตอนนี้" value={needsAction} description="งานที่ต้องตอบรับ ประเมิน ตรวจ หรือยืนยัน" tone="action" />
        <FigmaMetricCard label="งานทั้งหมด" value={totalWorkload} description="สัญญาณรวมจากบทบาทของอาจารย์ในระบบ" tone="muted" />
        {teacherWorkloadSummaryMetrics.slice(1, 5).map((metric) => (
          <FigmaMetricCard
            key={metric.label}
            label={metric.label}
            value={metric.count}
            description={metric.description}
            tone={metric.tone === "completed" ? "success" : metric.tone === "returned" ? "warning" : metric.tone === "action" ? "action" : "muted"}
          />
        ))}
      </div>

      <div className="figma-dashboard-grid">
        <FigmaPanel
          title="งานที่ต้องดำเนินการ"
          description="จัดลำดับจากงานที่ต้องเปิดต่อหรือต้องพิจารณาก่อน"
          tone={activeTeacherActionQueue.some((item) => (item.count ?? 0) > 0) ? "action" : "muted"}
        >
          <div className="figma-action-list">
            {activeTeacherActionQueue.map((item) => (
              <Link key={`${item.title}-${item.href}-figma`} href={item.href} className="figma-action-row" data-tone={figmaMetricTone(item.tone)}>
                <div className="min-w-0">
                  <div className="figma-action-title">
                    <span>{item.title}</span>
                    <FigmaStatusBadge tone={figmaMetricTone(item.tone)}>
                      {item.statusLabel ?? (item.count && item.count > 0 ? "ต้องดำเนินการ" : "ติดตาม")}
                    </FigmaStatusBadge>
                  </div>
                  <p>{item.description}</p>
                  {item.meta ? <small>{item.meta}</small> : null}
                </div>
                <div className="figma-action-side">
                  {typeof item.count === "number" ? <strong>{item.count}</strong> : null}
                  <span>{item.ctaLabel ?? "เปิดงานนี้"}</span>
                </div>
              </Link>
            ))}
          </div>
        </FigmaPanel>

        <div className="figma-side-stack">
          <NextActionCard action={teacherNextAction} />
          <FigmaPanel title="บัญชีและบทบาท" description="ทางลัดไปยังงานหลักของอาจารย์" tone="muted">
            <p className="text-sm leading-6 text-muted">{teacherDisplayName(teacher)} · {teacher.email ?? "ยังไม่ได้ผูกอีเมล"}</p>
            <div className="mt-3 grid gap-2 text-sm">
              <Link className="button-secondary justify-start" href="/teacher/proposals">ประเมินการเสนอหัวข้อ</Link>
              <Link className="button-secondary justify-start" href="/teacher/reports">ตรวจเล่ม</Link>
              <Link className="button-secondary justify-start" href="/teacher/advisor-score">คะแนนสรุปของอาจารย์ที่ปรึกษา 25%</Link>
            </div>
          </FigmaPanel>
        </div>
      </div>

      <div className="figma-review-layout">
        <FigmaPanel
          title="ตารางสอบของท่าน"
          description="เรียงตามวันเวลา พร้อมบทบาทของอาจารย์ในแต่ละโครงงาน"
          tone={ownConfirmedScheduleAgenda.length ? "success" : "muted"}
        >
          <div className="figma-schedule-list">
            {ownConfirmedScheduleAgenda.length ? ownConfirmedScheduleAgenda.map((schedule) => {
              const roles = Array.from(new Set([
                ...schedule.project.committeeAssignments.map((assignment) => assignment.role),
                ...(schedule.project.advisorRequests.length ? ["ADVISOR" as const] : [])
              ]));
              return (
                <Link key={`${schedule.id}-figma-schedule`} className="figma-schedule-row" href="/teacher/schedules">
                  <div>
                    <strong>{assessmentKindLabel(schedule.assessmentKind)}</strong>
                    <p>
                      {schedule.project.student.studentCode} {schedule.project.student.firstNameTh} {schedule.project.student.lastNameTh}
                    </p>
                    {schedule.project.currentTitleTh ? <small>{schedule.project.currentTitleTh}</small> : null}
                  </div>
                  <div className="figma-schedule-meta">
                    <span>{formatThaiScheduleRange(schedule.proposedStartAt, schedule.proposedEndAt)}</span>
                    {schedule.room ? <small>ห้อง {schedule.room}</small> : null}
                    <div>
                      {roles.map((role) => (
                        <FigmaStatusBadge key={`${schedule.id}-${role}-figma`} tone="muted">{teacherRoleBadgeLabel(role)}</FigmaStatusBadge>
                      ))}
                    </div>
                  </div>
                </Link>
              );
            }) : (
              <p className="text-sm text-muted">ยังไม่มีตารางสอบที่ยืนยันแล้วสำหรับโครงงานที่ท่านเกี่ยวข้อง</p>
            )}
          </div>
          <Link className="button-secondary mt-3 inline-flex" href="/teacher/schedules">ดูตารางสอบทั้งหมด</Link>
        </FigmaPanel>

        <FigmaPanel
          title="เอกสารเสนอหัวข้อที่เกี่ยวข้อง"
          description="คงลิงก์และฟอร์มประเมินเดิม แต่จัดแถวให้สแกนง่ายขึ้น"
          tone={attempts.length ? "action" : "muted"}
        >
          <div className="figma-attempt-list">
            {attempts.length ? attempts.map((attempt) => {
              const assignment = attempt.evaluatorAssignments[0];
              const assignmentSubmitted = assignment?.scoreSubmission?.status === submittedScoreStatus;
              return (
                <div key={`${attempt.id}-figma-attempt`} className="figma-attempt-row">
                  <div>
                    <strong>{attempt.presentationSubmission?.titleTh ?? "ยังไม่มีชื่อหัวข้อ"}</strong>
                    <p>
                      {attempt.project.student.studentCode} {attempt.project.student.firstNameTh} {attempt.project.student.lastNameTh}
                    </p>
                  </div>
                  {assignmentSubmitted ? (
                    <Link className="button-secondary" href={`/teacher/scoring/${assignment.id}`}>ดูผลประเมินที่ส่งแล้ว</Link>
                  ) : assignment ? (
                    <Link className="button" href={`/teacher/scoring/${assignment.id}`}>ประเมินการเสนอหัวข้อ</Link>
                  ) : (
                    <form action={openProposalScoring}>
                      <input type="hidden" name="attempt_id" value={attempt.id} />
                      <button type="submit">เริ่มประเมิน</button>
                    </form>
                  )}
                </div>
              );
            }) : (
              <EmptyState title="ยังไม่มีเอกสารเสนอหัวข้อที่ส่งแล้ว" description="เมื่อมีนักศึกษาส่งเอกสารเสนอหัวข้อ รายการจะแสดงที่นี่" />
            )}
          </div>
        </FigmaPanel>
      </div>

      <div className="figma-dashboard-grid">
        <TaskListCard title="ทางลัดการทำงาน" compact tasks={teacherWorkspaceTasks} />
        <FigmaPanel title="การแจ้งเตือน" tone={teacherActionableTaskCount ? "action" : "muted"}>
          <div className="figma-notification-list">
            {notifications.length ? notifications.map((notification) => (
              <div key={`${notification.id}-figma-notification`} className="rounded-md border border-line p-3 text-sm">
                <div className="font-medium">{notification.title}</div>
                {notification.body ? <p className="mt-1 text-muted">{notification.body}</p> : null}
              </div>
            )) : teacherActionableTaskCount ? (
              <InfoAlert title={`มีงานที่ต้องดำเนินการ ${teacherActionableTaskCount} รายการ`}>
                ตรวจรายละเอียดในส่วนงานที่ต้องดำเนินการด้านบน ระบบนับจากคำขอที่ปรึกษา งานประเมิน ตารางสอบ งานตรวจรายงาน และคะแนนที่ปรึกษาที่รอท่านดำเนินการ
              </InfoAlert>
            ) : (
              <InfoAlert title="ยังไม่มีงานที่ต้องดำเนินการ">งานใหม่จะแสดงใน dashboard และ route ย่อยตามบทบาท</InfoAlert>
            )}
          </div>
        </FigmaPanel>
      </div>
    </div>
  );
}

export default async function TeacherDashboardPage() {
  const timer = createNavTimer("/teacher");
  const authStart = timer.startBlock();
  const session = await auth();
  timer.endBlock("auth_session", authStart);
  const capabilityStart = timer.startBlock();
  const pendingTeacher = isPendingTeacherClaim(session?.user);
  const approvedTeacher = hasApprovedTeacherCapability(session?.user);
  timer.endBlock("capability_check", capabilityStart);
  if (pendingTeacher) {
    timer.end("pending_teacher");
    return (
      <div className="space-y-6">
        <PageHeader title="รอผู้ดูแลระบบอนุมัติ" description="คำขอผูกบัญชีของท่านอยู่ระหว่างรอผู้ดูแลระบบอนุมัติ" />
        <WarningAlert title="ยังไม่สามารถเข้าถึงข้อมูลนักศึกษา">
          ก่อนอนุมัติบัญชี อาจารย์จะยังไม่เห็นข้อมูลนักศึกษาและหน้าประเมิน
        </WarningAlert>
        <Link className="button" href="/teacher/claim">เลือกโปรไฟล์อาจารย์</Link>
      </div>
    );
  }
  if (!approvedTeacher || !session?.user.id) {
    timer.end("unauthorized");
    return <div className="panel">หน้านี้สำหรับอาจารย์ที่อนุมัติแล้วเท่านั้น</div>;
  }

  const sessionTeacherId = session.user.teacherId ?? null;
  const teacherWhere = sessionTeacherId ? { id: sessionTeacherId } : { userId: session.user.id };
  const teacherQuery = timer.measure("teacher_identity_query", () =>
    prisma.teacher.findUnique({
      where: teacherWhere,
      select: { id: true, academicPrefix: true, firstNameTh: true, lastNameTh: true, email: true }
    })
  );
  const independentTeacherQueries = timer.measure("teacher_independent_queries", () => Promise.all([
    prisma.assessmentAttempt.findMany({
      where: {
        presentationSubmission: { status: { in: ["SUBMITTED", "LOCKED"] } },
        proposalResult: { is: null },
        OR: [
          { assessmentRound: { roundType: "PROPOSAL", status: "SCORING_OPEN" } },
          {
            assessmentRound: { roundType: "PROPOSAL" },
            project: {
              roundExceptions: {
                some: {
                  status: "OPEN",
                  exceptionType: { in: [LATE_ROUND_EXCEPTION_TYPE, LATE_ROUND_EXCUSED_EXCEPTION_TYPE] },
                  assessmentRound: { roundType: "PROPOSAL" }
                }
              }
            }
          }
        ]
      },
      select: {
        id: true,
        presentationSubmission: { select: { titleTh: true } },
        project: { select: { student: { select: { studentCode: true, firstNameTh: true, lastNameTh: true } } } },
        evaluatorAssignments: {
          where: { evaluatorUserId: session.user.id },
          select: { id: true, scoreSubmission: { select: { status: true } } }
        }
      },
      take: 8
    }),
    prisma.notification.findMany({
      where: { userId: session.user.id, status: "UNREAD" },
      select: { id: true, title: true, body: true },
      orderBy: { createdAt: "desc" },
      take: 5
    })
  ]));
  const sessionTeacherWorkloadQuery = sessionTeacherId
    ? timer.measure("teacher_workload_queries", () => getTeacherWorkloadCounts(sessionTeacherId))
    : null;

  const [teacher, [attempts, notifications]] = await Promise.all([teacherQuery, independentTeacherQueries]);

  if (!teacher) {
    timer.end("missing_teacher_profile");
    return <EmptyState title="ยังไม่พบโปรไฟล์อาจารย์" description="กรุณาส่งคำขอผูกบัญชีอาจารย์ก่อนใช้งาน" actionLabel="ผูกบัญชีอาจารย์" href="/teacher/claim" />;
  }

  const [
    advisorRequestCount,
    scheduleApprovalCount,
    reportReviewCount,
    advisorScoreProjectCount,
    progress1ScoreReadyCount,
    progress2ScoreReadyCount,
    finalScoreReadyCount,
    confirmedScheduleCalendarCount
  ] = await (
    sessionTeacherWorkloadQuery ?? timer.measure("teacher_workload_queries", () => getTeacherWorkloadCounts(teacher.id))
  );
  const presentationScoreReadyCount = progress1ScoreReadyCount + progress2ScoreReadyCount + finalScoreReadyCount;
  const submittedScoreStatus: ScoreStatus = "SUBMITTED";
  const nextConfirmedScoringSchedule = presentationScoreReadyCount
    ? await prisma.examScheduleProposal.findFirst({
        where: {
          status: "CONFIRMED",
          assessmentRound: { status: { in: ["SUBMISSION_OPEN", "SCORING_OPEN"] } },
          OR: [
            {
              assessmentKind: "PROGRESS_1",
              project: {
                status: "IN_PROGRESS",
                committeeAssignments: { some: { teacherId: teacher.id, active: true, role: { in: ["HEAD", "MEMBER"] } } },
                NOT: { attempts: { some: { assessmentRound: { roundType: "PROGRESS_1" }, evaluatorAssignments: { some: { teacherId: teacher.id, scoreSubmission: { is: { status: submittedScoreStatus } } } } } } }
              }
            },
            {
              assessmentKind: "PROGRESS_2",
              project: {
                status: "IN_PROGRESS",
                committeeAssignments: { some: { teacherId: teacher.id, active: true, role: { in: ["HEAD", "MEMBER"] } } },
                NOT: { attempts: { some: { assessmentRound: { roundType: "PROGRESS_2" }, evaluatorAssignments: { some: { teacherId: teacher.id, scoreSubmission: { is: { status: submittedScoreStatus } } } } } } }
              }
            },
            {
              assessmentKind: "FINAL_PRESENT",
              project: {
                status: "IN_PROGRESS",
                committeeAssignments: { some: { teacherId: teacher.id, active: true, role: { in: ["HEAD", "MEMBER"] } } },
                NOT: { attempts: { some: { assessmentRound: { roundType: "FINAL_PRESENTATION" }, evaluatorAssignments: { some: { teacherId: teacher.id, scoreSubmission: { is: { status: submittedScoreStatus } } } } } } }
              }
            }
          ]
        },
        select: {
          assessmentKind: true,
          proposedStartAt: true,
          proposedEndAt: true,
          room: true,
          project: { select: { student: { select: { studentCode: true, firstNameTh: true, lastNameTh: true } } } }
        },
        orderBy: { proposedStartAt: "asc" }
      })
    : null;
  const ownConfirmedScheduleAgenda = await prisma.examScheduleProposal.findMany({
    where: {
      status: "CONFIRMED",
      OR: [
        { project: { committeeAssignments: { some: { teacherId: teacher.id, active: true } } } },
        { project: { advisorRequests: { some: { advisorTeacherId: teacher.id, status: "APPROVED" } } } }
      ]
    },
    select: {
      id: true,
      assessmentKind: true,
      proposedStartAt: true,
      proposedEndAt: true,
      room: true,
      project: {
        select: {
          currentTitleTh: true,
          student: { select: { studentCode: true, firstNameTh: true, lastNameTh: true } },
          committeeAssignments: {
            where: { teacherId: teacher.id, active: true },
            select: { role: true }
          },
          advisorRequests: {
            where: { advisorTeacherId: teacher.id, status: "APPROVED" },
            select: { id: true }
          }
        }
      }
    },
    orderBy: { proposedStartAt: "asc" },
    take: 8
  });
  const pendingProposalScores = attempts.filter((attempt) => !attempt.evaluatorAssignments[0]?.scoreSubmission || attempt.evaluatorAssignments[0].scoreSubmission?.status !== "SUBMITTED");
  const teacherActionableTaskCount =
    advisorRequestCount +
    pendingProposalScores.length +
    scheduleApprovalCount +
    presentationScoreReadyCount +
    reportReviewCount +
    advisorScoreProjectCount;
  const nextAction = getNextActionForTeacher({
    pendingAdvisorRequests: advisorRequestCount,
    pendingProposalScores: pendingProposalScores.length,
    pendingScheduleApprovals: scheduleApprovalCount,
    pendingReportReviews: reportReviewCount,
    progress1ScoreReady: progress1ScoreReadyCount,
    progress2ScoreReady: progress2ScoreReadyCount,
    finalScoreReady: finalScoreReadyCount,
    advisorScoreUnlocked: advisorScoreProjectCount > 0
  });
  const teacherNextAction = nextConfirmedScoringSchedule
    ? {
        ...nextAction,
        description: `${assessmentKindLabel(nextConfirmedScoringSchedule.assessmentKind)} · ${formatThaiScheduleRange(nextConfirmedScoringSchedule.proposedStartAt, nextConfirmedScoringSchedule.proposedEndAt)}${nextConfirmedScoringSchedule.room ? ` · ห้อง ${nextConfirmedScoringSchedule.room}` : ""} · ${nextConfirmedScoringSchedule.project.student.studentCode} ${nextConfirmedScoringSchedule.project.student.firstNameTh} ${nextConfirmedScoringSchedule.project.student.lastNameTh}`
      }
    : nextAction;
  const workloadCards = [
    { label: "คำขอที่ปรึกษา", value: advisorRequestCount, href: "/teacher/advisor-requests", tone: advisorRequestCount ? "ready" as const : "quiet" as const },
    { label: "เสนอหัวข้อรอประเมิน", value: pendingProposalScores.length, href: "/teacher/proposals", tone: pendingProposalScores.length ? "ready" as const : "quiet" as const },
    { label: "ตารางสอบรออนุมัติ", value: scheduleApprovalCount, href: "/teacher/schedules", tone: scheduleApprovalCount ? "waiting" as const : "quiet" as const },
    { label: "พร้อมให้คะแนน", value: presentationScoreReadyCount, href: progress1ScoreReadyCount ? "/teacher/progress1" : progress2ScoreReadyCount ? "/teacher/progress2" : "/teacher/final", tone: presentationScoreReadyCount ? "ready" as const : "quiet" as const },
    { label: "งานตรวจรายงาน", value: reportReviewCount, href: "/teacher/reports", tone: reportReviewCount ? "waiting" as const : "quiet" as const },
    { label: "คะแนนที่ปรึกษา", value: advisorScoreProjectCount, href: "/teacher/advisor-score", tone: advisorScoreProjectCount ? "complete" as const : "quiet" as const }
  ];
  const teacherWorkloadSummaryMetrics = [
    { label: "ต้องดำเนินการ", count: teacherActionableTaskCount, tone: "action" as const, description: "งานที่รอให้อาจารย์ตอบรับ ตรวจ ประเมิน หรือให้คะแนน" },
    { label: "รอ", count: 0, tone: "waiting" as const, description: "งานที่รอคนอื่นดำเนินการจะไม่ปนกับงานที่ต้องทำ" },
    { label: "เสร็จแล้ว", count: confirmedScheduleCalendarCount, tone: "completed" as const, description: "รายการที่ยืนยันแล้วหรือใช้ดูประกอบการวางแผน" },
    { label: "ส่งกลับ", count: 0, tone: "returned" as const, description: "รายการที่ต้องรอนักศึกษาส่งใหม่จะแยกจากงานหลัก" },
    { label: "ล็อก/ไม่เกี่ยวข้อง", count: 0, tone: "locked" as const, description: "สิ่งที่ยังไม่เปิดหรือไม่ใช่บทบาทของท่านจะไม่แสดงเป็นงาน" }
  ];
  const teacherActionQueue = [
    {
      title: "ตารางสอบที่ยืนยันแล้ว",
      description: confirmedScheduleCalendarCount ? "ดูวัน เวลา ห้องสอบ และรายชื่อนักศึกษาที่มีกำหนดสอบยืนยันแล้ว" : "ยังไม่มีตารางสอบที่กรรมการยืนยันครบ",
      href: "/teacher/schedules",
      count: confirmedScheduleCalendarCount,
      tone: confirmedScheduleCalendarCount ? "complete" as const : "quiet" as const,
      statusLabel: confirmedScheduleCalendarCount ? "ดูตาราง" : "ยังไม่มี"
    },
    {
      title: "คำขอที่ปรึกษา",
      description: advisorRequestCount ? "นักศึกษารออาจารย์พิจารณารับเป็นที่ปรึกษา" : "ยังไม่มีคำขอที่ปรึกษาที่รอดำเนินการ",
      href: "/teacher/advisor-requests",
      count: advisorRequestCount,
      tone: advisorRequestCount ? "urgent" as const : "quiet" as const,
      statusLabel: advisorRequestCount ? "ต้องตอบรับ" : "ปกติ"
    },
    {
      title: "เอกสารเสนอหัวข้อรอประเมิน",
      description: pendingProposalScores.length ? "มีเอกสารเสนอหัวข้อที่ได้รับมอบหมายและยังไม่ได้บันทึกคะแนน" : "ยังไม่มีเอกสารเสนอหัวข้อที่ต้องประเมินตอนนี้",
      href: "/teacher/proposals",
      count: pendingProposalScores.length,
      tone: pendingProposalScores.length ? "ready" as const : "quiet" as const,
      statusLabel: pendingProposalScores.length ? "พร้อมประเมิน" : "ปกติ"
    },
    {
      title: "อนุมัติวันสอบ",
      description: scheduleApprovalCount ? "มีตารางสอบที่รอการยืนยันจากอาจารย์" : "ยังไม่มีตารางสอบรออนุมัติ",
      href: "/teacher/schedules",
      count: scheduleApprovalCount,
      tone: scheduleApprovalCount ? "waiting" as const : "quiet" as const,
      statusLabel: "รออนุมัติ"
    },
    {
      title: "ตรวจรายงานฉบับสมบูรณ์",
      description: reportReviewCount ? "มีรายงานที่ต้องตรวจหรือรอการแก้ไขตามข้อเสนอแนะ" : "ยังไม่มีงานตรวจรายงานที่ต้องดำเนินการตอนนี้",
      href: "/teacher/reports",
      count: reportReviewCount,
      tone: reportReviewCount ? "waiting" as const : "quiet" as const,
      statusLabel: "ติดตาม"
    },
    {
      title: "คะแนนสรุปของอาจารย์ที่ปรึกษา 25%",
      description: advisorScoreProjectCount ? "มีโครงงานที่พร้อมให้บันทึกคะแนนสรุปของอาจารย์ที่ปรึกษา" : "ยังไม่มีโครงงานที่พร้อมบันทึกคะแนนสรุปของอาจารย์ที่ปรึกษา",
      href: "/teacher/advisor-score",
      count: advisorScoreProjectCount,
      tone: advisorScoreProjectCount ? "complete" as const : "quiet" as const,
      statusLabel: "คะแนนที่ปรึกษา"
    },
    {
      title: "คะแนนการสอบความก้าวหน้าครั้งที่ 1",
      description: progress1ScoreReadyCount ? "วันสอบความก้าวหน้าครั้งที่ 1 ได้รับการยืนยันครบแล้ว พร้อมให้กรรมการบันทึกคะแนนหลังสอบ" : "จะแสดงเป็นงานเร่งด่วนเมื่อกรรมการอนุมัติวันสอบความก้าวหน้าครั้งที่ 1 ครบ",
      href: "/teacher/progress1",
      count: progress1ScoreReadyCount,
      tone: progress1ScoreReadyCount ? "ready" as const : "quiet" as const,
      statusLabel: progress1ScoreReadyCount ? "พร้อมให้คะแนน" : "รอวันสอบยืนยัน"
    },
    {
      title: "คะแนนการสอบความก้าวหน้าครั้งที่ 2",
      description: progress2ScoreReadyCount ? "วันสอบความก้าวหน้าครั้งที่ 2 ได้รับการยืนยันครบแล้ว พร้อมให้กรรมการบันทึกคะแนนหลังสอบ" : "จะแสดงเป็นงานเร่งด่วนเมื่อกรรมการอนุมัติวันสอบความก้าวหน้าครั้งที่ 2 ครบ",
      href: "/teacher/progress2",
      count: progress2ScoreReadyCount,
      tone: progress2ScoreReadyCount ? "ready" as const : "quiet" as const,
      statusLabel: progress2ScoreReadyCount ? "พร้อมให้คะแนน" : "รอวันสอบยืนยัน"
    },
    {
      title: "คะแนนการสอบนำเสนอขั้นสุดท้าย",
      description: finalScoreReadyCount ? "วันสอบนำเสนอขั้นสุดท้ายได้รับการยืนยันครบแล้ว พร้อมให้กรรมการบันทึกคะแนนหลังสอบ" : "จะแสดงเป็นงานเร่งด่วนเมื่อกรรมการอนุมัติวันสอบนำเสนอขั้นสุดท้ายครบ",
      href: "/teacher/final",
      count: finalScoreReadyCount,
      tone: finalScoreReadyCount ? "ready" as const : "quiet" as const,
      statusLabel: finalScoreReadyCount ? "พร้อมให้คะแนน" : "รอวันสอบยืนยัน"
    }
  ];
  const activeTeacherActionQueue = teacherActionQueue.filter((item) =>
    !["/teacher/progress1", "/teacher/progress2", "/teacher/final"].includes(item.href) || (item.count ?? 0) > 0
  );
  const teacherWorkspaceTasks = [
    { title: "คำขอที่ปรึกษา", description: `${advisorRequestCount} รายการรออนุมัติ`, href: "/teacher/advisor-requests", urgency: advisorRequestCount ? "สูง" : "ปกติ" },
    ...(progress1ScoreReadyCount ? [{ title: "คะแนนความก้าวหน้าครั้งที่ 1", description: `${progress1ScoreReadyCount} รายการพร้อมให้คะแนน`, href: "/teacher/progress1", urgency: "พร้อมให้คะแนน" }] : []),
    ...(progress2ScoreReadyCount ? [{ title: "คะแนนความก้าวหน้าครั้งที่ 2", description: `${progress2ScoreReadyCount} รายการพร้อมให้คะแนน`, href: "/teacher/progress2", urgency: "พร้อมให้คะแนน" }] : []),
    ...(finalScoreReadyCount ? [{ title: "คะแนนสอบนำเสนอขั้นสุดท้าย", description: `${finalScoreReadyCount} รายการพร้อมให้คะแนน`, href: "/teacher/final", urgency: "พร้อมให้คะแนน" }] : []),
    { title: "ตารางสอบ", description: `${confirmedScheduleCalendarCount} รายการยืนยันแล้ว`, href: "/teacher/schedules", urgency: confirmedScheduleCalendarCount ? "ดูตาราง" : "ปกติ" }
  ];
  timer.end();

  const uiMode = await getUiMode();
  const teacherDashboardViewProps: TeacherDashboardViewProps = {
    teacher,
    teacherWorkloadSummaryMetrics,
    activeTeacherActionQueue,
    teacherNextAction,
    ownConfirmedScheduleAgenda,
    workloadCards,
    attempts,
    teacherWorkspaceTasks,
    notifications,
    teacherActionableTaskCount,
    submittedScoreStatus
  };

  if (uiMode === "figma") {
    return <FigmaTeacherDashboardView {...teacherDashboardViewProps} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="แดชบอร์ดอาจารย์"
        description="รวมคำขอที่ปรึกษา งานประเมินการเสนอหัวข้อ ตารางสอบ และงานตรวจรายงานที่เกี่ยวข้อง"
      />
      <TeacherWorkloadSummary metrics={teacherWorkloadSummaryMetrics} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <DashboardActionQueue
          title="งานที่ต้องดำเนินการ"
          description="รวมงานที่อาจารย์ต้องตอบรับ ประเมิน ตรวจ หรือยืนยันตามบทบาทที่มีอยู่ในระบบ"
          items={activeTeacherActionQueue}
          mobilePrimaryCount={4}
          mobileSummaryLabel="งานติดตามอื่น"
        />
        <div className="space-y-3">
          <NextActionCard action={teacherNextAction} />
          <section className="panel dashboard-console-panel">
            <DashboardSectionHeader
              title="ตารางสอบของท่าน"
              description="เรียงตามวันเวลา สำหรับโครงงานที่ท่านเป็นที่ปรึกษา ประธานกรรมการ หรือกรรมการ"
            />
            <div className="mt-3 space-y-2">
              {ownConfirmedScheduleAgenda.length ? ownConfirmedScheduleAgenda.map((schedule) => {
                const roles = Array.from(new Set([
                  ...schedule.project.committeeAssignments.map((assignment) => assignment.role),
                  ...(schedule.project.advisorRequests.length ? ["ADVISOR" as const] : [])
                ]));
                return (
                  <Link key={schedule.id} className="block rounded-md border border-line bg-surface p-3 text-sm hover:border-brand" href="/teacher/schedules">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{assessmentKindLabel(schedule.assessmentKind)}</div>
                        <div className="mt-1 text-muted">
                          {schedule.project.student.studentCode} {schedule.project.student.firstNameTh} {schedule.project.student.lastNameTh}
                        </div>
                        {schedule.project.currentTitleTh ? <div className="mt-1 text-xs text-muted">{schedule.project.currentTitleTh}</div> : null}
                      </div>
                      <div className="text-right font-semibold text-ink">
                        {formatThaiScheduleRange(schedule.proposedStartAt, schedule.proposedEndAt)}
                        {schedule.room ? <div className="text-xs text-muted">ห้อง {schedule.room}</div> : null}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {roles.map((role) => (
                        <span key={`${schedule.id}-${role}`} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">{teacherRoleBadgeLabel(role)}</span>
                      ))}
                    </div>
                  </Link>
                );
              }) : (
                <p className="text-sm text-muted">ยังไม่มีตารางสอบที่ยืนยันแล้วสำหรับโครงงานที่ท่านเกี่ยวข้อง</p>
              )}
            </div>
            <Link className="button-secondary mt-3 inline-flex" href="/teacher/schedules">ดูตารางสอบทั้งหมด</Link>
          </section>
          <section className="panel dashboard-console-panel">
            <DashboardSectionHeader title="บัญชีและบทบาท" description="ทางลัดไปยังหน้าการทำงานของอาจารย์โดยไม่เปลี่ยนสิทธิ์หรือขั้นตอนเดิม" />
            <p className="mt-4 text-sm leading-6 text-muted">{teacherDisplayName(teacher)} · {teacher.email ?? "ยังไม่ได้ผูกอีเมล"}</p>
            <div className="mt-3 grid gap-2 text-sm">
              <Link className="button-secondary justify-start" href="/teacher/proposals">ประเมินการเสนอหัวข้อ</Link>
              <Link className="button-secondary justify-start" href="/teacher/reports">ตรวจเล่ม</Link>
              <Link className="button-secondary justify-start" href="/teacher/advisor-score">คะแนนสรุปของอาจารย์ที่ปรึกษา 25%</Link>
            </div>
          </section>
        </div>
      </div>
      <GuidancePanel
        title="คำแนะนำสำหรับอาจารย์"
        current="ตรวจงานที่ต้องดำเนินการและอ่านเอกสารแนบก่อนตัดสินใจ"
        next="ระบบจะแสดงข้อเสนอแนะให้นักศึกษาทันที แต่ซ่อนคะแนนการเสนอหัวข้อจากนักศึกษา"
        actor="อาจารย์ที่ปรึกษา ประธานกรรมการ กรรมการ หรือผู้ตรวจรายงานตามบทบาทของท่าน"
      />
      <CompactMetricRow
        title="ภาพรวมสถานะ"
        description={`รวม ${workloadCards.reduce((sum, card) => sum + card.value, 0)} รายการจากข้อมูลของอาจารย์ ใช้เป็นสัญญาณประกอบจากงานหลักด้านบน`}
        metrics={workloadCards}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <section className="panel dashboard-console-panel">
          <h2 className="text-lg font-semibold">เอกสารเสนอหัวข้อที่เกี่ยวข้อง</h2>
          <div className="mt-3 space-y-3">
            {attempts.length ? (
              attempts.map((attempt) => {
                const assignment = attempt.evaluatorAssignments[0];
                const assignmentSubmitted = assignment?.scoreSubmission?.status === submittedScoreStatus;
                return (
                  <div key={attempt.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line p-3">
                    <div>
                      <div className="font-medium">{attempt.presentationSubmission?.titleTh ?? "ยังไม่มีชื่อหัวข้อ"}</div>
                      <div className="text-sm text-muted">
                        {attempt.project.student.studentCode} {attempt.project.student.firstNameTh} {attempt.project.student.lastNameTh}
                      </div>
                    </div>
                    {assignmentSubmitted ? (
                      <Link className="button-secondary" href={`/teacher/scoring/${assignment.id}`}>ดูผลประเมินที่ส่งแล้ว</Link>
                    ) : assignment ? (
                      <Link className="button" href={`/teacher/scoring/${assignment.id}`}>ประเมินการเสนอหัวข้อ</Link>
                    ) : (
                      <form action={openProposalScoring}>
                        <input type="hidden" name="attempt_id" value={attempt.id} />
                        <button type="submit">เริ่มประเมิน</button>
                      </form>
                    )}
                  </div>
                );
              })
            ) : (
              <EmptyState title="ยังไม่มีเอกสารเสนอหัวข้อที่ส่งแล้ว" description="เมื่อมีนักศึกษาส่งเอกสารเสนอหัวข้อ รายการจะแสดงที่นี่" />
            )}
          </div>
        </section>
        <TaskListCard
          title="ทางลัดการทำงาน"
          compact
          tasks={teacherWorkspaceTasks}
        />
      </div>
      <section className="panel dashboard-console-panel">
        <h2 className="text-lg font-semibold">การแจ้งเตือน</h2>
        <div className="mt-3 space-y-2">
          {notifications.length ? notifications.map((notification) => (
            <div key={notification.id} className="rounded-md border border-line p-3 text-sm">
              <div className="font-medium">{notification.title}</div>
              {notification.body ? <p className="mt-1 text-muted">{notification.body}</p> : null}
            </div>
          )) : teacherActionableTaskCount ? (
            <InfoAlert title={`มีงานที่ต้องดำเนินการ ${teacherActionableTaskCount} รายการ`}>
              ตรวจรายละเอียดในส่วนงานที่ต้องดำเนินการด้านบน ระบบนับจากคำขอที่ปรึกษา งานประเมิน ตารางสอบ งานตรวจรายงาน และคะแนนที่ปรึกษาที่รอท่านดำเนินการ
            </InfoAlert>
          ) : (
            <InfoAlert title="ยังไม่มีงานที่ต้องดำเนินการ">งานใหม่จะแสดงใน dashboard และ route ย่อยตามบทบาท</InfoAlert>
          )}
        </div>
      </section>
    </div>
  );
}
