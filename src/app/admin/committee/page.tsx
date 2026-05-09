import Link from "next/link";
import { auth } from "@/auth";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { assignProjectCommittee } from "@/app/admin/actions";
import { WarningAlert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/db";
import { teacherDisplayName } from "@/lib/teachers/displayName";

export default async function AdminCommitteePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return <div className="panel">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</div>;
  const params = (await searchParams) ?? {};

  const [projects, teachers] = await Promise.all([
    prisma.project.findMany({
      where: { status: "TOPIC_APPROVED" },
      include: {
        student: true,
        committeeAssignments: { include: { teacher: true } },
        advisorRequests: {
          include: { advisorTeacher: true },
          orderBy: { requestedAt: "desc" }
        }
      },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.teacher.findMany({ where: { active: true, isInternal: true }, orderBy: [{ firstNameTh: "asc" }] })
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="แต่งตั้งกรรมการ"
        description="สำหรับโปรเจคที่ TOPIC_APPROVED แล้ว ผู้ดูแลระบบแต่งตั้ง HEAD และ MEMBER"
      />
      <ActionFeedback success={params.success} error={params.error} />
      {params.success === "committee_saved" ? (
        <Link className="button" href="/admin/rounds">ไปหน้าเปิดรอบ Progress 1</Link>
      ) : null}
      <GuidancePanel
        title="กติกาการแต่งตั้ง"
        current="ตรวจ advisor ที่อนุมัติแล้ว และเลือก HEAD กับ MEMBER"
        next="หลังแต่งตั้งครบ โปรเจคจะเข้าสู่ IN_PROGRESS และนักศึกษาจะเสนอวันสอบ Progress/Final"
        actor="ผู้ดูแลระบบเป็นผู้แต่งตั้งกรรมการ"
      />
      <WarningAlert title="Validation ที่ต้องตรวจ">
        ต้องมี HEAD อย่างน้อย 1 คน และ MEMBER อย่างน้อย 1 คน โดย advisor จะแสดงเป็น ADVISOR อัตโนมัติ และไม่ควรเลือกซ้ำเป็น HEAD/MEMBER
      </WarningAlert>
      <div className="space-y-4">
        {projects.length ? (
          projects.map((project) => {
            const approvedAdvisor = project.advisorRequests.find((request) => request.status === "APPROVED")?.advisorTeacher;
            return (
              <section key={project.id} className="panel">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}
                    </p>
                  </div>
                  <StatusBadge status={project.status} />
                </div>
                <div className="mt-4 rounded-md border border-line bg-paper p-3 text-sm">
                  Advisor อัตโนมัติ: {approvedAdvisor ? teacherDisplayName(approvedAdvisor) : "ยังไม่พบข้อมูล advisor"}
                </div>
                <form action={assignProjectCommittee} className="mt-4 grid gap-3 md:grid-cols-3">
                  <input type="hidden" name="project_id" value={project.id} />
                  <div>
                    <label>HEAD</label>
                    <select name="head_teacher_id" defaultValue="" required>
                      <option value="">เลือก HEAD</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>{teacherDisplayName(teacher)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>MEMBER</label>
                    <select name="member_teacher_id" defaultValue="" required>
                      <option value="">เลือก MEMBER</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>{teacherDisplayName(teacher)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <SubmitButton className="w-full" pendingText="กำลังบันทึก..." confirmMessage="ยืนยันการบันทึกการแต่งตั้งกรรมการหรือไม่? ระบบจะเปลี่ยนสถานะโครงงานไป IN_PROGRESS">
                      บันทึกการแต่งตั้ง HEAD และ MEMBER
                    </SubmitButton>
                  </div>
                </form>
                <div className="mt-4 space-y-2 text-sm">
                  {project.committeeAssignments.map((assignment) => (
                    <div key={assignment.id} className="rounded-md border border-line p-2">
                      {assignment.role}: {teacherDisplayName(assignment.teacher)}
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        ) : (
          <EmptyState
            title="ยังไม่มีหัวข้อที่รอตั้งกรรมการ"
            description="เมื่อ Admin ตัดสิน Proposal เป็น PASS โปรเจคจะแสดงที่นี่เพื่อแต่งตั้ง HEAD และ MEMBER"
          />
        )}
      </div>
    </div>
  );
}
