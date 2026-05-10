import { auth } from "@/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/db";
import { formatThaiScheduleRange } from "@/lib/format/dateTime";
import { teacherDisplayName } from "@/lib/teachers/displayName";

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
    orderBy: [{ proposedStartAt: "asc" }, { createdAt: "desc" }]
  });

  return (
    <div className="space-y-6">
      <PageHeader title="ตารางสอบของรายวิชา" description="รายการวันที่นักศึกษาส่งสำหรับ Progress 1, Progress 2 และ Final Presentation" />
      <GuidancePanel
        title="ภาพรวมตารางสอบ"
        current="ผู้ดูแลระบบเห็นรายการของทุกโปรเจคในรายวิชา"
        next="ใช้หน้านี้เพื่อติดตามรายการที่ส่งแล้วและสถานะการพิจารณา"
        actor="ผู้ดูแลระบบ"
      />
      <div className="space-y-3">
        {schedules.length ? schedules.map((schedule) => (
          <section key={schedule.id} className="panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{schedule.roundType ?? schedule.assessmentKind}</h2>
                <p className="mt-1 text-sm text-muted">
                  {schedule.project.student.studentCode} {schedule.project.student.firstNameTh} {schedule.project.student.lastNameTh}
                </p>
                <p className="mt-1 text-sm text-muted">{schedule.project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</p>
              </div>
              <span className="rounded-full border border-line px-3 py-1 text-xs">{schedule.status}</span>
            </div>
            <dl className="mt-4 grid gap-2 text-sm md:grid-cols-3">
              <div><dt className="font-semibold">ภาคเรียน</dt><dd className="text-muted">{schedule.courseOffering?.term.displayName ?? "-"}</dd></div>
              <div><dt className="font-semibold">รอบ</dt><dd className="text-muted">{schedule.assessmentRound?.name ?? schedule.roundType ?? schedule.assessmentKind}</dd></div>
              <div><dt className="font-semibold">วันเวลา</dt><dd className="text-muted">{formatThaiScheduleRange(schedule.proposedStartAt, schedule.proposedEndAt)}</dd></div>
              <div><dt className="font-semibold">ห้อง</dt><dd className="text-muted">{schedule.room ?? "-"}</dd></div>
              <div><dt className="font-semibold">ที่ปรึกษา</dt><dd className="text-muted">{schedule.project.advisorRequests[0]?.advisorTeacher ? teacherDisplayName(schedule.project.advisorRequests[0].advisorTeacher) : "-"}</dd></div>
              <div><dt className="font-semibold">อนุมัติ</dt><dd className="text-muted">{schedule.approvals.filter((approval) => approval.decision === "APPROVE").length}/{schedule.approvals.length}</dd></div>
            </dl>
            {schedule.note ? <MarkdownLatexViewer className="mt-3" value={schedule.note} /> : null}
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {schedule.project.committeeAssignments.map((assignment) => (
                <span key={assignment.id} className="rounded-full border border-line px-3 py-1">
                  {assignment.role}: {teacherDisplayName(assignment.teacher)}
                </span>
              ))}
            </div>
          </section>
        )) : (
          <EmptyState title="ยังไม่มีข้อเสนอวันสอบ" description="เมื่อมีนักศึกษาส่งวันสอบ รายการจะปรากฏที่นี่" />
        )}
      </div>
    </div>
  );
}
