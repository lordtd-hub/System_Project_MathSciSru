import { auth } from "@/auth";
import { submitExamSchedule } from "@/app/student/actions";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { WarningAlert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormSection } from "@/components/ui/FormSection";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { MarkdownLatexEditor } from "@/components/ui/MarkdownLatexEditor";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { PageHeader } from "@/components/ui/PageHeader";
import { DraftPreservingForm } from "@/components/ui/ProposalDraftForm";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { isRoundOpen } from "@/lib/assessments/courseRounds";
import { getProgress1Readiness, reasonLabelTh } from "@/lib/assessments/roundEligibility";
import { prisma } from "@/lib/db";
import { getAssessmentCardState } from "@/lib/lifecycle/nextActions";
import { assessmentKindToRoundType } from "@/lib/scheduling/scheduleRules";

const scheduleRoundTypes = ["PROGRESS_1", "PROGRESS_2", "FINAL_PRESENTATION"] as const;

export default async function StudentSchedulePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user.role !== "STUDENT" || !session.user.email) {
    return <div className="panel">หน้านี้สำหรับนักศึกษาเท่านั้น</div>;
  }

  const student = await prisma.student.findUnique({
    where: { generatedEmail: session.user.email.toLowerCase() },
    include: {
      projects: {
        orderBy: { createdAt: "desc" },
        include: {
          scheduleProposals: {
            include: { approvals: { include: { teacher: true } }, assessmentRound: true },
            orderBy: { createdAt: "desc" }
          },
          assessmentSubmissions: { orderBy: { submittedAt: "desc" } },
          proposalResults: { orderBy: { decidedAt: "desc" }, take: 1 },
          committeeAssignments: true,
          roundExceptions: { where: { assessmentRound: { roundType: "PROGRESS_1" } } }
        }
      }
    }
  });
  if (!student) {
    return <EmptyState title="ยังไม่พบข้อมูลนักศึกษา" description="บัญชีนี้ยังไม่อยู่ใน roster ที่นำเข้า กรุณาติดต่อผู้ดูแลระบบ" />;
  }

  const project = student.projects[0];
  if (!project) {
    return <EmptyState title="ยังไม่มีโปรเจค" description="ยังไม่พบโปรเจคสำหรับเสนอวันสอบ" />;
  }

  const params = (await searchParams) ?? {};
  const rounds = await prisma.assessmentRound.findMany({
    where: { courseOfferingId: project.courseOfferingId, roundType: { in: [...scheduleRoundTypes] } }
  });
  const roundMap = new Map(rounds.map((round) => [round.roundType, round]));
  const progress1Round = roundMap.get("PROGRESS_1");
  const progress1Readiness = getProgress1Readiness(project);
  const progress1Open = progress1Round ? isRoundOpen(progress1Round.status) : false;
  const progress1BlockedText = !progress1Open
    ? "รอบ Progress 1 ยังไม่เปิด"
    : progress1Readiness.reasons.map(reasonLabelTh)[0] ?? "ยังไม่พร้อมสำหรับ Progress 1";
  const completed = {
    PROGRESS_1: project.assessmentSubmissions.some((item) => item.kind === "PROGRESS_1"),
    PROGRESS_2: project.assessmentSubmissions.some((item) => item.kind === "PROGRESS_2"),
    FINAL_PRESENT: project.assessmentSubmissions.some((item) => item.kind === "FINAL_PRESENT")
  };
  const anyOpenRound = rounds.some((round) => isRoundOpen(round.status));

  return (
    <div className="space-y-6">
      <PageHeader
        title="เสนอวันสอบ Progress / Final"
        description="เสนอหรือแก้ไขวัน เวลา และห้องสอบภายใต้รอบสอบระดับรายวิชาที่เปิดอยู่"
        actions={<StatusBadge status={project.status} />}
      />
      <ActionFeedback success={params.success} error={params.error} />
      <GuidancePanel
        title="การนัดสอบ"
        current="นักศึกษาเสนอวัน เวลา ห้องสอบ และหมายเหตุให้กรรมการพิจารณา"
        next="เมื่อส่งแล้ว กรรมการที่ได้รับแต่งตั้งจะเห็นรายการนี้ในหน้าตารางสอบ"
        actor="นักศึกษาส่งคำขอ กรรมการ HEAD/MEMBER เป็นผู้พิจารณาตาม workflow ปัจจุบัน"
      />
      <section className="grid gap-3 md:grid-cols-3">
        {(["PROGRESS_1", "PROGRESS_2", "FINAL_PRESENT"] as const).map((kind) => {
          const latest = project.scheduleProposals.find((proposal) => proposal.assessmentKind === kind);
          const rawState = getAssessmentCardState(
            kind,
            project.status,
            completed,
            latest?.status === "CONFIRMED" ? "CONFIRMED" : latest?.status === "PROPOSED" ? "PROPOSED" : latest?.status === "REJECTED" ? "REJECTED" : "NONE",
            project.assessmentSubmissions.some((item) => item.kind === kind)
          );
          const state = kind === "PROGRESS_1" && (!progress1Open || !progress1Readiness.eligible)
            ? { label: progress1BlockedText, buttonLabel: "ยังไม่พร้อม", editable: false }
            : rawState;
          return (
            <div key={kind} className="panel">
              <div className="text-sm text-muted">{kind}</div>
              <h2 className="mt-1 text-lg font-semibold">{state.label}</h2>
              <p className="mt-2 text-sm text-muted">
                {state.editable ? "ดำเนินการได้จากแบบฟอร์มด้านล่างเมื่อรอบสอบเปิดอยู่" : "ขั้นตอนนี้ยังไม่ใช่ action หลักที่แก้ไขได้ตอนนี้"}
              </p>
              <button type="button" disabled={!state.editable} className="mt-3">{state.buttonLabel}</button>
            </div>
          );
        })}
      </section>
      <FormSection title="เสนอวันสอบใหม่" description="ระบบจะอัปเดตรายการเดิมของโปรเจคนี้ในรอบเดียวกัน ไม่สร้างรายการซ้ำ">
        {!progress1Open ? (
          <WarningAlert title="รอบ Progress 1 ยังไม่เปิด">นักศึกษาจะเสนอวันสอบ Progress 1 ได้หลังผู้ดูแลระบบเปิดรอบระดับรายวิชา</WarningAlert>
        ) : !progress1Readiness.eligible ? (
          <WarningAlert title={progress1Readiness.reasons.map(reasonLabelTh)[0] ?? "ยังไม่พร้อมสำหรับ Progress 1"} />
        ) : null}
        <DraftPreservingForm action={submitExamSchedule} storageKey={`student-schedule-draft:${project.id}`} clearOnSuccess={params.success === "schedule_saved"} className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label>รอบการสอบ</label>
            <select name="round_type" defaultValue="PROGRESS_1">
              {scheduleRoundTypes.map((roundType) => {
                const round = roundMap.get(roundType);
                const disabled = project.status !== "IN_PROGRESS" || !round || !isRoundOpen(round.status) || (roundType === "PROGRESS_1" && !progress1Readiness.eligible);
                return (
                  <option key={roundType} value={roundType} disabled={disabled}>
                    {roundType === "FINAL_PRESENTATION" ? "Final Present" : roundType.replace("_", " ")} {round && isRoundOpen(round.status) ? "" : "(ยังไม่เปิด)"}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label>วันที่</label>
            <input name="schedule_date" type="date" required />
          </div>
          <div>
            <label>ห้องสอบ</label>
            <input name="room" placeholder="เช่น MS-301" />
          </div>
          <div>
            <label>เวลาเริ่ม</label>
            <input name="start_time" type="time" required />
          </div>
          <div>
            <label>เวลาสิ้นสุด</label>
            <input name="end_time" type="time" />
          </div>
          <div className="md:col-span-3">
            <MarkdownLatexEditor name="schedule_note" label="หมายเหตุถึงกรรมการ" placeholder="เช่น เนื้อหาที่จะนำเสนอ ปัญหาที่ต้องการ feedback หรือข้อจำกัดเวลา ใช้ $...$ ได้" required={false} rows={4} />
          </div>
          <div className="md:col-span-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" data-draft-save className="button-secondary w-full sm:w-auto">
                บันทึกไว้ก่อน
              </button>
              <SubmitButton disabled={project.status !== "IN_PROGRESS" || !anyOpenRound} pendingText="กำลังบันทึกวันสอบ..." className="w-full sm:w-auto">
                ส่ง/แก้ไขข้อเสนอวันสอบ
              </SubmitButton>
            </div>
          </div>
        </DraftPreservingForm>
      </FormSection>
      <section className="panel">
        <h2 className="text-lg font-semibold">ข้อเสนอวันสอบล่าสุด</h2>
        <div className="mt-3 space-y-3">
          {project.scheduleProposals.length ? (
            project.scheduleProposals.map((proposal) => {
              const confirmed = proposal.approvals.length > 0 && proposal.approvals.every((approval) => approval.decision === "APPROVE");
              return (
                <div key={proposal.id} className="rounded-md border border-line p-3 text-sm">
                  <div className="font-medium">{assessmentKindToRoundType(proposal.assessmentKind)} · {proposal.status}</div>
                  <div className="mt-1 text-muted">
                    {proposal.proposedStartAt.toLocaleString("th-TH")} {proposal.room ? `· ห้อง ${proposal.room}` : ""}
                  </div>
                  {proposal.note ? <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0" value={proposal.note} /> : null}
                  <div className="mt-2 text-muted">
                    อนุมัติแล้ว {proposal.approvals.filter((approval) => approval.decision === "APPROVE").length}/{proposal.approvals.length}
                    {confirmed ? " · ตารางยืนยันแล้ว" : " · ยังรอกรรมการอนุมัติ"}
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState title="ยังไม่มีการเสนอวันสอบ" description="เมื่อรอบสอบเปิดและโปรเจคพร้อม รายการที่ส่งจะปรากฏที่นี่" />
          )}
        </div>
      </section>
    </div>
  );
}
