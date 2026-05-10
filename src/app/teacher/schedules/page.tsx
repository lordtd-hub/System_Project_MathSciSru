import { auth } from "@/auth";
import { reviewExamSchedule } from "@/app/teacher/actions";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { isRoundOpen } from "@/lib/assessments/courseRounds";
import { prisma } from "@/lib/db";
import { formatThaiScheduleRange } from "@/lib/format/dateTime";
import { teacherDisplayName } from "@/lib/teachers/displayName";

function uniqueIds(ids: string[]) {
  return [...new Set(ids)];
}

export default async function TeacherSchedulesPage({
  searchParams
}: {
  searchParams?: Promise<{ success?: string; error?: string }>;
}) {
  const params = await searchParams;
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
          advisorRequests: { where: { status: "APPROVED" }, include: { advisorTeacher: true } },
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
      <ActionFeedback success={params?.success} error={params?.error} />
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
          const requiredApproverIds = uniqueIds([
            ...schedule.project.committeeAssignments
              .filter((assignment) => ["ADVISOR", "HEAD", "MEMBER"].includes(assignment.role))
              .map((assignment) => assignment.teacherId),
            ...schedule.project.advisorRequests.map((request) => request.advisorTeacherId)
          ]);
          const approvalForTeacher = schedule.approvals.find((approval) => approval.teacherId === teacher.id);
          const canReviewSchedule =
            schedule.status === "PROPOSED" &&
            (!schedule.assessmentRound || isRoundOpen(schedule.assessmentRound.status)) &&
            requiredApproverIds.includes(teacher.id) &&
            approvalForTeacher?.decision !== "APPROVE" &&
            approvalForTeacher?.decision !== "REJECT";
          const approvedCount = schedule.approvals.filter((approval) => approval.decision === "APPROVE").length;
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
              <div><dt className="font-semibold">สถานะของท่าน</dt><dd className="text-muted">{approvalForTeacher?.decision ?? (requiredApproverIds.includes(teacher.id) ? "PENDING" : "อ่านได้เท่านั้น")}</dd></div>
              <div><dt className="font-semibold">อนุมัติแล้ว</dt><dd className="text-muted">{approvedCount}/{requiredApproverIds.length}</dd></div>
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
            {canReviewSchedule ? (
              <form action={reviewExamSchedule} className="mt-4 rounded-md border border-line bg-paperSoft p-3">
                <input type="hidden" name="schedule_id" value={schedule.id} />
                <label htmlFor={`schedule-comment-${schedule.id}`}>หมายเหตุถึงนักศึกษา/กรรมการ</label>
                <textarea id={`schedule-comment-${schedule.id}`} name="comment" rows={3} placeholder="ถ้าไม่อนุมัติ กรุณาระบุเหตุผลหรือเวลาที่สะดวกกว่า" />
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <SubmitButton name="decision" value="APPROVE" pendingText="กำลังอนุมัติ...">
                    อนุมัติวันสอบ
                  </SubmitButton>
                  <SubmitButton name="decision" value="REJECT" className="button-danger" pendingText="กำลังบันทึก...">
                    ไม่อนุมัติ / ขอเปลี่ยนเวลา
                  </SubmitButton>
                </div>
              </form>
            ) : requiredApproverIds.includes(teacher.id) ? (
              <div className="mt-4 rounded-md border border-line bg-paperSoft p-3 text-sm text-muted">
                {schedule.status !== "PROPOSED"
                  ? "รายการนี้ไม่อยู่ในสถานะรออนุมัติแล้ว"
                  : schedule.assessmentRound && !isRoundOpen(schedule.assessmentRound.status)
                    ? "รอบสอบนี้ถูกปิดแล้ว จึงไม่แสดงเป็นงานที่ต้องอนุมัติ"
                    : "ท่านพิจารณารายการนี้แล้ว"}
              </div>
            ) : null}
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
