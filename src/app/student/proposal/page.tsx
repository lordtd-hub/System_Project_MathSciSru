import { auth } from "@/auth";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { InfoAlert, WarningAlert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormSection } from "@/components/ui/FormSection";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { MarkdownLatexEditor } from "@/components/ui/MarkdownLatexEditor";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { MaterialLinkField } from "@/components/ui/MaterialLinkField";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProposalDraftForm } from "@/components/ui/ProposalDraftForm";
import { ProposalQaRubricPanel } from "@/components/ui/ProposalQaRubricPanel";
import { ProposalTimelineBuilder } from "@/components/ui/ProposalTimelineBuilder";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { isRoundOpen } from "@/lib/assessments/courseRounds";
import { prisma } from "@/lib/db";
import { canEditUntilDeadline } from "@/lib/submissions/versioning";
import { teacherDisplayName } from "@/lib/teachers/displayName";
import { isQaProgressPlanCheckEnabled } from "@/lib/qa/progressPlanCheckConfig";
import { saveProposalSubmission } from "../actions";

export default async function ProposalSubmissionPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user.role !== "STUDENT" || !session.user.email) return <div className="panel">หน้านี้สำหรับนักศึกษาเท่านั้น</div>;
  const params = (await searchParams) ?? {};

  const student = await prisma.student.findUnique({
    where: { generatedEmail: session.user.email.toLowerCase() },
    include: {
      projects: {
        orderBy: { createdAt: "desc" },
        include: {
          presentationSubmissions: { orderBy: { createdAt: "desc" }, take: 1 },
          origin: true,
          attempts: { include: { proposalVotes: { include: { teacher: true }, orderBy: { submittedAt: "desc" } } } }
        }
      }
    }
  });
  const project = student?.projects[0];
  const submission = project?.presentationSubmissions[0];
  const content = submission?.contentJson as Record<string, unknown> | undefined;
  const proposalComments = project?.attempts.flatMap((attempt) => attempt.proposalVotes.filter((vote) => vote.visibleToStudent)) ?? [];
  const proposalRound = project
    ? await prisma.assessmentRound.findFirst({
        where: { courseOfferingId: project.courseOfferingId, roundType: "PROPOSAL" },
        select: { status: true, submissionDeadline: true }
      })
    : null;
  const canPrepareProposal = project?.status === "PROPOSAL_PENDING";
  const canSubmitProposal =
    Boolean(canPrepareProposal && proposalRound && isRoundOpen(proposalRound.status) && canEditUntilDeadline(new Date(), proposalRound.submissionDeadline));
  const showQaProgressPlanCheck = isQaProgressPlanCheckEnabled();
  if (!student) return <EmptyState title="ยังไม่พบข้อมูลนักศึกษา" description="บัญชีนี้ยังไม่อยู่ใน roster ที่นำเข้า กรุณาติดต่อผู้ดูแลระบบ" />;
  if (!project) return <EmptyState title="ยังไม่มีโครงงาน" description="กรุณาสร้างโครงงานก่อนส่งเอกสารเสนอหัวข้อ" actionLabel="ไปหน้าโครงงาน" href="/student/project" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="ส่งเอกสารเสนอหัวข้อ"
        description="แนบ abstract และลิงก์เอกสารสำหรับสอบหัวข้อ ข้อมูลนี้ใช้ประกอบการสอบและเป็นหลักฐานสำหรับ AUN-QA"
        actions={<StatusBadge status={project.status} />}
      />
      <ActionFeedback success={params.success} error={params.error} />
      {params.success === "proposal_submitted" ? (
        <InfoAlert title="ส่ง Proposal สำเร็จ">
          ระบบบันทึกเอกสารเสนอหัวข้อแล้ว ขั้นตอนถัดไปคือรออาจารย์และผู้ดูแลระบบดำเนินการตามสถานะโครงงาน
        </InfoAlert>
      ) : null}
      <GuidancePanel
        title="การส่งเอกสารเสนอหัวข้อ"
        current="กรอก abstract และแนบลิงก์ Google Drive/Docs/Classroom"
        next="อาจารย์จะให้ข้อเสนอแนะได้ทันที คะแนนการเสนอหัวข้อจะไม่แสดงให้นักศึกษาเห็น"
        actor="นักศึกษาเป็นผู้ส่งข้อมูล จากนั้นอาจารย์ภายในเป็นผู้ประเมิน"
      />
      <InfoAlert title="การแสดงผลให้นักศึกษา">
        นักศึกษาจะเห็นข้อเสนอแนะและชื่ออาจารย์ทันที แต่คะแนนการเสนอหัวข้อจะถูกซ่อน
      </InfoAlert>
      <ProposalQaRubricPanel audience="student" />
      {!project.origin ? (
        <WarningAlert title="ยังไม่มีข้อมูลเสนอหัวข้อ">
          กรุณาสร้างหรือแก้ไขโครงงานและส่งคำขอที่ปรึกษาก่อนส่งเอกสารเสนอหัวข้อ
        </WarningAlert>
      ) : null}
      <ProposalDraftForm action={saveProposalSubmission} storageKey={`student-proposal-draft:${project.id}`} clearOnSuccess={params.success === "proposal_submitted"}>
        <FormSection title="แบบฟอร์มเอกสารเสนอหัวข้อ" description="รองรับ Markdown และ LaTeX แต่ไม่อนุญาต raw HTML">
          <InfoAlert title="คำแนะนำตาม rubric">
            Background: อธิบายปัญหา บริบท/กลุ่มผู้ใช้ และเหตุผลที่ปัญหาสำคัญ · Objectives: ระบุสิ่งที่จะศึกษา/พัฒนา/พิสูจน์/วิเคราะห์/สร้าง/ประเมินให้ตรงหัวข้อและตรวจสอบผลได้ · Methods: เขียนขั้นตอนตามลำดับและเชื่อมกับวัตถุประสงค์ · Expected outcomes: ระบุผลลัพธ์ที่ตรวจสอบได้ · Timeline: ครอบคลุม 16 สัปดาห์ · Supporting documents: ใส่ทฤษฎี งานที่เกี่ยวข้อง เครื่องมือ หรือวรรณกรรมที่เกี่ยวข้อง
          </InfoAlert>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label>ชื่อเอกสารเสนอหัวข้อภาษาไทย</label>
              <input name="project_title_th" required defaultValue={submission?.titleTh ?? project.currentTitleTh ?? ""} />
            </div>
            <div>
              <label>ชื่อเอกสารเสนอหัวข้อภาษาอังกฤษ</label>
              <input name="project_title_en" defaultValue={submission?.titleEn ?? project.currentTitleEn ?? ""} />
            </div>
            <div className="md:col-span-2">
              <MarkdownLatexEditor name="abstract_of_talk" label="บทคัดย่อการนำเสนอ" defaultValue={submission?.abstractText ?? ""} rows={7} />
            </div>
            <div className="md:col-span-2">
              <MarkdownLatexEditor name="motivation_background" label="ที่มาและความสำคัญ" defaultValue={typeof content?.motivationBackground === "string" ? content.motivationBackground : ""} rows={5} />
            </div>
            <div className="md:col-span-2">
              <MarkdownLatexEditor name="objectives" label="วัตถุประสงค์" defaultValue={typeof content?.objectives === "string" ? content.objectives : ""} rows={5} />
            </div>
            <div className="md:col-span-2">
              <MarkdownLatexEditor name="proposed_methods" label="วิธีดำเนินงาน" defaultValue={typeof content?.proposedMethods === "string" ? content.proposedMethods : ""} rows={5} />
            </div>
            <div className="md:col-span-2">
              <MarkdownLatexEditor name="expected_outcomes" label="ผลที่คาดว่าจะได้รับ" defaultValue={typeof content?.expectedOutcomes === "string" ? content.expectedOutcomes : ""} rows={5} />
            </div>
            <div className="md:col-span-2">
              <ProposalTimelineBuilder
                defaultValue={typeof content?.timeline === "string" ? content.timeline : ""}
                defaultItemsJson={content?.timelineItems ? JSON.stringify(content.timelineItems) : undefined}
                showAssessmentHint={showQaProgressPlanCheck}
              />
            </div>
            <div className="md:col-span-2">
              <MarkdownLatexEditor
                name="questions_for_teachers"
                label="คำถามหรือประเด็นที่ต้องการให้อาจารย์ช่วยพิจารณา"
                defaultValue={typeof content?.questionsForTeachers === "string" ? content.questionsForTeachers : ""}
                helpText="ระบุข้อสงสัย จุดที่ยังไม่มั่นใจ หรือประเด็นในเอกสารเสนอหัวข้อที่ต้องการให้อาจารย์ช่วยให้คำแนะนำ หากไม่มีให้เว้นว่างได้"
                rows={5}
                required={false}
              />
            </div>
            <div className="md:col-span-2">
              <MaterialLinkField defaultValue={submission?.materialLink} />
            </div>
            <label className="flex items-center gap-2 md:col-span-2">
              <input className="h-4 w-4" type="checkbox" name="student_declaration" required defaultChecked={submission?.declarationAccepted ?? false} />
              <span>ข้าพเจ้ารับรองว่าเอกสารเสนอหัวข้อนี้เป็นงานของตนเองและไม่ใช้ raw HTML</span>
            </label>
          </div>
          {!canSubmitProposal ? (
            <InfoAlert title="ยังส่งเอกสารเสนอหัวข้อไม่ได้">
              สามารถกรอกและกด “บันทึกไว้ก่อน” ได้ ข้อมูลจะเก็บไว้ในเครื่องนี้ เมื่อผู้ดูแลระบบเปิดรอบเสนอหัวข้อแล้วจึงกลับมากดส่งเอกสารเสนอหัวข้อ
            </InfoAlert>
          ) : null}
          <div className="sticky bottom-0 -mx-4 mt-4 flex flex-col gap-2 border-t border-line bg-surface/95 p-4 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:border-0 sm:bg-transparent sm:p-0">
            <button type="button" data-proposal-draft-save className="button-secondary w-full sm:w-auto">
              บันทึกไว้ก่อน
            </button>
            <SubmitButton disabled={!project.origin || !canSubmitProposal} pendingText="กำลังส่งเอกสารเสนอหัวข้อ..." className="w-full sm:w-auto">
              {canSubmitProposal ? "ส่งเอกสารเสนอหัวข้อ" : "ยังไม่เปิดให้ส่งเอกสารเสนอหัวข้อ"}
            </SubmitButton>
          </div>
        </FormSection>
      </ProposalDraftForm>
      <section className="panel">
        <h2 className="text-lg font-semibold">Comment จากอาจารย์</h2>
        <p className="mt-1 text-sm text-muted">ส่วนนี้แสดงข้อเสนอแนะทันที พร้อมชื่ออาจารย์ แต่ไม่แสดงคะแนนการเสนอหัวข้อ</p>
        <div className="mt-3 space-y-3">
          {proposalComments.length ? (
            proposalComments.map((vote) => (
              <div key={vote.id} className="rounded-md border border-line p-3 text-sm">
                <div className="font-medium">{teacherDisplayName(vote.teacher)} · {vote.vote}</div>
                <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0 text-muted" value={vote.comment} emptyText="ไม่มีข้อเสนอแนะเพิ่มเติม" />
              </div>
            ))
          ) : (
            <EmptyState title="ยังไม่มีข้อเสนอแนะ" description="เมื่ออาจารย์เริ่มประเมิน ข้อเสนอแนะจะแสดงที่นี่ทันที" />
          )}
        </div>
      </section>
    </div>
  );
}
