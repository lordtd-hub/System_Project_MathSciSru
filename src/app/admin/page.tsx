import { auth } from "@/auth";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { CompactLifecycleBadge } from "@/components/ui/LifecycleStepper";
import { NextActionCard } from "@/components/ui/NextActionCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { TaskListCard } from "@/components/ui/TaskListCard";
import { TimelineCard } from "@/components/ui/TimelineCard";
import { WarningAlert, InfoAlert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { courseLevelRoundTypes, roundStatusLabelTh, roundTypeLabelTh } from "@/lib/assessments/courseRounds";
import { getRoundEligibility, reasonLabelTh } from "@/lib/assessments/roundEligibility";
import { findDuplicateActiveProjectGroups, getCurrentDashboardProjects } from "@/lib/admin/dashboardProjects";
import { isAdminTestingToolsEnabled } from "@/lib/admin/testingMode";
import { prisma } from "@/lib/db";
import { getNextActionForAdmin } from "@/lib/lifecycle/nextActions";
import { lifecycleV2Steps, projectStatusLabelTh } from "@/lib/lifecycle/statusLabels";
import { shouldAlertAdminForFailVotes } from "@/lib/lifecycle/transitions";
import { confirmProjectAdvisor, openCourseRound, resetCourseOfferingTestData } from "./actions";

function countByStatus(projects: Array<{ status: string }>, status: string) {
  return projects.filter((project) => project.status === status).length;
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
  const session = await auth();
  if (session?.user.role !== "ADMIN") return <div className="panel">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</div>;
  const params = (await searchParams) ?? {};

  const offerings = await prisma.courseOffering.findMany({ include: { term: true }, orderBy: { id: "desc" }, take: 5 });
  const dashboardOfferingIds = offerings.map((offering) => offering.id);

  const [students, claims, rounds, rawProjects, notifications, timeline] = await Promise.all([
    prisma.student.count(),
    prisma.teacherAccountClaim.count({ where: { status: "PENDING" } }),
    prisma.assessmentRound.findMany({
      where: { courseOfferingId: { in: dashboardOfferingIds }, roundType: { in: [...courseLevelRoundTypes] } },
      include: {
        courseOffering: { include: { term: true, projects: true } },
        attempts: { include: { presentationSubmission: true } },
        projectExceptions: true
      },
      orderBy: [{ courseOfferingId: "desc" }, { roundType: "asc" }]
    }),
    prisma.project.findMany({
      include: { student: true, proposalVotes: true, advisorRequests: { include: { advisorTeacher: true }, orderBy: { requestedAt: "desc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
      take: 80
    }),
    prisma.notification.findMany({ where: { status: "UNREAD" }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.projectTimelineEvent.findMany({ include: { actor: true }, orderBy: { occurredAt: "desc" }, take: 8 })
  ]);

  const duplicateProjectGroups = findDuplicateActiveProjectGroups(rawProjects);
  const projects = getCurrentDashboardProjects(rawProjects);
  const activeOffering = offerings[0];
  const progress1Eligibility = activeOffering ? await getRoundEligibility(activeOffering.id, "PROGRESS_1") : { eligible: [], notReady: [] };
  const progress1Round = rounds.find((round) => round.courseOfferingId === activeOffering?.id && round.roundType === "PROGRESS_1");
  const proposalRound = rounds.find((round) => round.courseOfferingId === activeOffering?.id && round.roundType === "PROPOSAL");
  const progress1CanOpen = progress1Eligibility.eligible.length > 0 && !["SUBMISSION_OPEN", "SCORING_OPEN"].includes(progress1Round?.status ?? "DRAFT");
  const progress1BlockedReason = progress1Eligibility.notReady.flatMap((item) => item.reasons)[0];
  const testingToolsEnabled = isAdminTestingToolsEnabled();
  const failAlertProjects = projects.filter((project) => shouldAlertAdminForFailVotes(project.proposalVotes));
  const pendingAdminProjects = projects.filter((project) => project.status === "PENDING_ADMIN");
  const nextAction = getNextActionForAdmin(projects.map((project) => ({ status: project.status, proposalVotes: project.proposalVotes })));
  const topCards = [
    { label: "จำนวนนักศึกษา", value: students, href: "/admin/students" },
    { label: "โปรเจครอที่ปรึกษา", value: countByStatus(projects, "PENDING_ADVISOR"), href: "/admin" },
    { label: "โปรเจครอ Admin ยืนยัน", value: pendingAdminProjects.length, href: "/admin" },
    { label: "Proposal รอประเมิน", value: countByStatus(projects, "PROPOSAL_REVIEW"), href: "/admin/proposals" },
    { label: "Proposal มี FAIL ≥ 50%", value: failAlertProjects.length, href: "/admin/proposals" },
    { label: "หัวข้อผ่านแล้วรอตั้งกรรมการ", value: countByStatus(projects, "TOPIC_APPROVED"), href: "/admin/committee" },
    { label: "รอปิดงานโครงงาน", value: countByStatus(projects, "ADVISOR_SCORING"), href: "/admin/closeout" }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="แดชบอร์ดผู้ดูแลระบบ"
        description="ติดตาม lifecycle ทั้งระบบ ยืนยันโปรเจค จัดการ Proposal แต่งตั้งกรรมการ และดูหลักฐานล่าสุด"
        actions={
          <>
            <span
              className={`inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm ${
                testingToolsEnabled ? "border-amber-200 bg-amber-50 text-amber-900" : "border-line bg-white text-muted"
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
      <NextActionCard action={nextAction} />
      <GuidancePanel
        title="คำแนะนำสำหรับผู้ดูแลระบบ"
        current="ตรวจรายการค้าง เช่น Admin confirmation, Proposal decision, teacher claims และ committee assignment"
        next="ระบบไม่ตัดสินผล Proposal อัตโนมัติ ผู้ดูแลระบบต้องยืนยันผลสุดท้ายด้วยตนเอง"
        actor="ผู้ดูแลระบบเป็นผู้ยืนยันขั้นสำคัญและดูแลหลักฐาน"
      />
      {failAlertProjects.length ? (
        <WarningAlert title="มี Proposal ที่ FAIL ≥ 50%">
          กรุณาตรวจ vote และ comment อย่างละเอียดก่อนตัดสินผลสุดท้าย
        </WarningAlert>
      ) : null}
      <div className="grid gap-4 md:grid-cols-4">
        {topCards.map((card) => (
          <a key={card.label} href={card.href} className="panel block transition hover:-translate-y-0.5 hover:border-brand/50">
            <div className="flex items-start justify-between gap-3">
              <div className="text-2xl font-semibold text-ink">{card.value}</div>
              <span className="mt-1 h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
            </div>
            <div className="mt-1 text-sm leading-6 text-muted">{card.label}</div>
          </a>
        ))}
      </div>
      <section className="panel">
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
      <div className="grid gap-4 lg:grid-cols-3">
        <TaskListCard
          title="สิ่งที่ต้องทำตอนนี้"
          tasks={[
            ...(claims > 0
              ? [{ title: "คำขอผูกบัญชีอาจารย์", description: `${claims} คำขอรออนุมัติ`, href: "/admin/claims", urgency: "สูง" }]
              : [{ title: "คำขอผูกบัญชีอาจารย์", description: "ไม่มีคำขอผูกบัญชีอาจารย์ที่รออนุมัติ", href: "/admin/claims", urgency: "ปกติ" }]),
            { title: "รอบสอบของรายวิชา", description: `${rounds.length} รอบแบบ course-level`, href: "/admin/rounds" },
            { title: "Course offering", description: `${offerings.length} รายวิชา/ภาคเรียน`, href: "/admin/import-students" },
            { title: "ปิดงานโครงงาน", description: "ตรวจสอบเงื่อนไขครบก่อนเปลี่ยนเป็น COMPLETED", href: "/admin/closeout" }
          ]}
        />
        <section className="panel lg:col-span-2">
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
      </div>
      {process.env.NODE_ENV !== "production" && duplicateProjectGroups.length ? (
        <WarningAlert title="พบข้อมูล demo ซ้ำ กรุณารันคำสั่ง reset demo data">
          ใช้คำสั่ง <code>cmd /c npm.cmd run dev:reset-demo</code> เพื่อล้างเฉพาะข้อมูล demo/E2E บนฐานข้อมูล local และ seed demo ใหม่
        </WarningAlert>
      ) : null}
      {process.env.NEXT_PUBLIC_SHOW_LEGACY_ROUND_CARDS === "1" ? (
      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">รอบสอบของรายวิชา</h2>
            <p className="mt-1 text-sm text-muted">Proposal, Progress 1, Progress 2 และ Final Presentation เป็นรอบระดับรายวิชา ไม่ใช่รอบแยกต่อโปรเจค</p>
          </div>
          <a href="/admin/proposals" className="btn-secondary">ดูรอบ Proposal</a>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {rounds.map((round) => {
            const eligibleProjects = round.courseOffering.projects.filter((project) => {
              if (round.roundType === "PROPOSAL") return ["PROPOSAL_PENDING", "PROPOSAL_REVIEW", "PROPOSAL_ADMIN_DECISION", "TOPIC_APPROVED", "DRAFT"].includes(project.status);
              return ["IN_PROGRESS", "FINAL_DONE", "REPORT_REVIEW", "REPORT_APPROVED", "ADVISOR_SCORING", "COMPLETED"].includes(project.status);
            });
            const submittedCount = round.attempts.filter((attempt) => attempt.presentationSubmission?.status === "SUBMITTED" || attempt.presentationSubmission?.status === "LOCKED").length;
            const completedCount = round.attempts.filter((attempt) => attempt.status === "SCORING_CLOSED" || attempt.status === "RELEASED" || Boolean(attempt.finalDecision)).length;
            return (
              <div key={round.id} className="rounded-md border border-line p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">{roundTypeLabelTh(round.roundType)}</div>
                  <span className="inline-flex items-center rounded-full border border-line px-3 py-1 text-xs font-semibold">{roundStatusLabelTh(round.status)}</span>
                </div>
                <dl className="mt-3 space-y-1 text-sm text-muted">
                  <div className="flex justify-between gap-3"><dt>เปิด</dt><dd>{formatDate(round.submissionOpenAt)}</dd></div>
                  <div className="flex justify-between gap-3"><dt>ปิด</dt><dd>{round.closedAt ? formatDate(round.closedAt) : formatDate(round.submissionDeadline)}</dd></div>
                  <div className="flex justify-between gap-3"><dt>โปรเจคที่เข้าเกณฑ์</dt><dd>{eligibleProjects.length}</dd></div>
                  <div className="flex justify-between gap-3"><dt>ส่งแล้ว</dt><dd>{submittedCount}</dd></div>
                  <div className="flex justify-between gap-3"><dt>เสร็จแล้ว</dt><dd>{completedCount}</dd></div>
                  <div className="flex justify-between gap-3"><dt>มีปัญหาเฉพาะราย</dt><dd>{round.projectExceptions.length}</dd></div>
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
      <section className="panel">
        <h2 className="text-lg font-semibold">Project status overview</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {lifecycleV2Steps.map((status) => {
            const items = projects.filter((project) => project.status === status);
            return (
              <div key={status} className="rounded-lg border border-line bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{projectStatusLabelTh(status)}</span>
                  <span className="rounded-full border border-line bg-paperSoft px-2 py-0.5 text-xs font-semibold">{items.length}</span>
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
