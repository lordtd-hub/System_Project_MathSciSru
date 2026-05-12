import Link from "next/link";
import { Suspense } from "react";
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
import { WarningAlert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { ProjectStatus } from "@prisma/client";
import { courseLevelRoundTypes, isRoundClosed, isRoundOpen, roundStatusLabelTh, roundTypeLabelTh, type CourseLevelRoundType } from "@/lib/assessments/courseRounds";
import { getRoundEligibility, reasonLabelTh } from "@/lib/assessments/roundEligibility";
import { getRoundOpenGate, roundSequenceReasonLabelTh } from "@/lib/assessments/roundSequence";
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

function deriveAdminCurrentRoundFocus({
  currentOpenRoundType,
  focusRoundType,
  canOpenNextRound,
  progress1EligibleCount
}: {
  currentOpenRoundType?: CourseLevelRoundType | null;
  focusRoundType: CourseLevelRoundType;
  canOpenNextRound: boolean;
  progress1EligibleCount: number;
}) {
  const activeRoundType = currentOpenRoundType ?? focusRoundType;
  const activeRoundLabel = roundTypeLabelTh(activeRoundType);
  const openNextLabel = roundTypeLabelTh(focusRoundType);
  const focusItems = {
    PROPOSAL: [
      { title: "ตรวจผลการเสนอหัวข้อและผลประชุม", description: "ดูคะแนน ความเห็น และบันทึกผลพิจารณาสุดท้ายของการเสนอหัวข้อ", href: "/admin/proposals" },
      { title: "เตรียมแต่งตั้งกรรมการ", description: "หัวข้อที่ผ่านแล้วต้องมีกรรมการครบก่อนเข้าสู่การสอบความก้าวหน้า", href: "/admin/committee" }
    ],
    PROGRESS_1: [
      { title: "ติดตามตารางสอบความก้าวหน้าครั้งที่ 1", description: "ดูการเสนอวันสอบ การตอบรับของกรรมการ และงานที่รอบันทึกคะแนน", href: "/admin/schedules" },
      { title: "ดูความพร้อมสอบความก้าวหน้าครั้งที่ 1", description: `${progress1EligibleCount} โครงงานพร้อมเข้าสู่การสอบความก้าวหน้าครั้งที่ 1 ตามเงื่อนไขปัจจุบัน`, href: "/admin/rounds" }
    ],
    PROGRESS_2: [
      { title: "ติดตามตารางสอบความก้าวหน้าครั้งที่ 2", description: "ดูการเสนอวันสอบ การตอบรับของกรรมการ และงานที่รอบันทึกคะแนน", href: "/admin/schedules" },
      { title: "เตรียมรอบสอบขั้นสุดท้าย", description: "หลังปิดการสอบความก้าวหน้าครั้งที่ 2 ให้เปิดรอบสอบนำเสนอขั้นสุดท้ายตามลำดับรายวิชา", href: "/admin/rounds" }
    ],
    FINAL_PRESENTATION: [
      { title: "ติดตามตารางสอบนำเสนอขั้นสุดท้าย", description: "ดูวันสอบที่ยืนยันแล้วและงานบันทึกคะแนนการสอบนำเสนอขั้นสุดท้าย", href: "/admin/schedules" },
      { title: "เตรียมตรวจรายงานและยืนยันจบโครงงาน", description: "หลังการสอบขั้นสุดท้ายเสร็จสิ้น ให้ติดตามการตรวจรายงาน คะแนนสรุปของอาจารย์ที่ปรึกษา และการยืนยันจบโครงงาน", href: "/admin/closeout" }
    ]
  } satisfies Record<CourseLevelRoundType, Array<{ title: string; description: string; href: string }>>;

  return {
    title: currentOpenRoundType ? `กำลังอยู่ในรอบ ${activeRoundLabel}` : `โฟกัสถัดไป: ${openNextLabel}`,
    description: currentOpenRoundType
      ? "แดชบอร์ดควรให้ความสำคัญกับงานของรอบที่กำลังเปิดอยู่ก่อนงานติดตามทั่วไป"
      : canOpenNextRound
        ? `ยังไม่มีรอบที่เปิดอยู่ ขั้นตอนถัดไปคือเปิดรอบ ${openNextLabel}`
        : `ยังไม่มีรอบที่เปิดอยู่ และ ${openNextLabel} ยังไม่พร้อมเปิดตามลำดับการดำเนินงาน`,
    items: focusItems[activeRoundType]
  };
}

function getAdminStatusGroups() {
  return prisma.project.groupBy({
    by: ["status"],
    _count: { _all: true }
  });
}

function getRecentAdminProjects() {
  return prisma.project.findMany({
    select: {
      id: true,
      courseOfferingId: true,
      studentId: true,
      currentTitleTh: true,
      status: true,
      updatedAt: true,
      student: { select: { studentCode: true, firstNameTh: true, lastNameTh: true } }
    },
    orderBy: { updatedAt: "desc" },
    take: 12
  });
}

function getUnreadAdminNotifications() {
  return prisma.notification.findMany({
    where: { status: "UNREAD" },
    select: { id: true, title: true, body: true },
    orderBy: { createdAt: "desc" },
    take: 5
  });
}

function getLatestAdminTimelineEvents() {
  return prisma.projectTimelineEvent.findMany({
    select: { id: true, occurredAt: true, eventTitle: true, eventDescription: true, actor: { select: { name: true } } },
    orderBy: { occurredAt: "desc" },
    take: 8
  });
}

function DashboardSectionSkeleton({ title }: { title: string }) {
  return (
    <section className="panel dashboard-console-panel" aria-busy="true">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="h-4 w-40 rounded bg-line" />
          <div className="mt-2 h-3 w-64 max-w-full rounded bg-paperSoft" />
        </div>
        <div className="h-7 w-16 rounded-full bg-paperSoft" />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="h-20 rounded-lg border border-line bg-paperSoft" />
        <div className="h-20 rounded-lg border border-line bg-paperSoft" />
      </div>
      <span className="sr-only">{title}</span>
    </section>
  );
}

function RoundGateSkeleton() {
  return (
    <section className="panel dashboard-console-panel" aria-busy="true">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="h-4 w-44 rounded bg-line" />
          <p className="mt-2 text-sm text-muted">กำลังตรวจสอบสถานะรอบสอบ...</p>
        </div>
        <div className="h-8 w-28 rounded-md bg-paperSoft" />
      </div>
      <div className="mt-3 h-12 rounded-lg border border-line bg-paperSoft" />
    </section>
  );
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

  const offeringsQuery = timer.measure("course_offerings", () =>
    prisma.courseOffering.findMany({
      select: { id: true, term: { select: { displayName: true } } },
      orderBy: { id: "desc" },
      take: 5
    })
  );
  const statusGroupsQuery = timer.measure("admin_status_groups", getAdminStatusGroups);
  const recentProjectsQuery = timer.measure("admin_recent_projects", getRecentAdminProjects);
  const notificationsQuery = timer.measure("admin_notifications", getUnreadAdminNotifications);
  const timelineQuery = timer.measure("admin_timeline", getLatestAdminTimelineEvents);
  const independentDashboardQueries = timer.measure("admin_independent_queries", () => Promise.all([
    prisma.student.count(),
    prisma.teacherAccountClaim.count({ where: { status: "PENDING" } }),
    statusGroupsQuery,
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
    prisma.assessmentAttempt.count({
      where: {
        assessmentRound: { roundType: "PROPOSAL" },
        proposalResult: null,
        evaluatorAssignments: {
          some: {
            status: "SUBMITTED",
            scoreSubmission: { status: "SUBMITTED" }
          }
        }
      }
    })
  ]));

  const [
    offerings,
    [students, claims, statusGroups, pendingAdminProjects, proposalVotesForFailAlert, proposalDecisionReadyCount]
  ] = await Promise.all([offeringsQuery, independentDashboardQueries]);

  const dashboardOfferingIds = offerings.map((offering) => offering.id);
  const activeOffering = offerings[0];

  const statusCounts = new Map(statusGroups.map((group) => [group.status, group._count._all]));
  const proposalVotesByProject = new Map<string, Array<{ vote: "PASS" | "REVISE" | "FAIL" }>>();
  for (const vote of proposalVotesForFailAlert) {
    proposalVotesByProject.set(vote.projectId, [...(proposalVotesByProject.get(vote.projectId) ?? []), { vote: vote.vote }]);
  }
  const testingToolsEnabled = isAdminTestingToolsEnabled();
  const failAlertCount = [...proposalVotesByProject.values()].filter((votes) => shouldAlertAdminForFailVotes(votes)).length;
  const nextActionProjects = [
    ...(pendingAdminProjects.length ? [{ status: "PENDING_ADMIN" as const }] : []),
    ...(proposalDecisionReadyCount ? [{ status: "PROPOSAL_ADMIN_DECISION" as const }] : []),
    ...(failAlertCount ? [{ status: "PROPOSAL_REVIEW" as const, proposalVotes: [{ vote: "FAIL" as const }, { vote: "PASS" as const }] }] : []),
    ...(countFromStatus(statusCounts, "TOPIC_APPROVED") ? [{ status: "TOPIC_APPROVED" as const }] : []),
    ...(countFromStatus(statusCounts, "ADVISOR_SCORING") ? [{ status: "ADVISOR_SCORING" as const }] : []),
    ...(countFromStatus(statusCounts, "REPORT_APPROVED") ? [{ status: "REPORT_APPROVED" as const }] : [])
  ];
  const nextAction = getNextActionForAdmin(nextActionProjects);
  const adminWorkflowCards = [
    { label: "รอผู้ดูแลระบบยืนยัน", value: pendingAdminProjects.length, href: "#pending-admin-confirmation", tone: pendingAdminProjects.length ? "ready" as const : "quiet" as const },
    { label: "รอตัดสินผลเสนอหัวข้อ", value: proposalDecisionReadyCount, href: "/admin/proposals", tone: proposalDecisionReadyCount ? "ready" as const : "quiet" as const },
    { label: "รอตั้งกรรมการ", value: countFromStatus(statusCounts, "TOPIC_APPROVED"), href: "/admin/committee", tone: countFromStatus(statusCounts, "TOPIC_APPROVED") ? "waiting" as const : "quiet" as const },
    { label: "รอคะแนนที่ปรึกษา", value: countFromStatus(statusCounts, "REPORT_APPROVED"), href: "/admin/closeout", tone: countFromStatus(statusCounts, "REPORT_APPROVED") ? "waiting" as const : "quiet" as const },
    { label: "พร้อมยืนยันจบโครงงาน", value: countFromStatus(statusCounts, "ADVISOR_SCORING"), href: "/admin/closeout", tone: countFromStatus(statusCounts, "ADVISOR_SCORING") ? "complete" as const : "quiet" as const }
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
      title: "ยืนยันโครงงานและอาจารย์ที่ปรึกษา",
      description: pendingAdminProjects.length ? "โครงงานที่อาจารย์ที่ปรึกษาอนุมัติแล้ว รอผู้ดูแลระบบยืนยัน" : "ยังไม่มีโครงงานที่รอผู้ดูแลระบบยืนยัน",
      href: "#pending-admin-confirmation",
      ctaLabel: pendingAdminProjects.length ? "ไปยืนยัน" : "ดูรายการ",
      count: pendingAdminProjects.length,
      tone: pendingAdminProjects.length ? "ready" as const : "quiet" as const,
      statusLabel: pendingAdminProjects.length ? "พร้อมดำเนินการ" : "ปกติ"
    },
    {
      title: "ตัดสินผลการเสนอหัวข้อ",
      description: "ตรวจคะแนน ความเห็น และผลประชุมก่อนยืนยันผลสุดท้ายของการเสนอหัวข้อ",
      href: "/admin/proposals",
      count: proposalDecisionReadyCount,
      tone: proposalDecisionReadyCount || failAlertCount ? "urgent" as const : "quiet" as const,
      statusLabel: proposalDecisionReadyCount ? "ต้องบันทึกผลพิจารณา" : failAlertCount ? "มีผลไม่ผ่านตั้งแต่ 50%" : "รอตัดสิน"
    },
    {
      title: "แต่งตั้งกรรมการ",
      description: "หัวข้อที่ผ่านแล้วต้องมีกรรมการครบก่อนเข้าสู่รอบสอบความก้าวหน้า",
      href: "/admin/committee",
      count: countFromStatus(statusCounts, "TOPIC_APPROVED"),
      tone: countFromStatus(statusCounts, "TOPIC_APPROVED") ? "waiting" as const : "quiet" as const,
      statusLabel: "ติดตาม"
    },
    {
      title: "จัดการรอบสอบของรายวิชา",
      description: "ตรวจสถานะการเสนอหัวข้อ การสอบความก้าวหน้าครั้งที่ 1 ครั้งที่ 2 และการสอบขั้นสุดท้าย",
      href: "/admin/rounds",
      tone: "quiet" as const,
      statusLabel: "ดูรอบสอบ"
    },
    {
      title: "ยืนยันจบโครงงาน",
      description: "ตรวจเงื่อนไขครบถ้วนก่อนยืนยันว่าโครงงานเสร็จสมบูรณ์โดยผู้ดูแลระบบเท่านั้น",
      href: "/admin/closeout",
      count: countFromStatus(statusCounts, "ADVISOR_SCORING"),
      tone: countFromStatus(statusCounts, "ADVISOR_SCORING") ? "complete" as const : "quiet" as const,
      statusLabel: "ตรวจเงื่อนไข"
    }
  ];
  timer.end("admin_first_render");

  return (
    <div className="space-y-4">
      <PageHeader
        title="แดชบอร์ดผู้ดูแลระบบ"
        description="ติดตามขั้นตอนโครงงานทั้งระบบ ยืนยันโครงงาน จัดการการเสนอหัวข้อ แต่งตั้งกรรมการ และดูหลักฐานล่าสุด"
        actions={
          <>
            <span
              className={`inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm ${
                testingToolsEnabled ? "badge-warn" : "badge-lock"
              }`}
            >
              โหมดทดสอบ: {testingToolsEnabled ? "เปิด" : "ปิด"}
            </span>
            <Link className="button-secondary" href="/admin/evidence">หลักฐานและ AUN-QA</Link>
            <Link className="button-secondary" href="/admin/teachers">จัดการอาจารย์</Link>
          </>
        }
      />
      <ActionFeedback success={params.success} error={params.error} />
      {testingToolsEnabled && activeOffering ? (
        <WarningAlert title="โหมดทดสอบระบบเปิดอยู่">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              ใช้สำหรับช่วงทดสอบระบบเท่านั้น ปุ่มนี้จะล้างรายวิชาปัจจุบันพร้อมข้อมูลนักศึกษา/โครงงาน/รอบสอบ/คะแนน/รายงานที่ผูกกับรายวิชานี้ แล้วให้เริ่มนำเข้าข้อมูลใหม่
            </p>
            <p className="text-sm text-amber-800">
              หมายเหตุ: ข้อมูล Legacy QA อาจยังปรากฏในภาพรวมบางส่วนเพื่อรักษาประวัติการทดสอบเดิม โปรดใช้ชื่อชุดข้อมูล MULTI-PILOT-R2 เมื่อตรวจผลรอบปัจจุบัน
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
          description="รายการที่ต้องกดต่อ พิจารณา หรือยืนยันก่อนขั้นตอนโครงงานจะดำเนินต่อ"
          items={adminActionQueue}
          mobilePrimaryCount={3}
          mobileSummaryLabel="งานติดตามของผู้ดูแลระบบ"
        />
        <div className="space-y-3">
          <NextActionCard action={nextAction} />
          <section className="panel dashboard-console-panel">
            <DashboardSectionHeader title="งานที่ต้องติดตาม" description="สัญญาณที่ไม่จำเป็นต้องกดทันที แต่ควรเห็นก่อนลงรายละเอียด" />
            <div className="mt-4 space-y-2 text-sm">
              <Link className="flex items-center justify-between gap-3 rounded-lg border border-line bg-paperSoft p-3" href="/admin/proposals">
                <span>การเสนอหัวข้อรอประเมิน</span>
                <span className="font-semibold tabular-nums text-ink">{countFromStatus(statusCounts, "PROPOSAL_REVIEW")}</span>
              </Link>
              <Link className="flex items-center justify-between gap-3 rounded-lg border border-line bg-paperSoft p-3" href="/admin">
                <span>โครงงานรออาจารย์ที่ปรึกษา</span>
                <span className="font-semibold tabular-nums text-ink">{countFromStatus(statusCounts, "PENDING_ADVISOR")}</span>
              </Link>
              <Link className="flex items-center justify-between gap-3 rounded-lg border border-line bg-paperSoft p-3" href="/admin/students">
                <span>นักศึกษาทั้งหมด</span>
                <span className="font-semibold tabular-nums text-ink">{students}</span>
              </Link>
              <Link className="flex items-center justify-between gap-3 rounded-lg border border-line bg-paperSoft p-3" href="/admin/evidence">
                <span>หลักฐานและ AUN-QA</span>
                <span className="text-xs font-semibold text-muted">CSV</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
      <GuidancePanel
        title="คำแนะนำสำหรับผู้ดูแลระบบ"
        current="ตรวจรายการค้าง เช่น การยืนยันโครงงาน การตัดสินผลเสนอหัวข้อ คำขอผูกบัญชีอาจารย์ และการแต่งตั้งกรรมการ"
        next="ระบบไม่ตัดสินผลการเสนอหัวข้ออัตโนมัติ ผู้ดูแลระบบต้องยืนยันผลสุดท้ายด้วยตนเอง"
        actor="ผู้ดูแลระบบเป็นผู้ยืนยันขั้นสำคัญและดูแลหลักฐาน"
      />
      {failAlertCount ? (
        <WarningAlert title="มีเอกสารเสนอหัวข้อที่มีผลไม่ผ่านตั้งแต่ 50%">
          กรุณาตรวจผลพิจารณาและข้อเสนอแนะอย่างละเอียดก่อนตัดสินผลสุดท้าย
        </WarningAlert>
      ) : null}
      <CompactMetricRow
        title="ภาพรวมสถานะ"
        description="ตัวเลขสนับสนุนสำหรับดูจุดค้างของขั้นตอนโครงงาน โดยไม่แย่งความสำคัญจากงานที่ต้องดำเนินการ"
        metrics={adminWorkflowCards}
      />
      <Suspense fallback={<RoundGateSkeleton />}>
        <AdminRoundGateSection activeOfferingId={activeOffering?.id ?? null} courseOfferingIds={dashboardOfferingIds} />
      </Suspense>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <section id="pending-admin-confirmation" className="panel dashboard-console-panel scroll-mt-24">
          <h2 className="text-lg font-semibold">โครงงานรอผู้ดูแลระบบยืนยัน</h2>
          <p className="mt-1 text-sm text-muted">เมื่อยืนยันแล้ว นักศึกษาจะเข้าสู่ขั้นตอนส่งเอกสารเสนอหัวข้อ</p>
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
                <SubmitButton pendingText="กำลังยืนยัน...">ยืนยันโครงงานและอาจารย์ที่ปรึกษา</SubmitButton>
              </form>
            )) : (
              <EmptyState title="ยังไม่มีโครงงานรอผู้ดูแลระบบยืนยัน" description="เมื่ออาจารย์ที่ปรึกษาอนุมัติแล้ว รายการจะแสดงที่นี่" />
            )}
          </div>
        </section>
        <TaskListCard
          title="ทางลัดปฏิบัติการ"
          compact
          tasks={[
            { title: "รอบสอบของรายวิชา", description: "รอบสอบระดับรายวิชา", href: "/admin/rounds" },
            { title: "รายวิชาที่เปิดสอน", description: `${offerings.length} รายวิชา/ภาคเรียน`, href: "/admin/import-students" },
            { title: "ยืนยันจบโครงงาน", description: "ตรวจสอบเงื่อนไขครบก่อนยืนยันว่าโครงงานเสร็จสมบูรณ์", href: "/admin/closeout" }
          ]}
        />
      </div>
      <Suspense fallback={<DashboardSectionSkeleton title="ภาพรวมสถานะโครงงาน" />}>
        <ProjectStatusOverviewSection projectsPromise={recentProjectsQuery} statusGroupsPromise={statusGroupsQuery} />
      </Suspense>
      <Suspense fallback={null}>
        <AdminNotificationsSection notificationsPromise={notificationsQuery} />
      </Suspense>
      <Suspense fallback={<DashboardSectionSkeleton title="หลักฐานล่าสุด" />}>
        <AdminTimelineSection timelinePromise={timelineQuery} />
      </Suspense>
    </div>
  );
}

async function AdminRoundGateSection({
  activeOfferingId,
  courseOfferingIds
}: {
  activeOfferingId: string | null;
  courseOfferingIds: string[];
}) {
  const timer = createNavTimer("admin_round_gate_section");
  const roundsQuery = timer.measure("course_rounds", () =>
    prisma.assessmentRound.findMany({
      where: { courseOfferingId: { in: courseOfferingIds }, roundType: { in: [...courseLevelRoundTypes] } },
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
    })
  );
  const progress1EligibilityQuery = activeOfferingId
    ? timer.measure("progress1_eligibility", () => getRoundEligibility(activeOfferingId, "PROGRESS_1"))
    : Promise.resolve({ eligible: [], notReady: [] });

  const [rounds, progress1Eligibility] = await Promise.all([roundsQuery, progress1EligibilityQuery]);
  const activeRounds = rounds.filter((round) => round.courseOfferingId === activeOfferingId);
  const activeRoundMap = new Map(activeRounds.map((round) => [round.roundType, round]));
  const roundStatuses = Object.fromEntries(courseLevelRoundTypes.map((roundType) => [roundType, activeRoundMap.get(roundType)?.status ?? "DRAFT"]));
  const currentOpenRound = activeRounds.find((round) => isRoundOpen(round.status));
  const nextOpenRoundType = courseLevelRoundTypes.find((roundType) =>
    getRoundOpenGate(roundType, roundStatuses, { progress1EligibleCount: progress1Eligibility.eligible.length }).canOpen
  );
  const focusRoundType: CourseLevelRoundType = (currentOpenRound?.roundType as CourseLevelRoundType | undefined) ?? nextOpenRoundType ?? courseLevelRoundTypes.find((roundType) => !isRoundClosed(activeRoundMap.get(roundType)?.status ?? "DRAFT")) ?? "FINAL_PRESENTATION";
  const focusGate = getRoundOpenGate(focusRoundType, roundStatuses, { progress1EligibleCount: progress1Eligibility.eligible.length });
  const progress1BlockedReason = focusRoundType === "PROGRESS_1" ? progress1Eligibility.notReady.flatMap((item) => item.reasons)[0] : null;
  const roundFocus = deriveAdminCurrentRoundFocus({
    currentOpenRoundType: currentOpenRound?.roundType as CourseLevelRoundType | undefined,
    focusRoundType,
    canOpenNextRound: focusGate.canOpen,
    progress1EligibleCount: progress1Eligibility.eligible.length
  });
  timer.end("round_gate_ready");

  return (
    <>
      <section className="panel dashboard-console-panel border-l-4 border-l-brand">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">รอบสอบที่ต้องติดตาม</p>
            <h2 className="mt-1 text-lg font-semibold">{roundFocus.title}</h2>
            <p className="mt-1 text-sm text-muted">{roundFocus.description}</p>
          </div>
          <Link className="button-secondary" href="/admin/rounds">ดูสถานะรอบสอบ</Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {roundFocus.items.map((item) => (
            <Link key={item.href} className="rounded-md border border-line bg-surface p-3 text-sm hover:border-brand" href={item.href}>
              <div className="font-semibold text-ink">{item.title}</div>
              <p className="mt-1 text-muted">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="panel dashboard-console-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">รอบสอบของรายวิชา</h2>
            <p className="mt-1 text-sm text-muted">
              {courseLevelRoundTypes.map((roundType) => `${roundTypeLabelTh(roundType)}: ${roundStatusLabelTh(activeRoundMap.get(roundType)?.status ?? "DRAFT")}`).join(" · ")}
            </p>
            <p className="mt-2 text-sm">
              {currentOpenRound
                ? `รอบที่กำลังเปิดอยู่: ${roundTypeLabelTh(currentOpenRound.roundType)}`
                : focusGate.canOpen
                  ? `ขั้นตอนถัดไป: เปิดรอบ ${roundTypeLabelTh(focusRoundType)}`
                  : `สถานะถัดไป: ${roundSequenceReasonLabelTh(focusGate.reasonKey)}`}
            </p>
            {!focusGate.canOpen && progress1BlockedReason ? (
              <p className="mt-1 text-sm text-amber-700">{reasonLabelTh(progress1BlockedReason)}</p>
            ) : focusRoundType === "PROGRESS_1" && !focusGate.canOpen && !progress1Eligibility.eligible.length ? (
              <p className="mt-1 text-sm text-amber-700">ยังไม่มีโครงงานที่พร้อมเข้าสู่การสอบความก้าวหน้าครั้งที่ 1</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {focusGate.canOpen && activeOfferingId ? (
              <form action={openCourseRound}>
                <input type="hidden" name="course_offering_id" value={activeOfferingId} />
                <input type="hidden" name="round_type" value={focusRoundType} />
                <SubmitButton pendingText="กำลังเปิดรอบ...">เปิดรอบ {roundTypeLabelTh(focusRoundType)}</SubmitButton>
              </form>
            ) : null}
            <Link className="button-secondary" href="/admin/rounds">จัดการรอบสอบ</Link>
          </div>
        </div>
      </section>
      {process.env.NEXT_PUBLIC_SHOW_LEGACY_ROUND_CARDS === "1" ? (
        <section className="panel dashboard-console-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">รอบสอบของรายวิชา</h2>
              <p className="mt-1 text-sm text-muted">การเสนอหัวข้อ การสอบความก้าวหน้าครั้งที่ 1 การสอบความก้าวหน้าครั้งที่ 2 และการสอบนำเสนอขั้นสุดท้ายเป็นรอบระดับรายวิชา ไม่ใช่รอบแยกต่อโครงงาน</p>
            </div>
            <Link href="/admin/proposals" className="btn-secondary">ดูรอบการเสนอหัวข้อ</Link>
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
                    <button className="btn-secondary" disabled>ดูโครงงานที่มีปัญหา</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}

async function ProjectStatusOverviewSection({
  projectsPromise,
  statusGroupsPromise
}: {
  projectsPromise: Promise<Awaited<ReturnType<typeof getRecentAdminProjects>>>;
  statusGroupsPromise: Promise<Awaited<ReturnType<typeof getAdminStatusGroups>>>;
}) {
  const [rawProjects, statusGroups] = await Promise.all([projectsPromise, statusGroupsPromise]);
  const duplicateProjectGroups = findDuplicateActiveProjectGroups(rawProjects);
  const projects = getCurrentDashboardProjects(rawProjects);
  const statusCounts = new Map(statusGroups.map((group) => [group.status, group._count._all]));

  return (
    <>
      {process.env.NODE_ENV !== "production" && duplicateProjectGroups.length ? (
        <WarningAlert title="พบข้อมูล demo ซ้ำ กรุณารันคำสั่ง reset demo data">
          ใช้คำสั่ง <code>cmd /c npm.cmd run dev:reset-demo</code> เพื่อล้างเฉพาะข้อมูล demo/E2E บนฐานข้อมูล local และ seed demo ใหม่
        </WarningAlert>
      ) : null}
      <section className="panel dashboard-console-panel">
        <h2 className="text-lg font-semibold">ภาพรวมสถานะโครงงาน</h2>
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
    </>
  );
}

async function AdminNotificationsSection({
  notificationsPromise
}: {
  notificationsPromise: Promise<Awaited<ReturnType<typeof getUnreadAdminNotifications>>>;
}) {
  const notifications = await notificationsPromise;
  if (!notifications.length) return null;

  return (
    <section className="panel dashboard-console-panel">
      <DashboardSectionHeader
        title="การแจ้งเตือนที่ต้องติดตาม"
        description="แสดงเฉพาะรายการที่ระบบต้องการให้ผู้ดูแลระบบเห็นเพิ่มเติม"
      />
      <div className="mt-3 space-y-2">
        {notifications.map((notification) => (
          <div key={notification.id} className="rounded-md border border-line p-3 text-sm">
            <div className="font-medium">{notification.title}</div>
            {notification.body ? <p className="mt-1 text-muted">{notification.body}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

async function AdminTimelineSection({
  timelinePromise
}: {
  timelinePromise: Promise<Awaited<ReturnType<typeof getLatestAdminTimelineEvents>>>;
}) {
  const timeline = await timelinePromise;

  return (
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
  );
}
