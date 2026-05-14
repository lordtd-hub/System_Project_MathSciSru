import Link from "next/link";
import { auth } from "@/auth";
import { reviewExamSchedule } from "@/app/teacher/actions";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TeacherCompactQueueList, TeacherQueueBadge, TeacherQueueSection, TeacherWorkloadSummary } from "@/components/ui/TeacherWorkloadQueue";
import { isRoundOpen } from "@/lib/assessments/courseRounds";
import { hasOpenLateRoundException } from "@/lib/assessments/roundExceptions";
import { prisma } from "@/lib/db";
import { formatThaiScheduleRange } from "@/lib/format/dateTime";
import { teacherDisplayName } from "@/lib/teachers/displayName";

function uniqueIds(ids: string[]) {
  return [...new Set(ids)];
}

function committeeRoleLabel(role: string) {
  if (role === "ADVISOR") return "อาจารย์ที่ปรึกษา";
  if (role === "HEAD") return "ประธานกรรมการ";
  if (role === "MEMBER") return "กรรมการ";
  return role;
}

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
  if (status === "PENDING") return "รอดำเนินการ";
  if (status === "APPROVE") return "อนุมัติแล้ว";
  if (status === "REJECT") return "ไม่สะดวก";
  return status ?? "-";
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
  if (!teacher) return <EmptyState title="ยังไม่พบโปรไฟล์อาจารย์" description="กรุณาส่งคำขอผูกบัญชีอาจารย์ก่อนใช้งาน" />;

  const [schedules, confirmedScheduleCalendar] = await Promise.all([
    prisma.examScheduleProposal.findMany({
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
            assessmentSubmissions: { orderBy: { submittedAt: "desc" } },
            roundExceptions: {
              where: { status: "OPEN" },
              include: { assessmentRound: { select: { roundType: true } } }
            }
          }
        },
        approvals: { include: { teacher: true } }
      },
      orderBy: [{ createdAt: "asc" }, { proposedStartAt: "asc" }]
    }),
    prisma.examScheduleProposal.findMany({
      where: { status: "CONFIRMED" },
      select: {
        id: true,
        assessmentKind: true,
        roundType: true,
        proposedStartAt: true,
        proposedEndAt: true,
        room: true,
        project: {
          select: {
            id: true,
            currentTitleTh: true,
            student: { select: { studentCode: true, firstNameTh: true, lastNameTh: true } },
            committeeAssignments: {
              where: { active: true },
              select: {
                role: true,
                teacher: { select: { academicPrefix: true, firstNameTh: true, lastNameTh: true } }
              },
              orderBy: { appointedAt: "asc" }
            }
          }
        }
      },
      orderBy: { proposedStartAt: "asc" },
      take: 100
    })
  ]);
  const isScheduleRoundReviewable = (schedule: (typeof schedules)[number]) => {
    if (!schedule.assessmentRound || isRoundOpen(schedule.assessmentRound.status)) return true;
    const roundType = schedule.roundType ?? schedule.assessmentRound.roundType;
    return schedule.project.roundExceptions.some(
      (exception) => exception.assessmentRound?.roundType === roundType && hasOpenLateRoundException([exception])
    );
  };
  const pendingReviewSchedules = schedules.filter((schedule) =>
    schedule.status === "PROPOSED" &&
    isScheduleRoundReviewable(schedule) &&
    schedule.approvals.some((approval) => approval.teacherId === teacher.id && approval.decision === "PENDING")
  );
  const pendingReviewScheduleIds = new Set(pendingReviewSchedules.map((schedule) => schedule.id));
  const waitingSchedules = schedules.filter((schedule) =>
    schedule.status === "PROPOSED" &&
    isScheduleRoundReviewable(schedule) &&
    !pendingReviewScheduleIds.has(schedule.id)
  );
  const returnedSchedules = schedules.filter((schedule) => schedule.status === "REJECTED");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="ตารางสอบที่เกี่ยวข้อง" description="รายการวันสอบที่นักศึกษาส่งภายใต้รอบสอบระดับรายวิชา" />
      <ActionFeedback success={params?.success} error={params?.error} />
      <GuidancePanel
        title="การดูตารางสอบ"
        current="อาจารย์เห็นรายการที่ตนเป็นที่ปรึกษา หรือได้รับแต่งตั้งเป็นกรรมการของโครงงาน"
        next="พิจารณาอนุมัติหรือไม่อนุมัติวันสอบจากข้อมูลที่นักศึกษาเสนอ"
        actor="อาจารย์ที่ปรึกษา ประธานกรรมการ และกรรมการ"
      />
      <TeacherWorkloadSummary
        metrics={[
          { label: "ต้องดำเนินการ", count: pendingReviewSchedules.length, tone: "action", description: "คำขอวันสอบที่รอท่านอนุมัติ" },
          { label: "รอ", count: waitingSchedules.length, tone: "waiting", description: "รายการที่รอกรรมการท่านอื่นหรือรอสรุปสถานะ" },
          { label: "เสร็จแล้ว", count: confirmedScheduleCalendar.length, tone: "completed", description: "ตารางสอบที่ยืนยันแล้ว" },
          { label: "ส่งกลับ", count: returnedSchedules.length, tone: "returned", description: "คำขอที่มีผู้ไม่สะดวก" },
          { label: "ยังไม่เปิด", count: 0, tone: "locked", description: "รอบที่ปิดแล้วไม่ใช่งานอนุมัติ" }
        ]}
      />
      <TeacherQueueSection
        title="คิวอนุมัติวันสอบ"
        description="สรุปรายการแบบย่อก่อนลงรายละเอียด เพื่อให้สแกนงานจำนวนมากได้เร็วขึ้น"
        count={pendingReviewSchedules.length}
        tone="action"
        emptyState={<EmptyState title="ยังไม่มีรายการรออนุมัติวันสอบ" description="รายการที่อนุมัติแล้วหรือรอบที่ปิดแล้วจะไม่แสดงเป็นงานที่ต้องดำเนินการ" />}
      >
        <TeacherCompactQueueList
          items={pendingReviewSchedules.map((schedule) => ({
            id: schedule.id,
            href: `#schedule-${schedule.id}`,
            title: schedule.project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ",
            description: `${schedule.project.student.studentCode} ${schedule.project.student.firstNameTh} ${schedule.project.student.lastNameTh}`,
            meta: `${scheduleRoundLabel(schedule.roundType ?? schedule.assessmentKind)} · ${formatThaiScheduleRange(schedule.proposedStartAt, schedule.proposedEndAt)}${schedule.room ? ` · ห้อง ${schedule.room}` : ""}`,
            badges: [
              { label: "ต้องดำเนินการ", tone: "action" },
              { label: scheduleStatusLabel(schedule.status), tone: "waiting" }
            ]
          }))}
        />
      </TeacherQueueSection>
      {waitingSchedules.length ? (
        <TeacherQueueSection
          title="รอกรรมการท่านอื่น / อ่านสถานะ"
          description="รายการที่ท่านไม่ต้องกดอนุมัติตอนนี้ แยกออกจากงานหลักเพื่อลดความรกของคิว"
          count={waitingSchedules.length}
          tone="waiting"
        >
          <TeacherCompactQueueList
            items={waitingSchedules.map((schedule) => ({
              id: schedule.id,
              title: schedule.project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ",
              description: `${schedule.project.student.studentCode} ${schedule.project.student.firstNameTh} ${schedule.project.student.lastNameTh}`,
              meta: `${scheduleRoundLabel(schedule.roundType ?? schedule.assessmentKind)} · ${formatThaiScheduleRange(schedule.proposedStartAt, schedule.proposedEndAt)}`,
              badges: [
                { label: scheduleStatusLabel(schedule.status), tone: "waiting" }
              ]
            }))}
          />
        </TeacherQueueSection>
      ) : null}
      {returnedSchedules.length ? (
        <TeacherQueueSection
          title="ส่งกลับ / ต้องเสนอเวลาใหม่"
          description="รายการที่มีผู้ไม่สะดวก แยกไว้เป็นหลักฐานสถานะโดยไม่ปนกับงานอนุมัติ"
          count={returnedSchedules.length}
          tone="returned"
        >
          <TeacherCompactQueueList
            items={returnedSchedules.map((schedule) => ({
              id: schedule.id,
              title: schedule.project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ",
              description: `${schedule.project.student.studentCode} ${schedule.project.student.firstNameTh} ${schedule.project.student.lastNameTh}`,
              meta: `${scheduleRoundLabel(schedule.roundType ?? schedule.assessmentKind)} · ${formatThaiScheduleRange(schedule.proposedStartAt, schedule.proposedEndAt)}`,
              badges: [
                { label: scheduleStatusLabel(schedule.status), tone: "returned" }
              ]
            }))}
          />
        </TeacherQueueSection>
      ) : null}
      <section className="panel order-3">
        <h2 className="text-lg font-semibold">ตารางสอบที่ยืนยันแล้ว</h2>
        <p className="mt-1 text-sm text-muted">
          อาจารย์ทุกท่านสามารถดูตารางสอบที่ยืนยันแล้วได้ เพื่อวางแผนเข้าร่วมฟังหรือหลีกเลี่ยงเวลาซ้อนกัน โดยส่วนนี้ไม่แสดงเอกสารหลักฐานของนักศึกษา
        </p>
        <div className="teacher-scroll-list mt-3 space-y-2">
          {confirmedScheduleCalendar.length ? confirmedScheduleCalendar.map((schedule) => (
            <div key={schedule.id} className="rounded-md border border-line bg-surface p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{scheduleRoundLabel(schedule.roundType ?? schedule.assessmentKind)}</div>
                  <div className="mt-1 text-muted">
                    {schedule.project.student.studentCode} {schedule.project.student.firstNameTh} {schedule.project.student.lastNameTh}
                    {schedule.project.currentTitleTh ? ` · ${schedule.project.currentTitleTh}` : ""}
                  </div>
                </div>
                <div className="text-right font-semibold text-ink">
                  {formatThaiScheduleRange(schedule.proposedStartAt, schedule.proposedEndAt)}
                  {schedule.room ? <div className="text-xs text-muted">ห้อง {schedule.room}</div> : null}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {schedule.project.committeeAssignments.map((assignment) => (
                  <span key={`${schedule.id}-${assignment.role}-${teacherDisplayName(assignment.teacher)}`} className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                    {committeeRoleLabel(assignment.role)}: {teacherDisplayName(assignment.teacher)}
                  </span>
                ))}
              </div>
            </div>
          )) : (
            <EmptyState title="ยังไม่มีตารางสอบที่ยืนยันแล้ว" description="เมื่อกรรมการอนุมัติวันสอบครบ รายการจะปรากฏที่นี่" />
          )}
        </div>
      </section>
      <section className="panel order-1">
        <h2 className="text-lg font-semibold">รายการรออนุมัติวันสอบของท่าน</h2>
        <p className="mt-1 text-sm text-muted">
          แสดงเฉพาะคำขอที่ยังรอให้ท่านอนุมัติหรือไม่อนุมัติ ตารางที่ยืนยันแล้วอยู่ในส่วนด้านบน
        </p>
      </section>
      <div className="order-1 space-y-3">
        {pendingReviewSchedules.length ? pendingReviewSchedules.map((schedule) => {
          const submission = schedule.project.assessmentSubmissions.find((item) => item.kind === schedule.assessmentKind);
          const requiredApproverIds = uniqueIds([
            ...schedule.project.committeeAssignments
              .filter((assignment) => ["ADVISOR", "HEAD", "MEMBER"].includes(assignment.role))
              .map((assignment) => assignment.teacherId),
            ...schedule.project.advisorRequests.map((request) => request.advisorTeacherId)
          ]);
          const approvalForTeacher = schedule.approvals.find((approval) => approval.teacherId === teacher.id);
          const canReviewSchedule =
            schedule.status === "PROPOSED" &&
            isScheduleRoundReviewable(schedule) &&
            requiredApproverIds.includes(teacher.id) &&
            approvalForTeacher?.decision !== "APPROVE" &&
            approvalForTeacher?.decision !== "REJECT";
          const approvedCount = schedule.approvals.filter((approval) => approval.decision === "APPROVE").length;
          const rejectedCount = schedule.approvals.filter((approval) => approval.decision === "REJECT").length;
          const pendingCount = Math.max(requiredApproverIds.length - approvedCount - rejectedCount, 0);
          return (
          <section key={schedule.id} id={`schedule-${schedule.id}`} className="panel teacher-review-card scroll-mt-24">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{scheduleRoundLabel(schedule.roundType ?? schedule.assessmentKind)}</h2>
                <p className="mt-1 text-sm text-muted">
                  {schedule.project.student.studentCode} {schedule.project.student.firstNameTh} {schedule.project.student.lastNameTh}
                </p>
                <p className="mt-1 text-sm text-muted">{schedule.project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="button-secondary" href={`/projects/${schedule.project.id}`}>ดูแฟ้มโครงงาน</Link>
                <TeacherQueueBadge tone="action">ต้องดำเนินการ</TeacherQueueBadge>
                <TeacherQueueBadge tone="waiting">{scheduleStatusLabel(schedule.status)}</TeacherQueueBadge>
              </div>
            </div>
            {schedule.status === "REJECTED" ? (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                มีอาจารย์ไม่สะดวกตามเวลานี้แล้ว รายการนี้ปิดการอนุมัติและต้องรอนักศึกษาเสนอวันสอบใหม่อีกครั้ง
              </div>
            ) : null}
            <dl className="mt-4 grid gap-2 text-sm md:grid-cols-2">
              <div><dt className="font-semibold">รายวิชา</dt><dd className="text-muted">{schedule.courseOffering?.term.displayName ?? "-"}</dd></div>
              <div><dt className="font-semibold">รอบ</dt><dd className="text-muted">{schedule.assessmentRound?.name ?? scheduleRoundLabel(schedule.roundType ?? schedule.assessmentKind)}</dd></div>
              <div><dt className="font-semibold">วันเวลา</dt><dd className="text-muted">{formatThaiScheduleRange(schedule.proposedStartAt, schedule.proposedEndAt)}</dd></div>
              <div><dt className="font-semibold">ห้อง</dt><dd className="text-muted">{schedule.room ?? "-"}</dd></div>
              <div><dt className="font-semibold">สถานะของท่าน</dt><dd className="text-muted">{scheduleStatusLabel(approvalForTeacher?.decision ?? (requiredApproverIds.includes(teacher.id) ? "PENDING" : "อ่านได้เท่านั้น"))}</dd></div>
              <div><dt className="font-semibold">อนุมัติแล้ว</dt><dd className="text-muted">{approvedCount}/{requiredApproverIds.length}</dd></div>
              <div><dt className="font-semibold">สถานะกรรมการรวม</dt><dd className="text-muted">อนุมัติ {approvedCount}/{requiredApproverIds.length} · ไม่สะดวก {rejectedCount} · รอ {pendingCount}</dd></div>
            </dl>
            <div className="mt-4 rounded-md border border-line bg-surface p-3 text-sm">
              <div className="font-semibold">เอกสารที่นักศึกษาส่งสำหรับรอบนี้</div>
              {submission ? (
                <div className="mt-2 space-y-2 text-muted">
                  <div>{submission.title ?? "เอกสารประกอบรอบสอบ"}</div>
                  <a className="inline-flex text-brand hover:underline" href={submission.materialLink} target="_blank" rel="noreferrer">
                    เปิดเอกสาร/หลักฐาน
                  </a>
                </div>
              ) : (
                <div className="mt-2 text-muted">ยังไม่พบเอกสารของรอบนี้</div>
              )}
            </div>
            {schedule.note ? <MarkdownLatexViewer className="mt-3" value={schedule.note} /> : null}
            {canReviewSchedule ? (
              <div className="mt-4 rounded-md border border-line bg-paperSoft p-3">
                <div className="text-sm font-semibold">พิจารณาวันสอบ</div>
                <div className="mt-3 grid gap-3 md:grid-cols-[auto_minmax(0,1fr)]">
                  <form action={reviewExamSchedule} className="flex items-end">
                    <input type="hidden" name="schedule_id" value={schedule.id} />
                    <input type="hidden" name="decision" value="APPROVE" />
                    <SubmitButton pendingText="กำลังอนุมัติ...">อนุมัติวันสอบ</SubmitButton>
                  </form>
                  <form action={reviewExamSchedule} className="space-y-2">
                    <input type="hidden" name="schedule_id" value={schedule.id} />
                    <input type="hidden" name="decision" value="REJECT" />
                    <label htmlFor={`schedule-comment-${schedule.id}`}>เหตุผลกรณีไม่อนุมัติ / เวลาที่สะดวกกว่า</label>
                    <textarea id={`schedule-comment-${schedule.id}`} name="comment" rows={3} required placeholder="กรุณาระบุเหตุผลเพื่อให้นักศึกษาเสนอวันสอบใหม่ได้ถูกต้อง" />
                    <SubmitButton className="button-danger" pendingText="กำลังบันทึก...">ไม่อนุมัติ / ขอเปลี่ยนเวลา</SubmitButton>
                  </form>
                </div>
              </div>
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
                    {committeeRoleLabel(assignment.role)}: {teacherDisplayName(assignment.teacher)}
                  </span>
                ))}
              </div>
            </div>
          </section>
          );
        }) : (
          <EmptyState title="ยังไม่มีรายการรออนุมัติวันสอบ" description="รายการที่อนุมัติแล้วหรือรอบที่ปิดแล้วจะไม่แสดงในส่วนอนุมัติ" />
        )}
      </div>
    </div>
  );
}
