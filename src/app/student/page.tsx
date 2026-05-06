import { auth } from "@/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { LifecycleStepper } from "@/components/ui/LifecycleStepper";
import { NextActionCard } from "@/components/ui/NextActionCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TaskListCard, type TaskListItem } from "@/components/ui/TaskListCard";
import { TimelineCard } from "@/components/ui/TimelineCard";
import { WarningAlert, SuccessAlert, InfoAlert } from "@/components/ui/Alert";
import { prisma } from "@/lib/db";
import { getNextActionForStudent, getStudentAvailableActions } from "@/lib/lifecycle/nextActions";
import { teacherDisplayName } from "@/lib/teachers/displayName";

function daysWaiting(from?: Date | null) {
  if (!from) return 0;
  return Math.floor((Date.now() - from.getTime()) / (1000 * 60 * 60 * 24));
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

export default async function StudentDashboardPage() {
  const session = await auth();
  if (session?.user.role !== "STUDENT" || !session.user.email) {
    return <div className="panel">หน้านี้สำหรับนักศึกษาเท่านั้น</div>;
  }

  const student = await prisma.student.findUnique({
    where: { generatedEmail: session.user.email.toLowerCase() },
    include: {
      profile: true,
      projects: {
        orderBy: { createdAt: "desc" },
        include: {
          origin: { include: { tentativeAdvisor: true } },
          advisorRequests: { include: { advisorTeacher: true }, orderBy: { requestedAt: "desc" } },
          committeeAssignments: { include: { teacher: true }, orderBy: { appointedAt: "asc" } },
          scheduleProposals: { include: { approvals: true }, orderBy: { createdAt: "desc" } },
          assessmentSubmissions: { orderBy: { submittedAt: "desc" } },
          reportVersions: { include: { reviews: { include: { reviewerTeacher: true } } }, orderBy: { versionNo: "desc" } },
          advisorScore: true,
          presentationSubmissions: { orderBy: { createdAt: "desc" } },
          timelineEvents: { include: { actor: true }, orderBy: { occurredAt: "desc" }, take: 8 }
        }
      }
    }
  });
  const project = student?.projects[0];

  if (!student) {
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
  const nextAction = getNextActionForStudent(project.status);
  const workflowActions = getStudentAvailableActions(project.status);
  const proposal = project.presentationSubmissions[0];
  const latestSchedule = project.scheduleProposals[0];
  const latestReport = project.reportVersions[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`สวัสดี, ${student.firstNameTh}`}
        description="แดชบอร์ดนี้สรุปสถานะโครงงาน สิ่งที่ต้องทำ และหลักฐานสำคัญใน Project Lifecycle v2"
        actions={<StatusBadge status={project.status} />}
      />

      <NextActionCard action={nextAction} />

      {project.status === "PENDING_ADVISOR" && waitingDays > 7 ? (
        <WarningAlert title="รอการตอบรับเกิน 7 วัน">
          ระบบจะแจ้งเตือนอาจารย์ที่ปรึกษาและผู้ดูแลระบบ นักศึกษายังไม่สามารถไปขั้นถัดไปจนกว่าจะอนุมัติ
        </WarningAlert>
      ) : null}

      {project.status === "COMPLETED" ? (
        <SuccessAlert title="โครงงานเสร็จสมบูรณ์">ระบบเก็บประวัติและหลักฐานสำคัญไว้เรียบร้อยแล้ว</SuccessAlert>
      ) : null}

      <LifecycleStepper status={project.status} />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="panel lg:col-span-2">
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
            <h3 className="text-sm font-semibold">ทำได้ตอนนี้</h3>
            <div className="flex flex-wrap gap-2">
              {workflowActions.available_now.map((item) =>
                item.href ? <a key={item.key} className="button" href={item.href}>{item.title}</a> : <span key={item.key} className="rounded-md border border-line bg-paper px-3 py-2 text-sm">{item.title}</span>
              )}
            </div>
            <h3 className="text-sm font-semibold">ประวัติการดำเนินงาน</h3>
            <div className="flex flex-wrap gap-2">
              {workflowActions.read_only_history.length ? workflowActions.read_only_history.map((item) =>
                item.href ? <a key={item.key} className="button-secondary" href={item.href}>{item.title}</a> : <span key={item.key} className="rounded-md border border-line bg-paper px-3 py-2 text-sm">{item.title}</span>
              ) : <span className="text-sm text-muted">ยังไม่มีประวัติในขั้นก่อนหน้า</span>}
            </div>
            <h3 className="text-sm font-semibold">ขั้นตอนที่ล็อกหรือรอผู้อื่น</h3>
            <div className="grid gap-2 md:grid-cols-2">
              {[...workflowActions.locked_future, ...workflowActions.blocked_waiting_for].map((item) => (
                <div key={item.key} className="rounded-md border border-line bg-paper p-3 text-sm text-muted">
                  <div className="font-medium text-ink">{item.title}</div>
                  <div>{item.description}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <TaskListCard title="รายการที่ต้องติดตาม" tasks={buildStudentTasks(project.status)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel">
          <h2 className="text-lg font-semibold">กรรมการและการนัดสอบ</h2>
          <div className="mt-3 space-y-2 text-sm">
            {project.committeeAssignments.length ? (
              project.committeeAssignments.map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between rounded-md border border-line p-3">
                  <span>{teacherDisplayName(assignment.teacher)}</span>
                  <span className="rounded-full border border-line px-2 py-0.5 text-xs">{assignment.role}</span>
                </div>
              ))
            ) : (
              <p className="text-muted">ยังไม่มีการแต่งตั้ง HEAD และ MEMBER</p>
            )}
          </div>
          <div className="mt-4 rounded-md border border-line bg-paper p-3 text-sm text-muted">
            {latestSchedule
              ? `${latestSchedule.assessmentKind}: ${latestSchedule.status} (${latestSchedule.approvals.filter((approval) => approval.decision === "APPROVE").length}/${latestSchedule.approvals.length} อนุมัติ)`
              : "ยังไม่มีการเสนอวันสอบ Progress/Final"}
          </div>
        </section>

        <GuidancePanel
          title="คำแนะนำสำหรับนักศึกษา"
          current="ดูสถานะปัจจุบันและทำรายการที่ระบบแนะนำก่อน"
          next="ระบบจะบันทึกประวัติทุกครั้งเพื่อใช้เป็นหลักฐาน และแจ้งเตือนเมื่อมีผู้เกี่ยวข้องต้องดำเนินการ"
          actor="ขึ้นอยู่กับสถานะ อาจเป็นนักศึกษา อาจารย์ที่ปรึกษา กรรมการ หรือผู้ดูแลระบบ"
        />
      </div>

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
