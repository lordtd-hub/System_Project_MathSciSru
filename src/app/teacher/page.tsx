import Link from "next/link";
import { auth } from "@/auth";
import { hasApprovedTeacherCapability, isPendingTeacherClaim } from "@/lib/auth/capabilities";
import { CompactMetricRow, DashboardActionQueue, DashboardSectionHeader } from "@/components/ui/DashboardActionQueue";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { NextActionCard } from "@/components/ui/NextActionCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { TaskListCard } from "@/components/ui/TaskListCard";
import { WarningAlert, InfoAlert } from "@/components/ui/Alert";
import { prisma } from "@/lib/db";
import { createNavTimer } from "@/lib/diagnostics/navTiming";
import { getNextActionForTeacher } from "@/lib/lifecycle/nextActions";
import { teacherDisplayName } from "@/lib/teachers/displayName";
import { openProposalScoring } from "./actions";

function getTeacherWorkloadCounts(teacherId: string) {
  return Promise.all([
    prisma.advisorRequest.count({ where: { advisorTeacherId: teacherId, status: "PENDING" } }),
    prisma.examScheduleApproval.count({ where: { teacherId, decision: "PENDING" } }),
    prisma.reportReview.count({ where: { reviewerTeacherId: teacherId, decision: "FAIL" } }),
    prisma.project.count({
      where: {
        status: "REPORT_APPROVED",
        OR: [
          { advisorRequests: { some: { advisorTeacherId: teacherId, status: "APPROVED" } } },
          { committeeAssignments: { some: { teacherId, active: true, role: "ADVISOR" } } }
        ]
      }
    })
  ]);
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
        assessmentRound: { roundType: "PROPOSAL" },
        presentationSubmission: { status: { in: ["SUBMITTED", "LOCKED"] } }
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
    return <EmptyState title="ยังไม่พบโปรไฟล์อาจารย์" description="กรุณา claim โปรไฟล์อาจารย์ก่อนใช้งาน" actionLabel="Claim โปรไฟล์" href="/teacher/claim" />;
  }

  const [advisorRequestCount, scheduleApprovalCount, reportReviewCount, advisorScoreProjectCount] = await (
    sessionTeacherWorkloadQuery ?? timer.measure("teacher_workload_queries", () => getTeacherWorkloadCounts(teacher.id))
  );
  const pendingProposalScores = attempts.filter((attempt) => !attempt.evaluatorAssignments[0]?.scoreSubmission || attempt.evaluatorAssignments[0].scoreSubmission?.status !== "SUBMITTED");
  const nextAction = getNextActionForTeacher({
    pendingAdvisorRequests: advisorRequestCount,
    pendingProposalScores: pendingProposalScores.length,
    pendingScheduleApprovals: scheduleApprovalCount,
    pendingReportReviews: reportReviewCount,
    advisorScoreUnlocked: advisorScoreProjectCount > 0
  });
  const workloadCards = [
    { label: "คำขอที่ปรึกษา", value: advisorRequestCount, href: "/teacher/advisor-requests", tone: advisorRequestCount ? "ready" as const : "quiet" as const },
    { label: "Proposal รอประเมิน", value: pendingProposalScores.length, href: "/teacher/proposals", tone: pendingProposalScores.length ? "ready" as const : "quiet" as const },
    { label: "ตารางสอบรออนุมัติ", value: scheduleApprovalCount, href: "/teacher/schedules", tone: scheduleApprovalCount ? "waiting" as const : "quiet" as const },
    { label: "งานตรวจเล่ม/แก้ไข", value: reportReviewCount, href: "/teacher/reports", tone: reportReviewCount ? "waiting" as const : "quiet" as const },
    { label: "Advisor score", value: advisorScoreProjectCount, href: "/teacher/advisor-score", tone: advisorScoreProjectCount ? "complete" as const : "quiet" as const }
  ];
  const teacherActionQueue = [
    {
      title: "คำขอที่ปรึกษา",
      description: advisorRequestCount ? "นักศึกษารออาจารย์พิจารณารับเป็นที่ปรึกษา" : "ยังไม่มีคำขอที่ปรึกษาที่รอดำเนินการ",
      href: "/teacher/advisor-requests",
      count: advisorRequestCount,
      tone: advisorRequestCount ? "urgent" as const : "quiet" as const,
      statusLabel: advisorRequestCount ? "ต้องตอบรับ" : "ปกติ"
    },
    {
      title: "Proposal รอประเมิน",
      description: pendingProposalScores.length ? "มี Proposal ที่ได้รับมอบหมายและยังไม่ได้ส่งคะแนน" : "ยังไม่มี Proposal ที่ต้องประเมินตอนนี้",
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
      title: "ตรวจเล่ม / รายงานแก้ไข",
      description: reportReviewCount ? "มีรายการตรวจเล่มหรือ revision ที่ต้องติดตาม" : "ยังไม่มีงานตรวจเล่มที่ต้องดำเนินการตอนนี้",
      href: "/teacher/reports",
      count: reportReviewCount,
      tone: reportReviewCount ? "waiting" as const : "quiet" as const,
      statusLabel: "ติดตาม"
    },
    {
      title: "Advisor score 25%",
      description: advisorScoreProjectCount ? "มีโครงงานที่ปลดล็อกให้บันทึกคะแนนที่ปรึกษา" : "ยังไม่มีโครงงานที่พร้อมบันทึก Advisor score",
      href: "/teacher/advisor-score",
      count: advisorScoreProjectCount,
      tone: advisorScoreProjectCount ? "complete" as const : "quiet" as const,
      statusLabel: "advisor score"
    },
    {
      title: "คะแนน Progress 1",
      description: "เปิด workspace สำหรับงานประเมิน Progress 1 ตาม assignment ที่ระบบมีอยู่",
      href: "/teacher/progress1",
      tone: "quiet" as const,
      statusLabel: "ติดตาม"
    },
    {
      title: "คะแนน Progress 2",
      description: "เปิด workspace สำหรับงานประเมิน Progress 2 ตาม assignment ที่ระบบมีอยู่",
      href: "/teacher/progress2",
      tone: "quiet" as const,
      statusLabel: "ติดตาม"
    },
    {
      title: "คะแนน Final Presentation",
      description: "เปิด workspace สำหรับงานประเมิน Final ตาม assignment ที่ระบบมีอยู่",
      href: "/teacher/final",
      tone: "quiet" as const,
      statusLabel: "ติดตาม"
    }
  ];
  timer.end();

  return (
    <div className="space-y-4">
      <PageHeader
        title="แดชบอร์ดอาจารย์"
        description="รวมคำขอที่ปรึกษา งานประเมิน Proposal ตารางสอบ และงานตรวจเล่มที่เกี่ยวข้อง"
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <DashboardActionQueue
          title="งานที่ต้องดำเนินการ"
          description="รวมงานที่อาจารย์ต้องตอบรับ ประเมิน ตรวจ หรือยืนยันตามบทบาทที่มีอยู่ในระบบ"
          items={teacherActionQueue}
          mobilePrimaryCount={4}
          mobileSummaryLabel="workspace และงานติดตามอื่น"
        />
        <div className="space-y-3">
          <NextActionCard action={nextAction} />
          <section className="panel dashboard-console-panel">
            <DashboardSectionHeader title="บัญชีและบทบาท" description="ทางลัดไปยัง workspace ของอาจารย์โดยไม่เปลี่ยนสิทธิ์หรือ flow เดิม" />
            <p className="mt-4 text-sm leading-6 text-muted">{teacherDisplayName(teacher)} · {teacher.email ?? "ยังไม่ได้ผูกอีเมล"}</p>
            <div className="mt-3 grid gap-2 text-sm">
              <Link className="button-secondary justify-start" href="/teacher/proposals">ประเมิน Proposal</Link>
              <Link className="button-secondary justify-start" href="/teacher/reports">ตรวจเล่ม</Link>
              <Link className="button-secondary justify-start" href="/teacher/advisor-score">Advisor score 25%</Link>
            </div>
          </section>
        </div>
      </div>
      <GuidancePanel
        title="คำแนะนำสำหรับอาจารย์"
        current="ตรวจงานที่ต้องดำเนินการและอ่านเอกสารแนบก่อนตัดสินใจ"
        next="ระบบจะแสดง comment ให้นักศึกษาทันที แต่ซ่อนคะแนน Proposal จากนักศึกษา"
        actor="อาจารย์ที่ปรึกษา HEAD MEMBER หรือผู้ตรวจเล่มตามบทบาทของท่าน"
      />
      <CompactMetricRow
        title="ภาพรวมสถานะ"
        description={`รวม ${workloadCards.reduce((sum, card) => sum + card.value, 0)} รายการจากข้อมูลเดิมของอาจารย์ ใช้เป็นสัญญาณรองจาก queue หลัก`}
        metrics={workloadCards}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <section className="panel dashboard-console-panel">
          <h2 className="text-lg font-semibold">Proposal ที่เกี่ยวข้อง</h2>
          <div className="mt-3 space-y-3">
            {attempts.length ? (
              attempts.map((attempt) => {
                const assignment = attempt.evaluatorAssignments[0];
                return (
                  <div key={attempt.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line p-3">
                    <div>
                      <div className="font-medium">{attempt.presentationSubmission?.titleTh ?? "ยังไม่มีชื่อหัวข้อ"}</div>
                      <div className="text-sm text-muted">
                        {attempt.project.student.studentCode} {attempt.project.student.firstNameTh} {attempt.project.student.lastNameTh}
                      </div>
                    </div>
                    {assignment ? (
                      <Link className="button" href={`/teacher/scoring/${assignment.id}`}>ประเมิน Proposal</Link>
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
              <EmptyState title="ยังไม่มี Proposal ที่ส่งแล้ว" description="เมื่อมีนักศึกษาส่ง Proposal รายการจะแสดงที่นี่" />
            )}
          </div>
        </section>
        <TaskListCard
          title="ทางลัด workspace"
          compact
          tasks={[
            { title: "คำขอที่ปรึกษา", description: `${advisorRequestCount} รายการรออนุมัติ`, href: "/teacher/advisor-requests", urgency: advisorRequestCount ? "สูง" : "ปกติ" },
            { title: "คะแนน Progress 1", description: "เปิดหน้าประเมิน Progress 1", href: "/teacher/progress1" },
            { title: "คะแนน Progress 2", description: "เปิดหน้าประเมิน Progress 2", href: "/teacher/progress2" },
            { title: "คะแนน Final", description: "เปิดหน้าประเมิน Final Presentation", href: "/teacher/final" }
          ]}
        />
      </div>
      <section className="panel dashboard-console-panel">
        <h2 className="text-lg font-semibold">Notification</h2>
        <div className="mt-3 space-y-2">
          {notifications.length ? notifications.map((notification) => (
            <div key={notification.id} className="rounded-md border border-line p-3 text-sm">
              <div className="font-medium">{notification.title}</div>
              {notification.body ? <p className="mt-1 text-muted">{notification.body}</p> : null}
            </div>
          )) : <InfoAlert title="ยังไม่มีงานที่ต้องดำเนินการ">งานใหม่จะแสดงใน dashboard และ route ย่อยตามบทบาท</InfoAlert>}
        </div>
      </section>
    </div>
  );
}
