import { auth } from "@/auth";
import { saveAssessmentEvidence, submitExamSchedule } from "@/app/student/actions";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { WarningAlert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { FinalQaRubricPanel } from "@/components/ui/FinalQaRubricPanel";
import { FormSection } from "@/components/ui/FormSection";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { MarkdownLatexEditor } from "@/components/ui/MarkdownLatexEditor";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { MaterialLinkField } from "@/components/ui/MaterialLinkField";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressPlanCheckpointPanel } from "@/components/ui/ProgressPlanCheckpointPanel";
import { ProgressQaRubricPanel } from "@/components/ui/ProgressQaRubricPanel";
import { DraftPreservingForm } from "@/components/ui/ProposalDraftForm";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { isRoundOpen } from "@/lib/assessments/courseRounds";
import { getProgress1Readiness, reasonLabelTh } from "@/lib/assessments/roundEligibility";
import { prisma } from "@/lib/db";
import { getAssessmentCardState } from "@/lib/lifecycle/nextActions";
import { isQaProgressPlanCheckEnabled } from "@/lib/qa/progressPlanCheckConfig";
import { assessmentKindToRoundType } from "@/lib/scheduling/scheduleRules";

const scheduleRoundTypes = ["PROGRESS_1", "PROGRESS_2", "FINAL_PRESENTATION"] as const;

function scheduleRoundLabel(roundType: (typeof scheduleRoundTypes)[number]) {
  if (roundType === "PROGRESS_1") return "Progress 1";
  if (roundType === "PROGRESS_2") return "Progress 2";
  return "Final Presentation";
}

function scheduleKindLabel(kind: "PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENT") {
  if (kind === "PROGRESS_1") return "Progress 1";
  if (kind === "PROGRESS_2") return "Progress 2";
  return "Final Presentation";
}

function roundTypeToScheduleKind(roundType: (typeof scheduleRoundTypes)[number]) {
  return roundType === "FINAL_PRESENTATION" ? "FINAL_PRESENT" : roundType;
}

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
          presentationSubmissions: {
            orderBy: { submittedAt: "desc" },
            take: 1,
            select: { contentJson: true }
          },
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
  const showQaProgressPlanCheck = isQaProgressPlanCheckEnabled();
  const proposalContent = project.presentationSubmissions[0]?.contentJson as Record<string, unknown> | undefined;
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
  const latestSubmissionByKind = new Map<"PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENT", (typeof project.assessmentSubmissions)[number]>();
  for (const submission of project.assessmentSubmissions) {
    if (submission.kind === "PROGRESS_1" || submission.kind === "PROGRESS_2" || submission.kind === "FINAL_PRESENT") {
      if (!latestSubmissionByKind.has(submission.kind)) latestSubmissionByKind.set(submission.kind, submission);
    }
  }
  const anyOpenRound = rounds.some((round) => isRoundOpen(round.status));
  const visibleGuidanceRounds = scheduleRoundTypes.filter((roundType) => {
    const round = roundMap.get(roundType);
    if (!round || !isRoundOpen(round.status)) return false;
    if (roundType === "PROGRESS_1") return progress1Readiness.eligible;
    return true;
  });
  const schedulableRoundsWithEvidence = visibleGuidanceRounds.filter((roundType) => latestSubmissionByKind.has(roundTypeToScheduleKind(roundType)));

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
      <section className="panel">
        <h2 className="text-lg font-semibold">เกณฑ์และหลักฐานแยกตามรอบสอบ</h2>
        <p className="mt-1 text-sm text-muted">
          เลือกรอบสอบในแบบฟอร์มด้านล่างให้ตรงกับงานปัจจุบัน ระบบจะแยก rubric ของ Progress 1, Progress 2 และ Final Presentation ไม่ใช้เกณฑ์เดียวกันปนกัน
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {scheduleRoundTypes.map((roundType) => {
            const round = roundMap.get(roundType);
            const open = Boolean(round && isRoundOpen(round.status));
            const disabledReason = roundType === "PROGRESS_1" && open && !progress1Readiness.eligible ? "ยังไม่พร้อม" : "ยังไม่เปิด";
            return (
              <a
                key={roundType}
                className={open ? "button-secondary" : "workflow-chip text-muted"}
                href={`#${roundType.toLowerCase().replaceAll("_", "-")}-rubric`}
              >
                {scheduleRoundLabel(roundType)} {open ? "" : `(${disabledReason})`}
              </a>
            );
          })}
        </div>
      </section>

      <div className="space-y-4">
        {visibleGuidanceRounds.map((roundType) => (
          <div key={roundType} id={`${roundType.toLowerCase().replaceAll("_", "-")}-rubric`} className="scroll-mt-24 space-y-4">
            {roundType === "PROGRESS_1" || roundType === "PROGRESS_2" ? (
              <>
                {showQaProgressPlanCheck ? (
                  <ProgressPlanCheckpointPanel roundType={roundType} timelineItems={proposalContent?.timelineItems} audience="student" />
                ) : null}
                <ProgressQaRubricPanel roundLabel={roundType === "PROGRESS_1" ? "Progress 1" : "Progress 2"} />
              </>
            ) : (
              <>
                <section className="panel">
                  <h2 className="text-lg font-semibold">Final assessment guidance</h2>
                  <div className="mt-3 grid gap-3 text-sm text-muted md:grid-cols-2">
                    <p>Final จะตรวจว่างานที่เสร็จแล้วสอดคล้องกับวัตถุประสงค์ที่อนุมัติใน Proposal หรือไม่</p>
                    <p>หลักฐานควรเป็นผลลัพธ์ที่ตรวจสอบได้ เช่น proof draft, dataset, implementation, screenshots, experiment results, logs หรือ report sections</p>
                    <p>วิธีดำเนินงานและผลลัพธ์ควรเชื่อมกับแผน 16 สัปดาห์ และ Progress history ที่เคยส่งไว้</p>
                    <p>ถ้ามีการเลื่อน/ปรับแผน ให้เตรียมเหตุผลและหลักฐานประกอบการอธิบายต่อกรรมการ</p>
                  </div>
                </section>
                <FinalQaRubricPanel audience="student" />
              </>
            )}
          </div>
        ))}
      </div>
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
      <FormSection
        title="1. บันทึกเอกสาร/หลักฐานสำหรับรอบสอบ"
        description="ให้นักศึกษาบันทึกลิงก์เอกสารและสรุปหลักฐานของรอบสอบก่อน ระบบจึงจะเปิดให้เสนอวันสอบรอบนั้นได้"
      >
        <div className="grid gap-3 md:grid-cols-3">
          {(["PROGRESS_1", "PROGRESS_2", "FINAL_PRESENT"] as const).map((kind) => {
            const submission = latestSubmissionByKind.get(kind);
            const summary = typeof submission?.contentJson === "object" && submission?.contentJson && "summary" in submission.contentJson
              ? String((submission.contentJson as { summary?: unknown }).summary ?? "")
              : "";
            return (
              <div key={kind} className="rounded-md border border-line bg-surface p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold">{scheduleKindLabel(kind)}</div>
                  <span className={submission ? "rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700" : "rounded-full border border-line px-2 py-0.5 text-xs text-muted"}>
                    {submission ? "มีเอกสารแล้ว" : "ยังไม่มีเอกสาร"}
                  </span>
                </div>
                {submission ? (
                  <div className="mt-2 space-y-1 text-muted">
                    <div>{submission.title ?? "เอกสารประกอบรอบสอบ"}</div>
                    <a className="text-brand hover:underline" href={submission.materialLink} target="_blank" rel="noreferrer">
                      เปิดเอกสาร
                    </a>
                    {summary ? <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0" value={summary} /> : null}
                  </div>
                ) : (
                  <p className="mt-2 text-muted">บันทึกเอกสารก่อนเสนอวันสอบ เพื่อให้กรรมการเห็นหลักฐานพร้อมกับคำขอนัดสอบ</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 space-y-4">
          {visibleGuidanceRounds.map((roundType) => {
            const kind = roundTypeToScheduleKind(roundType);
            const isFinal = kind === "FINAL_PRESENT";
            const submission = latestSubmissionByKind.get(kind);
            const content = (typeof submission?.contentJson === "object" && submission?.contentJson ? submission.contentJson : {}) as Record<string, unknown>;
            return (
              <form key={kind} action={saveAssessmentEvidence} className="rounded-md border border-line bg-surface p-4">
                <input type="hidden" name="assessment_kind" value={kind} />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">แบบฟอร์มหลักฐาน {scheduleKindLabel(kind)}</h3>
                    <p className="mt-1 text-sm text-muted">
                      {isFinal
                        ? "กรอกหลักฐานให้ล้อกับ rubric Final: วัตถุประสงค์ วิธีการ ผลลัพธ์ รายงาน และการตอบคำถาม"
                        : "กรอกหลักฐานให้ล้อกับ rubric Progress: งานตามแผน หลักฐาน ความล่าช้า ปัญหา วิธีแก้ และงานถัดไป"}
                    </p>
                  </div>
                  <span className="rounded-full border border-line bg-paper px-2 py-1 text-xs">{submission ? "แก้ไขเอกสารเดิม" : "บันทึกใหม่"}</span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="md:col-span-3">
                    <label>ชื่อเอกสาร/ชุดหลักฐาน</label>
                    <input name="submission_title" defaultValue={submission?.title ?? ""} placeholder={`เช่น เอกสาร ${scheduleKindLabel(kind)} และหลักฐานประกอบ`} />
                  </div>
                  <div className="md:col-span-3">
                    <MaterialLinkField defaultValue={submission?.materialLink} />
                  </div>

                  {isFinal ? (
                    <>
                      <div className="md:col-span-3">
                        <MarkdownLatexEditor name="final_objectives_evidence" label="วัตถุประสงค์ที่ทำสำเร็จและหลักฐาน *" defaultValue={String(content.finalObjectivesEvidence ?? "")} placeholder="ระบุวัตถุประสงค์จาก Proposal ที่ผลงานสุดท้ายตอบได้ และชี้หลักฐาน/ชิ้นงาน/ผลลัพธ์ที่ตรวจสอบได้" required rows={4} />
                      </div>
                      <div className="md:col-span-3">
                        <MarkdownLatexEditor name="final_methods_results" label="วิธีการ ผลลัพธ์ และการวิเคราะห์ *" defaultValue={String(content.finalMethodsResults ?? "")} placeholder="อธิบายวิธีที่ใช้จริง ผลลัพธ์สำคัญ หลักฐานการพิสูจน์/การทดลอง/การพัฒนา และความสอดคล้องกับข้อสรุป" required rows={4} />
                      </div>
                      <div className="md:col-span-3">
                        <MarkdownLatexEditor name="final_timeline_adaptation" label="การดำเนินงานเทียบแผนและการปรับแผน *" defaultValue={String(content.finalTimelineAdaptation ?? "")} placeholder="สรุปว่างานหลักทำตาม timeline หรือปรับอย่างไร มีปัญหา/การแก้ไขอะไร และยังรักษาวัตถุประสงค์เดิมอย่างไร" required rows={4} />
                      </div>
                      <div className="md:col-span-3">
                        <MarkdownLatexEditor name="final_report_readiness" label="รายงาน บทความ และประเด็นตอบคำถาม *" defaultValue={String(content.finalReportReadiness ?? "")} placeholder="ระบุส่วนรายงานที่ครบถ้วน รูป/ตาราง/สมการ/อ้างอิง และประเด็นที่คณะกรรมการควรตรวจหรือซักถาม" required rows={4} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="md:col-span-3">
                        <MarkdownLatexEditor name="progress_plan_tasks" label="งานตามแผน 16 สัปดาห์ที่รายงานในรอบนี้ *" defaultValue={String(content.progressPlanTasks ?? "")} placeholder="ระบุ task จากแผน Proposal ที่เกี่ยวข้องกับรอบนี้ เช่น สัปดาห์ 1-8 งานใดเสร็จแล้ว งานใดกำลังทำ" required rows={4} />
                      </div>
                      <div className="md:col-span-3">
                        <MarkdownLatexEditor name="progress_evidence" label="หลักฐาน/ชิ้นงานที่รองรับความก้าวหน้า *" defaultValue={String(content.progressEvidence ?? "")} placeholder="ระบุไฟล์ หน้าเอกสาร รูป ตาราง proof draft code dataset result หรือ screenshot ที่พิสูจน์ว่างานเกิดขึ้นจริง" required rows={4} />
                      </div>
                      <div className="md:col-span-3">
                        <MarkdownLatexEditor name="progress_status" label="สถานะงาน: เสร็จแล้ว / กำลังทำ / ล่าช้า *" defaultValue={String(content.progressStatus ?? "")} placeholder="แยกให้ชัดว่างานใดเสร็จ งานใดยังทำอยู่ งานใดล่าช้า และถ้าล่าช้ามีเหตุผลหรือแผนปรับอย่างไร" required rows={4} />
                      </div>
                      <div className="md:col-span-3">
                        <MarkdownLatexEditor name="progress_challenges_next" label="ปัญหา วิธีแก้ และขั้นตอนถัดไป *" defaultValue={String(content.progressChallengesNext ?? "")} placeholder="ระบุอุปสรรค วิธีแก้/แนวทางตอบสนอง และงานถัดไปที่จะทำก่อนรอบต่อไป" required rows={4} />
                      </div>
                    </>
                  )}

                  <div className="md:col-span-3">
                    <SubmitButton pendingText="กำลังบันทึกเอกสาร...">
                      บันทึกเอกสาร {scheduleKindLabel(kind)}
                    </SubmitButton>
                  </div>
                </div>
              </form>
            );
          })}
        </div>
      </FormSection>
      <FormSection title="2. เสนอวันสอบใหม่" description="ระบบจะอัปเดตรายการเดิมของโปรเจคนี้ในรอบเดียวกัน ไม่สร้างรายการซ้ำ และแนบเอกสารรอบสอบที่บันทึกไว้ให้กรรมการตรวจประกอบการอนุมัติ">
        {!schedulableRoundsWithEvidence.length ? (
          <WarningAlert title="ต้องบันทึกเอกสารก่อนเสนอวันสอบ">บันทึกลิงก์เอกสาร/หลักฐานของรอบสอบก่อน แล้วจึงเสนอวัน เวลา และห้องสอบให้กรรมการพิจารณา</WarningAlert>
        ) : null}
        <DraftPreservingForm action={submitExamSchedule} storageKey={`student-schedule-draft:${project.id}`} clearOnSuccess={params.success === "schedule_saved"} className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label>รอบการสอบ</label>
            <select name="round_type" defaultValue="PROGRESS_1">
              {scheduleRoundTypes.map((roundType) => {
                const round = roundMap.get(roundType);
                const kind = roundTypeToScheduleKind(roundType);
                const hasEvidence = latestSubmissionByKind.has(kind);
                const disabled = project.status !== "IN_PROGRESS" || !round || !isRoundOpen(round.status) || !hasEvidence || (roundType === "PROGRESS_1" && !progress1Readiness.eligible);
                return (
                  <option key={roundType} value={roundType} disabled={disabled}>
                    {scheduleRoundLabel(roundType)} {disabled ? hasEvidence ? "(ยังไม่พร้อม)" : "(ยังไม่มีเอกสาร)" : ""}
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
              <SubmitButton disabled={project.status !== "IN_PROGRESS" || !anyOpenRound || !schedulableRoundsWithEvidence.length} pendingText="กำลังบันทึกวันสอบ..." className="w-full sm:w-auto">
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
