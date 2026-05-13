import { auth } from "@/auth";
import { AdminOperationalSummary, AdminQueueBadge } from "@/components/ui/AdminOperationalQueue";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/db";
import { formatThaiScheduleRange } from "@/lib/format/dateTime";
import { teacherDisplayName } from "@/lib/teachers/displayName";

function scheduleRoundLabel(kind?: string | null) {
  if (kind === "PROGRESS_1") return "ความก้าวหน้าครั้งที่ 1";
  if (kind === "PROGRESS_2") return "ความก้าวหน้าครั้งที่ 2";
  if (kind === "FINAL_PRESENT" || kind === "FINAL_PRESENTATION") return "สอบนำเสนอขั้นสุดท้าย";
  return kind ?? "-";
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

export default async function AdminSchedulesPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return <div className="panel">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</div>;

  const schedules = await prisma.examScheduleProposal.findMany({
    include: {
      courseOffering: { include: { term: true } },
      assessmentRound: true,
      project: {
        include: {
          student: true,
          advisorRequests: { where: { status: "APPROVED" }, include: { advisorTeacher: true }, orderBy: { reviewedAt: "desc" }, take: 1 },
          committeeAssignments: { where: { active: true }, include: { teacher: true } }
        }
      },
      approvals: { include: { teacher: true } }
    },
    orderBy: [{ createdAt: "asc" }, { proposedStartAt: "asc" }]
  });
  const proposedSchedules = schedules.filter((schedule) => schedule.status === "PROPOSED");
  const rejectedSchedules = schedules.filter((schedule) => schedule.status === "REJECTED");
  const confirmedSchedules = schedules.filter((schedule) => schedule.status === "CONFIRMED");
  const pendingApprovalCount = proposedSchedules.reduce(
    (sum, schedule) => sum + schedule.approvals.filter((approval) => approval.decision === "PENDING").length,
    0
  );
  const scheduleGroups = [
    { title: "Needs attention", description: "รายการที่ยังรอกรรมการยืนยันเวลา", tone: "action" as const, items: proposedSchedules },
    { title: "Returned / Needs revision", description: "รายการที่ถูกปฏิเสธและรอนักศึกษาส่งเวลาใหม่", tone: "exception" as const, items: rejectedSchedules },
    { title: "Completed", description: "รายการที่ยืนยันเวลาแล้ว เก็บไว้เป็นประวัติการสอบ", tone: "completed" as const, items: confirmedSchedules }
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="ตารางสอบของรายวิชา" description="รายการวันที่นักศึกษาส่งสำหรับการสอบความก้าวหน้าครั้งที่ 1 ครั้งที่ 2 และการสอบนำเสนอขั้นสุดท้าย" />
      <GuidancePanel
        title="ภาพรวมตารางสอบ"
        current="ผู้ดูแลระบบเห็นรายการของทุกโครงงานในรายวิชา"
        next="ใช้หน้านี้เพื่อติดตามรายการที่ส่งแล้วและสถานะการพิจารณา"
        actor="ผู้ดูแลระบบ"
      />
      <AdminOperationalSummary
        title="สรุปตารางสอบ"
        description="แยกรายการที่รอการยืนยันออกจากรายการที่ยืนยันแล้ว เพื่อให้สแกนงานจำนวนมากได้เร็วขึ้น"
        metrics={[
          { label: "รอยืนยัน", count: proposedSchedules.length, tone: proposedSchedules.length ? "action" : "completed", description: `${pendingApprovalCount} การตอบรับจากกรรมการยังค้างอยู่` },
          { label: "ให้แก้ไขเวลา", count: rejectedSchedules.length, tone: rejectedSchedules.length ? "exception" : "completed", description: "นักศึกษาต้องส่งเวลาสอบใหม่" },
          { label: "ยืนยันแล้ว", count: confirmedSchedules.length, tone: "completed", description: "ไม่ใช่งานที่ต้องกดต่อ" }
        ]}
      />
      <div className="space-y-3">
        {schedules.length ? scheduleGroups.map((group) => (
          <section key={group.title} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-2">
              <div>
                <h2 className="text-lg font-semibold">{group.title}</h2>
                <p className="mt-1 text-sm text-muted">{group.description}</p>
              </div>
              <AdminQueueBadge tone={group.tone}>{group.items.length} รายการ</AdminQueueBadge>
            </div>
            {group.items.length ? group.items.map((schedule) => (
              <section key={schedule.id} className="panel">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{scheduleRoundLabel(schedule.roundType ?? schedule.assessmentKind)}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {schedule.project.student.studentCode} {schedule.project.student.firstNameTh} {schedule.project.student.lastNameTh}
                    </p>
                    <p className="mt-1 text-sm text-muted">{schedule.project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</p>
                  </div>
                  <AdminQueueBadge tone={group.tone}>{scheduleStatusLabel(schedule.status)}</AdminQueueBadge>
                </div>
                <dl className="mt-4 grid gap-2 text-sm md:grid-cols-3">
                  <div><dt className="font-semibold">ภาคเรียน</dt><dd className="text-muted">{schedule.courseOffering?.term.displayName ?? "-"}</dd></div>
                  <div><dt className="font-semibold">รอบ</dt><dd className="text-muted">{schedule.assessmentRound?.name ?? scheduleRoundLabel(schedule.roundType ?? schedule.assessmentKind)}</dd></div>
                  <div><dt className="font-semibold">วันเวลา</dt><dd className="text-muted">{formatThaiScheduleRange(schedule.proposedStartAt, schedule.proposedEndAt)}</dd></div>
                  <div><dt className="font-semibold">ห้อง</dt><dd className="text-muted">{schedule.room ?? "-"}</dd></div>
                  <div><dt className="font-semibold">ที่ปรึกษา</dt><dd className="text-muted">{schedule.project.advisorRequests[0]?.advisorTeacher ? teacherDisplayName(schedule.project.advisorRequests[0].advisorTeacher) : "-"}</dd></div>
                  <div><dt className="font-semibold">อนุมัติ</dt><dd className="text-muted">{schedule.approvals.filter((approval) => approval.decision === "APPROVE").length}/{schedule.approvals.length}</dd></div>
                </dl>
                {schedule.note ? <MarkdownLatexViewer className="mt-3" value={schedule.note} /> : null}
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  {schedule.project.committeeAssignments.map((assignment) => (
                    <span key={assignment.id} className="rounded-full border border-line px-3 py-1">
                      {committeeRoleLabel(assignment.role)}: {teacherDisplayName(assignment.teacher)}
                    </span>
                  ))}
                </div>
              </section>
            )) : (
              <div className="rounded-md border border-line bg-paper p-3 text-sm text-muted">ไม่มีรายการในกลุ่มนี้</div>
            )}
          </section>
        )) : (
          <EmptyState title="ยังไม่มีข้อเสนอวันสอบ" description="เมื่อมีนักศึกษาส่งวันสอบ รายการจะปรากฏที่นี่" />
        )}
      </div>
    </div>
  );
}
