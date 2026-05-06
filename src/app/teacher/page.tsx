import { auth } from "@/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { NextActionCard } from "@/components/ui/NextActionCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { TaskListCard } from "@/components/ui/TaskListCard";
import { WarningAlert, InfoAlert } from "@/components/ui/Alert";
import { prisma } from "@/lib/db";
import { getNextActionForTeacher } from "@/lib/lifecycle/nextActions";
import { teacherDisplayName } from "@/lib/teachers/displayName";
import { openProposalScoring } from "./actions";

export default async function TeacherDashboardPage() {
  const session = await auth();
  if (session?.user.role === "PENDING_TEACHER") {
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
  if (session?.user.role !== "TEACHER" || !session.user.id) return <div className="panel">หน้านี้สำหรับอาจารย์ที่อนุมัติแล้วเท่านั้น</div>;

  const [teacher, attempts, notifications] = await Promise.all([
    prisma.teacher.findUnique({ where: { userId: session.user.id } }),
    prisma.assessmentAttempt.findMany({
      where: {
        assessmentRound: { roundType: "PROPOSAL" },
        presentationSubmission: { status: { in: ["SUBMITTED", "LOCKED"] } }
      },
      include: {
        presentationSubmission: true,
        project: { include: { student: true } },
        evaluatorAssignments: { where: { evaluatorUserId: session.user.id }, include: { scoreSubmission: true } }
      },
      take: 8
    }),
    prisma.notification.findMany({ where: { userId: session.user.id, status: "UNREAD" }, orderBy: { createdAt: "desc" }, take: 5 })
  ]);

  if (!teacher) {
    return <EmptyState title="ยังไม่พบโปรไฟล์อาจารย์" description="กรุณา claim โปรไฟล์อาจารย์ก่อนใช้งาน" actionLabel="Claim โปรไฟล์" href="/teacher/claim" />;
  }

  const [advisorRequests, scheduleApprovals, reportReviews, advisorScoreProjects] = await Promise.all([
    prisma.advisorRequest.findMany({ where: { advisorTeacherId: teacher.id, status: "PENDING" }, include: { project: { include: { student: true } } }, take: 5 }),
    prisma.examScheduleApproval.findMany({ where: { teacherId: teacher.id, decision: "PENDING" }, include: { scheduleProposal: { include: { project: { include: { student: true } } } } }, take: 5 }),
    prisma.reportReview.findMany({ where: { reviewerTeacherId: teacher.id, decision: "FAIL" }, include: { reportVersion: { include: { project: { include: { student: true } } } } }, take: 5 }),
    prisma.project.findMany({
      where: {
        status: "REPORT_APPROVED",
        OR: [
          { advisorRequests: { some: { advisorTeacherId: teacher.id, status: "APPROVED" } } },
          { committeeAssignments: { some: { teacherId: teacher.id, active: true, role: "ADVISOR" } } }
        ]
      },
      take: 5
    })
  ]);
  const pendingProposalScores = attempts.filter((attempt) => !attempt.evaluatorAssignments[0]?.scoreSubmission || attempt.evaluatorAssignments[0].scoreSubmission?.status !== "SUBMITTED");
  const nextAction = getNextActionForTeacher({
    pendingAdvisorRequests: advisorRequests.length,
    pendingProposalScores: pendingProposalScores.length,
    pendingScheduleApprovals: scheduleApprovals.length,
    pendingReportReviews: reportReviews.length,
    advisorScoreUnlocked: advisorScoreProjects.length > 0
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="แดชบอร์ดอาจารย์"
        description="รวมคำขอที่ปรึกษา งานประเมิน Proposal ตารางสอบ และงานตรวจเล่มที่เกี่ยวข้อง"
      />
      <NextActionCard action={nextAction} />
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
            { title: "คำขอที่ปรึกษา", description: `${advisorRequests.length} รายการรออนุมัติ`, href: "/teacher/advisor-requests", urgency: advisorRequests.length ? "สูง" : "ปกติ" },
            { title: "Proposal รอประเมิน", description: `${pendingProposalScores.length} รายการ`, href: "/teacher/proposals", urgency: pendingProposalScores.length ? "สูง" : "ปกติ" },
            { title: "ตารางสอบรออนุมัติ", description: `${scheduleApprovals.length} รายการ`, href: "/teacher/schedules", urgency: scheduleApprovals.length ? "สูง" : "ปกติ" }
            ,{ title: "Advisor score 25%", description: `${advisorScoreProjects.length} รายการ`, href: "/teacher/advisor-score", urgency: advisorScoreProjects.length ? "สูง" : "ปกติ" }
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
