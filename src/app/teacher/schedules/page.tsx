import { auth } from "@/auth";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/db";
import { formatThaiScheduleRange } from "@/lib/format/dateTime";
import { teacherDisplayName } from "@/lib/teachers/displayName";

export default async function TeacherSchedulesPage() {
  const session = await auth();
  if (!hasApprovedTeacherCapability(session?.user) || !session?.user.id) return <div className="panel">หน้านี้สำหรับอาจารย์เท่านั้น</div>;
  const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
  if (!teacher) return <EmptyState title="ยังไม่พบโปรไฟล์อาจารย์" description="กรุณา claim โปรไฟล์ก่อนใช้งาน" />;

  const schedules = await prisma.examScheduleProposal.findMany({
    where: {
      OR: [
        { approvals: { some: { teacherId: teacher.id } } },
        { project: { committeeAssignments: { some: { teacherId: teacher.id, active: true } } } },
        { project: { advisorRequests: { some: { advisorTeacherId: teacher.id, status: "APPROVED" } } } }
      ]
    },
    include: {
      courseOffering: { include: { term: true } },
      assessmentRound: true,
      project: {
        include: {
          student: true,
          committeeAssignments: { where: { active: true }, include: { teacher: true } },
          assessmentSubmissions: { orderBy: { submittedAt: "desc" } }
        }
      },
      approvals: { include: { teacher: true } }
    },
    orderBy: { proposedStartAt: "asc" }
  });

  return (
    <div className="space-y-6">
      <PageHeader title="ตารางสอบที่เกี่ยวข้อง" description="รายการวันสอบที่นักศึกษาส่งภายใต้รอบสอบระดับรายวิชา" />
      <GuidancePanel
        title="การดูตารางสอบ"
        current="อาจารย์เห็นรายการที่ตนเป็นที่ปรึกษา หรือได้รับแต่งตั้งเป็นกรรมการของโปรเจค"
        next="การอนุมัติ/ปฏิเสธเชิงละเอียดจะทำใน workflow ถัดไป"
        actor="อาจารย์ที่ปรึกษา HEAD และ MEMBER"
      />
      <div className="space-y-3">
        {schedules.length ? schedules.map((schedule) => {
          const submission = schedule.project.assessmentSubmissions.find((item) => item.kind === schedule.assessmentKind);
          const summary = typeof submission?.contentJson === "object" && submission?.contentJson && "summary" in submission.contentJson
            ? String((submission.contentJson as { summary?: unknown }).summary ?? "")
            : "";
          return (
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
            <dl className="mt-4 grid gap-2 text-sm md:grid-cols-2">
              <div><dt className="font-semibold">รายวิชา</dt><dd className="text-muted">{schedule.courseOffering?.term.displayName ?? "-"}</dd></div>
              <div><dt className="font-semibold">รอบ</dt><dd className="text-muted">{schedule.assessmentRound?.name ?? schedule.roundType ?? schedule.assessmentKind}</dd></div>
              <div><dt className="font-semibold">วันเวลา</dt><dd className="text-muted">{formatThaiScheduleRange(schedule.proposedStartAt, schedule.proposedEndAt)}</dd></div>
              <div><dt className="font-semibold">ห้อง</dt><dd className="text-muted">{schedule.room ?? "-"}</dd></div>
            </dl>
            <div className="mt-4 rounded-md border border-line bg-surface p-3 text-sm">
              <div className="font-semibold">เอกสารที่นักศึกษาส่งสำหรับรอบนี้</div>
              {submission ? (
                <div className="mt-2 space-y-2 text-muted">
                  <div>{submission.title ?? "เอกสารประกอบรอบสอบ"}</div>
                  <a className="inline-flex text-brand hover:underline" href={submission.materialLink} target="_blank" rel="noreferrer">
                    เปิดเอกสาร/หลักฐาน
                  </a>
                  {summary ? <MarkdownLatexViewer className="border-0 bg-transparent p-0" value={summary} /> : null}
                </div>
              ) : (
                <div className="mt-2 text-muted">ยังไม่พบเอกสารของรอบนี้</div>
              )}
            </div>
            {schedule.note ? <MarkdownLatexViewer className="mt-3" value={schedule.note} /> : null}
            <div className="mt-4 text-sm">
              <div className="font-semibold">กรรมการ</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {schedule.project.committeeAssignments.map((assignment) => (
                  <span key={assignment.id} className="rounded-full border border-line px-3 py-1 text-xs">
                    {assignment.role}: {teacherDisplayName(assignment.teacher)}
                  </span>
                ))}
              </div>
            </div>
          </section>
          );
        }) : (
          <EmptyState title="ยังไม่มีตารางสอบที่เกี่ยวข้อง" description="เมื่อมีนักศึกษาส่งข้อเสนอวันสอบ รายการจะปรากฏที่นี่" />
        )}
      </div>
    </div>
  );
}
