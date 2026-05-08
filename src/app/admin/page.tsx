import { auth } from "@/auth";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { CompactMetricRow, DashboardActionQueue, DashboardSectionHeader } from "@/components/ui/DashboardActionQueue";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { CompactLifecycleBadge } from "@/components/ui/LifecycleStepper";
import { NextActionCard } from "@/components/ui/NextActionCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { TaskListCard } from "@/components/ui/TaskListCard";
import { TimelineCard } from "@/components/ui/TimelineCard";
import { WarningAlert, InfoAlert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { ProjectStatus } from "@prisma/client";
import { courseLevelRoundTypes, roundStatusLabelTh, roundTypeLabelTh } from "@/lib/assessments/courseRounds";
import { getRoundEligibility, reasonLabelTh } from "@/lib/assessments/roundEligibility";
import { findDuplicateActiveProjectGroups, getCurrentDashboardProjects } from "@/lib/admin/dashboardProjects";
import { isAdminTestingToolsEnabled } from "@/lib/admin/testingMode";
import { prisma } from "@/lib/db";
import { createNavTimer } from "@/lib/diagnostics/navTiming";
import { getNextActionForAdmin } from "@/lib/lifecycle/nextActions";
import { lifecycleV2Steps, projectStatusLabelTh } from "@/lib/lifecycle/statusLabels";
import { shouldAlertAdminForFailVotes } from "@/lib/lifecycle/transitions";
import { confirmProjectAdvisor, openCourseRound, resetCourseOfferingTestData } from "./actions";

function countFromStatus(statusCounts: Map<ProjectStatus, number>, status: ProjectStatus) {
  return statusCounts.get(status) ?? 0;
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "-";
  return value.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

export default async function AdminDashboardPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const timer = createNavTimer("/admin");
  const authStart = timer.startBlock();
  const session = await auth();
  timer.endBlock("auth_session", authStart);
  const roleStart = timer.startBlock();
  const isNotAdmin = session?.user.role !== "ADMIN";
  timer.endBlock("role_guard", roleStart);
  if (isNotAdmin) {
    timer.end("unauthorized");
    return <div className="panel">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</div>;
  }
  const params = (await searchParams) ?? {};

  const offerings = await timer.measure("course_offerings", () =>
    prisma.courseOffering.findMany({
      select: { id: true, term: { select: { displayName: true } } },
      orderBy: { id: "desc" },
      take: 5
    })
  );
  const dashboardOfferingIds = offerings.map((offering) => offering.id);
  const activeOffering = offerings[0];

  const dashboardQueries = timer.measure("dashboard_queries", () => Promise.all([
    prisma.student.count(),
    prisma.teacherAccountClaim.count({ where: { status: "PENDING" } }),
    prisma.assessmentRound.findMany({
      where: { courseOfferingId: { in: dashboardOfferingIds }, roundType: { in: [...courseLevelRoundTypes] } },
      select: {
        id: true,
        courseOfferingId: true,
        roundType: true,
        status: true,
        submissionOpenAt: true,
        submissionDeadline: true,
        closedAt: true,
        _count: { select: { attempts: true, projectExceptions: true } }
      },
      orderBy: [{ courseOfferingId: "desc" }, { roundType: "asc" }]
    }),
    prisma.project.groupBy({
      by: ["status"],
      _count: { _all: true }
    }),
    prisma.project.findMany({
      select: {
        id: true,
        courseOfferingId: true,
        studentId: true,
        currentTitleTh: true,
        status: true,
        updatedAt: true,
        student: { select: { studentCode: true, firstNameTh: true, lastNameTh: true } },
        proposalVotes: { select: { vote: true } }
      },
      orderBy: { updatedAt: "desc" },
      take: 12
    }),
    prisma.project.findMany({
      where: { status: "PENDING_ADMIN" },
      select: {
        id: true,
        currentTitleTh: true,
        student: { select: { studentCode: true, firstNameTh: true, lastNameTh: true } }
      },
      orderBy: { updatedAt: "desc" },
      take: 12
    }),
    prisma.proposalVote.findMany({
      where: { project: { status: { in: ["PROPOSAL_REVIEW", "PROPOSAL_ADMIN_DECISION"] } } },
      select: { projectId: true, vote: true }
    }),
    prisma.notification.findMany({
      where: { status: "UNREAD" },
      select: { id: true, title: true, body: true },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    prisma.projectTimelineEvent.findMany({
      select: { id: true, occurredAt: true, eventTitle: true, eventDescription: true, actor: { select: { name: true } } },
      orderBy: { occurredAt: "desc" },
      take: 8
    })
  ]));
  const progress1EligibilityQuery = activeOffering
    ? timer.measure("progress1_eligibility", () => getRoundEligibility(activeOffering.id, "PROGRESS_1"))
    : Promise.resolve({ eligible: [], notReady: [] });

  const [
    [students, claims, rounds, statusGroups, rawProjects, pendingAdminProjects, proposalVotesForFailAlert, notifications, timeline],
    progress1Eligibility
  ] = await Promise.all([
    dashboardQueries,
    progress1EligibilityQuery
  ]);

  const duplicateProjectGroups = findDuplicateActiveProjectGroups(rawProjects);
  const projects = getCurrentDashboardProjects(rawProjects);
  const statusCounts = new Map(statusGroups.map((group) => [group.status, group._count._all]));
  const proposalVotesByProject = new Map<string, Array<{ vote: "PASS" | "REVISE" | "FAIL" }>>();
  for (const vote of proposalVotesForFailAlert) {
    proposalVotesByProject.set(vote.projectId, [...(proposalVotesByProject.get(vote.projectId) ?? []), { vote: vote.vote }]);
  }
  const progress1Round = rounds.find((round) => round.courseOfferingId === activeOffering?.id && round.roundType === "PROGRESS_1");
  const proposalRound = rounds.find((round) => round.courseOfferingId === activeOffering?.id && round.roundType === "PROPOSAL");
  const progress1CanOpen = progress1Eligibility.eligible.length > 0 && !["SUBMISSION_OPEN", "SCORING_OPEN"].includes(progress1Round?.status ?? "DRAFT");
  const progress1BlockedReason = progress1Eligibility.notReady.flatMap((item) => item.reasons)[0];
  const testingToolsEnabled = isAdminTestingToolsEnabled();
  const failAlertCount = [...proposalVotesByProject.values()].filter((votes) => shouldAlertAdminForFailVotes(votes)).length;
  const nextActionProjects = [
    ...(pendingAdminProjects.length ? [{ status: "PENDING_ADMIN" as const }] : []),
    ...(failAlertCount ? [{ status: "PROPOSAL_REVIEW" as const, proposalVotes: [{ vote: "FAIL" as const }, { vote: "PASS" as const }] }] : []),
    ...(countFromStatus(statusCounts, "TOPIC_APPROVED") ? [{ status: "TOPIC_APPROVED" as const }] : []),
    ...(countFromStatus(statusCounts, "ADVISOR_SCORING") ? [{ status: "ADVISOR_SCORING" as const }] : []),
    ...(countFromStatus(statusCounts, "REPORT_APPROVED") ? [{ status: "REPORT_APPROVED" as const }] : [])
  ];
  const nextAction = getNextActionForAdmin(nextActionProjects);
  const adminWorkflowCards = [
    { label: "รอ Admin ยืนยัน", value: pendingAdminProjects.length, href: "/admin", tone: pendingAdminProjects.length ? "ready" as const : "quiet" as const },
    { label: "รอตัดสิน Proposal", value: countFromStatus(statusCounts, "PROPOSAL_ADMIN_DECISION"), href: "/admin/proposals", tone: countFromStatus(statusCounts, "PROPOSAL_ADMIN_DECISION") ? "ready" as const : "quiet" as const },
    { label: "รอตั้งกรรมการ", value: countFromStatus(statusCounts, "TOPIC_APPROVED"), href: "/admin/committee", tone: countFromStatus(statusCounts, "TOPIC_APPROVED") ? "waiting" as const : "quiet" as const },
    { label: "รอ Advisor score", value: countFromStatus(statusCounts, "REPORT_APPROVED"), href: "/admin/closeout", tone: countFromStatus(statusCounts, "REPORT_APPROVED") ? "waiting" as const : "quiet" as const },
    { label: "พร้อมตรวจ closeout", value: countFromStatus(statusCounts, "ADVISOR_SCORING"), href: "/admin/closeout", tone: countFromStatus(statusCounts, "ADVISOR_SCORING") ? "complete" as const : "quiet" as const }
  ];
  const adminActionQueue = [
    {
      title: "คำขอผูกบัญชีอาจารย์",
      description: claims ? `${claims} คำขอรอผู้ดูแลระบบอนุมัติก่อนอาจารย์เข้าถึงข้อมูลนักศึกษา` : "ไม่มีคำขอผูกบัญชีอาจารย์ที่รออนุมัติ",
      href: "/admin/claims",
      count: claims,
      tone: claims ? "urgent" as const : "quiet" as const,
      statusLabel: claims ? "ต้องอนุมัติ" : "ปกติ"
    },
    {
      title: "ยืนยันโปรเจคและอาจารย์ที่ปรึกษา",
      description: pendingAdminProjects.length ? "โปรเจคที่ advisor อนุมัติแล้วรอ Admin confirmation" : "ยังไม่มีโปรเจครอ Admin confirmation",
      href: "/admin",
      count: pendingAdminProjects.length,
      tone: pendingAdminProjects.length ? "ready" as const : "quiet" as const,
      statusLabel: pendingAdminProjects.length ? "พร้อมดำเนินการ" : "ปกติ"
    },
    {
      title: "ตัดสินผล Proposal",
      description: "ตรวจคะแนน ความเห็น และผลประชุมก่อนยืนยันผลสุดท้ายของ Proposal",
      href: "/admin/proposals",
      count: countFromStatus(statusCounts, "PROPOSAL_ADMIN_DECISION"),
      tone: countFromStatus(statusCounts, "PROPOSAL_ADMIN_DECISION") || failAlertCount ? "urgent" as const : "quiet" as const,
      statusLabel: failAlertCount ? "มี FAIL ≥ 50%" : "รอตัดสิน"
    },
    {
      title: "แต่งตั้งกรรมการ",
      description: "หัวข้อที่ผ่านแล้วต้องมีกรรมการครบก่อนเข้าสู่รอบ Progress",
      href: "/admin/committee",
      count: countFromStatus(statusCounts, "TOPIC_APPROVED"),
      tone: countFromStatus(statusCounts, "TOPIC_APPROVED") ? "waiting" as const : "quiet" as const,
      statusLabel: "ติดตาม"
    },
    {
      title: "จัดการรอบสอบของรายวิชา",
      description: progress1CanOpen ? "มีโปรเจคพร้อมเปิดรอบ Progress 1" : "ตรวจสถานะ Proposal, Progress 1, Progress 2 และ Final Presentation",
      href: "/admin/rounds",
      count: rounds.length,
      tone: progress1CanOpen ? "ready" as const : "quiet" as const,
      statusLabel: progress1CanOpen ? "เปิดรอบได้" : "ดูรอบสอบ"
    },
    {
      title: "ตรวจ closeout / completion",
      description: "ตรวจเงื่อนไขก่อนเปลี่ยนโปรเจคเป็น COMPLETED โดย Admin เท่านั้น",
      href: "/admin/closeout",
      count: countFromStatus(statusCounts, "ADVISOR_SCORING"),
      tone: countFromStatus(statusCounts, "ADVISOR_SCORING") ? "complete" as const : "quiet" as const,
      statusLabel: "completion"
    }
  ];
  timer.end();

  return (
    <div className="space-y-4">
      <PageHeader
        title="แดชบอร์ดผู้ดูแลระบบ"
        description="ติดตาม lifecycle ทั้งระบบ ยืนยันโปรเจค จัดการ Proposal แต่งตั้งกรรมการ และดูหลักฐานล่าสุด"
        actions={
          <>
            <span
              className={`inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm ${
                testingToolsEnabled ? "badge-warn" : "badge-lock"
              }`}
            >
              โหมดทดสอบ: {testingToolsEnabled ? "เปิด" : "ปิด"}
            </span>
            <a className="button-secondary" href="/admin/teachers">จัดการอาจารย์</a>
          </>
        }
      />
      <ActionFeedback success={params.success} error={params.error} />
      {testingToolsEnabled && activeOffering ? (
        <WarningAlert title="โหมดทดสอบระบบเปิดอยู่">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              ใช้สำหรับช่วงลองระบบเท่านั้น ปุ่มนี้จะล้าง course offering ปัจจุบันพร้อมข้อมูลนิสิต/โปรเจค/รอบสอบ/คะแนน/รายงานที่ผูกกับรายวิชานี้ แล้วให้เริ่ม import ใหม่
            </p>
            <form action={resetCourseOfferingTestData}>
              <input type="hidden" name="course_offering_id" value={activeOffering.id} />
              <SubmitButton
                className="button-secondary"
                pendingText="กำลังล้างข้อมูล..."
                confirmMessage={`ยืนยันล้างข้อมูลทดสอบของ ${activeOffering.term.displayName} หรือไม่? ใช้เฉพาะช่วงทดสอบก่อนใช้งานจริง`}
              >
                ล้างข้อมูลทดสอบรายวิชานี้
              </SubmitButton>
            </form>
          </div>
        </WarningAlert>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <DashboardActionQueue
          title="งานที่ต้องดำเนินการ"
          description="รายการที่ต้องกดต่อ พิจารณา หรือยืนยันก่อน lifecycle จะเดินต่อ"
          items={adminActionQueue}
          mobilePrimaryCount={3}
          mobileSummaryLabel="งานติดตามของผู้ดูแลระบบ"
        />
        <div className="space-y-3">
          <NextActionCard action={nextAction} />
          <section className="panel dashboard-console-panel">
            <DashboardSectionHeader title="งานที่ต้องติดตาม" description="สัญญาณที่ไม่จำเป็นต้องกดทันที แต่ควรเห็นก่อนลงรายละเอียด" />
            <div className="mt-4 space-y-2 text-sm">
              <a className="flex items-center justify-between gap-3 rounded-lg border border-line bg-paperSoft p-3" href="/admin/proposals">
                <span>Proposal รอประเมิน</span>
                <span className="font-semibold tabular-nums text-ink">{countFromStatus(statusCounts, "PROPOSAL_REVIEW")}</span>
              </a>
              <a className="flex items-center justify-between gap-3 rounded-lg border border-line bg-paperSoft p-3" href="/admin">
                <span>โปรเจครอที่ปรึกษา</span>
                <span className="font-semibold tabular-nums text-ink">{countFromStatus(statusCounts, "PENDING_ADVISOR")}</span>
              </a>
              <a className="flex items-center justify-between gap-3 rounded-lg border border-line bg-paperSoft p-3" href="/admin/students">
                <span>นักศึกษาทั้งหมด</span>
                <span className="font-semibold tabular-nums text-ink">{students}</span>
              </a>
            </div>
          </section>
        </div>
      </div>
      <GuidancePanel
        title="คำแนะนำสำหรับผู้ดูแลระบบ"
        current="ตรวจรายการค้าง เช่น Admin confirmation, Proposal decision, teacher claims และ committee assignment"
        next="ระบบไม่ตัดสินผล Proposal อัตโนมัติ ผู้ดูแลระบบต้องยืนยันผลสุดท้ายด้วยตนเอง"
        actor="ผู้ดูแลระบบเป็นผู้ยืนยันขั้นสำคัญและดูแลหลักฐาน"
      />
      {failAlertCount ? (
        <WarningAlert title="มี Proposal ที่ FAIL ≥ 50%">
          กรุณาตรวจ vote และ comment อย่างละเอียดก่อนตัดสินผลสุดท้าย
        </WarningAlert>
      ) : null}
      <CompactMetricRow
        title="ภาพรวมสถานะ"
        description="ตัวเลขสนับสนุนสำหรับดู bottleneck ของ lifecycle โดยไม่แย่งความสำคัญจาก action queue"
        metrics={adminWorkflowCards}
      />
      <section className="panel dashboard-console-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">รอบสอบของรายวิชา</h2>
            <p className="mt-1 text-sm text-muted">
              Proposal: {roundStatusLabelTh(proposalRound?.status ?? "DRAFT")} · Progress 1: {roundStatusLabelTh(progress1Round?.status ?? "DRAFT")} · Progress 2 / Final ตามลำดับถัดไป
            </p>
            <p className="mt-2 text-sm">
              ขั้นตอนถัดไป: ตัดสินผล Proposal / แต่งตั้งกรรมการ / เปิดรอบ Progress 1
            </p>
            {!progress1CanOpen && progress1BlockedReason ? (
              <p className="mt-1 text-sm text-amber-700">{reasonLabelTh(progress1BlockedReason)}</p>
            ) : !progress1CanOpen && !progress1Eligibility.eligible.length ? (
              <p className="mt-1 text-sm text-amber-700">ยังไม่มี project ที่พร้อมเข้าสู่ Progress 1</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {progress1CanOpen && activeOffering ? (
              <form action={openCourseRound}>
                <input type="hidden" name="course_offering_id" value={activeOffering.id} />
                <input type="hidden" name="round_type" value="PROGRESS_1" />
                <SubmitButton pendingText="กำลังเปิดรอบ...">เปิดรอบ Progress 1</SubmitButton>
              </form>
            ) : null}
            <a className="button-secondary" href="/admin/rounds">จัดการรอบสอบ</a>
          </div>
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <section className="panel dashboard-console-panel">
          <h2 className="text-lg font-semibold">Pending Admin confirmation</h2>
          <p className="mt-1 text-sm text-muted">เมื่อยืนยันแล้วสถานะจะเปลี่ยนเป็น PROPOSAL_PENDING</p>
          <div className="mt-3 space-y-3">
            {pendingAdminProjects.length ? pendingAdminProjects.map((project) => (
              <form key={project.id} action={confirmProjectAdvisor} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line p-3">
                <input type="hidden" name="project_id" value={project.id} />
                <div>
                  <div className="font-medium">{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</div>
                  <div className="text-sm text-muted">
                    {project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}
                  </div>
                </div>
                <SubmitButton pendingText="กำลังยืนยัน...">ยืนยันโปรเจคและอาจารย์ที่ปรึกษา</SubmitButton>
              </form>
            )) : (
              <EmptyState title="ยังไม่มี project รอ Admin ยืนยัน" description="เมื่อ advisor อนุมัติแล้ว รายการจะแสดงที่นี่" />
            )}
          </div>
        </section>
        <TaskListCard
          title="ทางลัดปฏิบัติการ"
          compact
          tasks={[
            { title: "รอบสอบของรายวิชา", description: `${rounds.length} รอบแบบ course-level`, href: "/admin/rounds" },
            { title: "Course offering", description: `${offerings.length} รายวิชา/ภาคเรียน`, href: "/admin/import-students" },
            { title: "ปิดงานโครงงาน", description: "ตรวจสอบเงื่อนไขครบก่อนเปลี่ยนเป็น COMPLETED", href: "/admin/closeout" }
          ]}
        />
      </div>
      {process.env.NODE_ENV !== "production" && duplicateProjectGroups.length ? (
        <WarningAlert title="พบข้อมูล demo ซ้ำ กรุณารันคำสั่ง reset demo data">
          ใช้คำสั่ง <code>cmd /c npm.cmd run dev:reset-demo</code> เพื่อล้างเฉพาะข้อมูล demo/E2E บนฐานข้อมูล local และ seed demo ใหม่
        </WarningAlert>
      ) : null}
      {process.env.NEXT_PUBLIC_SHOW_LEGACY_ROUND_CARDS === "1" ? (
      <section className="panel dashboard-console-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">รอบสอบของรายวิชา</h2>
            <p className="mt-1 text-sm text-muted">Proposal, Progress 1, Progress 2 และ Final Presentation เป็นรอบระดับรายวิชา ไม่ใช่รอบแยกต่อโปรเจค</p>
          </div>
          <a href="/admin/proposals" className="btn-secondary">ดูรอบ Proposal</a>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {rounds.map((round) => {
            const attemptCount = round._count.attempts;
            const exceptionCount = round._count.projectExceptions;
            return (
              <div key={round.id} className="rounded-md border border-line p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">{roundTypeLabelTh(round.roundType)}</div>
                  <span className="inline-flex items-center rounded-full border border-line px-3 py-1 text-xs font-semibold">{roundStatusLabelTh(round.status)}</span>
                </div>
                <dl className="mt-3 space-y-1 text-sm text-muted">
                  <div className="flex justify-between gap-3"><dt>เปิด</dt><dd>{formatDate(round.submissionOpenAt)}</dd></div>
                  <div className="flex justify-between gap-3"><dt>ปิด</dt><dd>{round.closedAt ? formatDate(round.closedAt) : formatDate(round.submissionDeadline)}</dd></div>
                  <div className="flex justify-between gap-3"><dt>attempt ทั้งหมด</dt><dd>{attemptCount}</dd></div>
                  <div className="flex justify-between gap-3"><dt>มีปัญหาเฉพาะราย</dt><dd>{exceptionCount}</dd></div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-secondary" disabled>เปิดรอบ</button>
                  <button className="btn-secondary" disabled>ปิดรอบ</button>
                  <button className="btn-secondary" disabled>ดูโปรเจคที่มีปัญหา</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      ) : null}
      <section className="panel dashboard-console-panel">
        <h2 className="text-lg font-semibold">Project status overview</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {lifecycleV2Steps.map((status) => {
            const items = projects.filter((project) => project.status === status);
            const count = countFromStatus(statusCounts, status);
            return (
                <div key={status} className="rounded-lg border border-line bg-surface p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{projectStatusLabelTh(status)}</span>
                  <span className="rounded-full border border-line bg-paperSoft px-2 py-0.5 text-xs font-semibold">{count}</span>
                </div>
                <div className="mt-2 space-y-1">
                  {items.slice(0, 3).map((project) => (
                    <div key={project.id} className="flex flex-col gap-2 rounded-md border border-line bg-paperSoft p-2 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
                      <span>{project.student.studentCode} {project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</span>
                      <CompactLifecycleBadge status={project.status} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="panel">
        <h2 className="text-lg font-semibold">Notification ที่ต้องติดตาม</h2>
        <div className="mt-3 space-y-2">
          {notifications.length ? notifications.map((notification) => (
            <div key={notification.id} className="rounded-md border border-line p-3 text-sm">
              <div className="font-medium">{notification.title}</div>
              {notification.body ? <p className="mt-1 text-muted">{notification.body}</p> : null}
            </div>
          )) : <InfoAlert title="ยังไม่มี notification">เมื่อมีคำเตือนหรือรายการต้องติดตาม ระบบจะแสดงที่นี่</InfoAlert>}
        </div>
      </section>
      <TimelineCard
        title="หลักฐานล่าสุด"
        events={timeline.map((event) => ({
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
