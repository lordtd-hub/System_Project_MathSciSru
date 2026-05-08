import { auth } from "@/auth";
import { hasApprovedTeacherCapability, isPendingTeacherClaim } from "@/lib/auth/capabilities";
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
        <a className="button" href="/teacher/claim">เลือกโปรไฟล์อาจารย์</a>
      </div>
    );
  }
  if (!approvedTeacher || !session?.user.id) {
    timer.end("unauthorized");
    return <div className="panel">หน้านี้สำหรับอาจารย์ที่อนุมัติแล้วเท่านั้น</div>;
  }

  const sessionTeacherId = session.user.teacherId ?? null;
  const teacherWhere = sessionTeacherId ? { id: sessionTeacherId } : { userId: session.user.id };
  const [teacher, attempts, notifications] = await timer.measure("teacher_initial_queries", () => Promise.all([
    prisma.teacher.findUnique({
      where: teacherWhere,
      select: { id: true, academicPrefix: true, firstNameTh: true, lastNameTh: true, email: true }
    }),
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

  if (!teacher) {
    timer.end("missing_teacher_profile");
    return <EmptyState title="ยังไม่พบโปรไฟล์อาจารย์" description="กรุณา claim โปรไฟล์อาจารย์ก่อนใช้งาน" actionLabel="Claim โปรไฟล์" href="/teacher/claim" />;
  }

  const [advisorRequestCount, scheduleApprovalCount, reportReviewCount, advisorScoreProjectCount] = await timer.measure("teacher_workload_queries", () => Promise.all([
    prisma.advisorRequest.count({ where: { advisorTeacherId: teacher.id, status: "PENDING" } }),
    prisma.examScheduleApproval.count({ where: { teacherId: teacher.id, decision: "PENDING" } }),
    prisma.reportReview.count({ where: { reviewerTeacherId: teacher.id, decision: "FAIL" } }),
    prisma.project.count({
      where: {
        status: "REPORT_APPROVED",
        OR: [
          { advisorRequests: { some: { advisorTeacherId: teacher.id, status: "APPROVED" } } },
          { committeeAssignments: { some: { teacherId: teacher.id, active: true, role: "ADVISOR" } } }
        ]
      }
    })
  ]));
  const pendingProposalScores = attempts.filter((attempt) => !attempt.evaluatorAssignments[0]?.scoreSubmission || attempt.evaluatorAssignments[0].scoreSubmission?.status !== "SUBMITTED");
  const nextAction = getNextActionForTeacher({
    pendingAdvisorRequests: advisorRequestCount,
    pendingProposalScores: pendingProposalScores.length,
    pendingScheduleApprovals: scheduleApprovalCount,
    pendingReportReviews: reportReviewCount,
    advisorScoreUnlocked: advisorScoreProjectCount > 0
  });
  const workloadCards = [
    { label: "คำขอที่ปรึกษา", value: advisorRequestCount, href: "/teacher/advisor-requests", tone: advisorRequestCount ? "current" : "quiet" },
    { label: "Proposal รอประเมิน", value: pendingProposalScores.length, href: "/teacher/proposals", tone: pendingProposalScores.length ? "current" : "quiet" },
    { label: "ตารางสอบรออนุมัติ", value: scheduleApprovalCount, href: "/teacher/schedules", tone: scheduleApprovalCount ? "waiting" : "quiet" },
    { label: "งานตรวจเล่ม/แก้ไข", value: reportReviewCount, href: "/teacher/reports", tone: reportReviewCount ? "waiting" : "quiet" },
    { label: "Advisor score", value: advisorScoreProjectCount, href: "/teacher/advisor-score", tone: advisorScoreProjectCount ? "complete" : "quiet" }
  ];
  timer.end();

  return (
    <div className="space-y-6">
      <PageHeader
        title="แดชบอร์ดอาจารย์"
        description="รวมคำขอที่ปรึกษา งานประเมิน Proposal ตารางสอบ และงานตรวจเล่มที่เกี่ยวข้อง"
      />
      <NextActionCard action={nextAction} />
      <section className="panel action-queue-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">ภาพรวมงานของอาจารย์</h2>
            <p className="mt-1 text-sm text-muted">สรุปเฉพาะงานที่เกี่ยวข้องกับบทบาทของท่านจากข้อมูลเดิมในระบบ</p>
          </div>
          <span className="workflow-chip">รวม {workloadCards.reduce((sum, card) => sum + card.value, 0)} รายการ</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {workloadCards.map((card) => (
            <a
              key={card.label}
              href={card.href}
              className={`dashboard-metric ${card.tone === "current" ? "dashboard-metric-current" : card.tone === "waiting" ? "dashboard-metric-waiting" : card.tone === "complete" ? "dashboard-metric-complete" : "dashboard-metric-muted"}`}
            >
              <div className="dashboard-metric-value">{card.value}</div>
              <div className="dashboard-metric-label">{card.label}</div>
            </a>
          ))}
        </div>
      </section>
      <GuidancePanel
        title="คำแนะนำสำหรับอาจารย์"
        current="ตรวจงานที่ต้องดำเนินการและอ่านเอกสารแนบก่อนตัดสินใจ"
        next="ระบบจะแสดง comment ให้นักศึกษาทันที แต่ซ่อนคะแนน Proposal จากนักศึกษา"
        actor="อาจารย์ที่ปรึกษา HEAD MEMBER หรือผู้ตรวจเล่มตามบทบาทของท่าน"
      />
      <section className="panel">
        <h2 className="text-lg font-semibold">สถานะบัญชีและบทบาท</h2>
        <p className="mt-2 text-sm text-muted">{teacherDisplayName(teacher)} · {teacher.email ?? "ยังไม่ได้ผูกอีเมล"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="button-secondary" href="/teacher/advisor-requests">คำขอที่ปรึกษา</a>
          <a className="button-secondary" href="/teacher/proposals">ประเมิน Proposal</a>
          <a className="button-secondary" href="/teacher/progress1">คะแนน Progress 1</a>
          <a className="button-secondary" href="/teacher/progress2">คะแนน Progress 2</a>
          <a className="button-secondary" href="/teacher/final">คะแนน Final</a>
          <a className="button-secondary" href="/teacher/schedules">อนุมัติวันสอบ</a>
          <a className="button-secondary" href="/teacher/reports">ตรวจเล่ม</a>
          <a className="button-secondary" href="/teacher/advisor-score">Advisor score 25%</a>
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        <TaskListCard
          title="งานด่วน"
          tasks={[
            { title: "คำขอที่ปรึกษา", description: `${advisorRequestCount} รายการรออนุมัติ`, href: "/teacher/advisor-requests", urgency: advisorRequestCount ? "สูง" : "ปกติ" },
            { title: "Proposal รอประเมิน", description: `${pendingProposalScores.length} รายการ`, href: "/teacher/proposals", urgency: pendingProposalScores.length ? "สูง" : "ปกติ" },
            { title: "ตารางสอบรออนุมัติ", description: `${scheduleApprovalCount} รายการ`, href: "/teacher/schedules", urgency: scheduleApprovalCount ? "สูง" : "ปกติ" },
            { title: "Advisor score 25%", description: `${advisorScoreProjectCount} รายการ`, href: "/teacher/advisor-score", urgency: advisorScoreProjectCount ? "สูง" : "ปกติ" }
          ]}
        />
        <section className="panel lg:col-span-2">
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
                      <a className="button" href={`/teacher/scoring/${assignment.id}`}>ประเมิน Proposal</a>
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
      </div>
      <section className="panel">
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
