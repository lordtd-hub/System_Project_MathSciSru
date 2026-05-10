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
import { ProposalTimelineBuilder } from "@/components/ui/ProposalTimelineBuilder";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/db";
import { teacherDisplayName } from "@/lib/teachers/displayName";
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
          presentationSubmissions: true,
          origin: true,
          attempts: { include: { proposalVotes: { include: { teacher: true }, orderBy: { submittedAt: "desc" } } } }
        }
      }
    }
  });
  const project = student?.projects[0];
  const submission = project?.presentationSubmissions[0];
  const content = submission?.contentJson as Record<string, string> | undefined;
  const proposalComments = project?.attempts.flatMap((attempt) => attempt.proposalVotes.filter((vote) => vote.visibleToStudent)) ?? [];
  const canSubmitProposal = project?.status === "PROPOSAL_PENDING";

  if (!student) return <EmptyState title="ยังไม่พบข้อมูลนักศึกษา" description="บัญชีนี้ยังไม่อยู่ใน roster ที่นำเข้า กรุณาติดต่อผู้ดูแลระบบ" />;
  if (!project) return <EmptyState title="ยังไม่มีโปรเจค" description="กรุณาสร้างโปรเจคก่อนส่ง Proposal" actionLabel="ไปหน้าโปรเจค" href="/student/project" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="ส่งข้อมูล Proposal"
        description="แนบ abstract และลิงก์เอกสารสำหรับสอบหัวข้อ ข้อมูลนี้ใช้ประกอบการสอบและเป็นหลักฐานสำหรับ AUN-QA"
        actions={<StatusBadge status={project.status} />}
      />
      <ActionFeedback success={params.success} error={params.error} />
      <GuidancePanel
        title="Proposal ใช้อย่างไร"
        current="กรอก abstract และแนบลิงก์ Google Drive/Docs/Classroom"
        next="อาจารย์จะให้ comment ได้ทันที คะแนน Proposal จะไม่แสดงให้นักศึกษาเห็น"
        actor="นักศึกษาเป็นผู้ส่งข้อมูล จากนั้นอาจารย์ภายในเป็นผู้ประเมิน"
      />
      <InfoAlert title="การแสดงผลให้นักศึกษา">
        นักศึกษาจะเห็น comment และชื่ออาจารย์ทันที แต่คะแนน Proposal จะถูกซ่อน
      </InfoAlert>
      {!project.origin ? (
        <WarningAlert title="ยังไม่มีข้อมูลเสนอหัวข้อ">
          กรุณาสร้าง/แก้ไขโปรเจคและส่งคำขอที่ปรึกษาก่อนส่ง Proposal
        </WarningAlert>
      ) : null}
      <form action={saveProposalSubmission}>
        <FormSection title="แบบฟอร์ม Proposal" description="รองรับ Markdown และ LaTeX แต่ไม่อนุญาต raw HTML">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label>ชื่อ Proposal ภาษาไทย</label>
              <input name="project_title_th" required defaultValue={submission?.titleTh ?? project.currentTitleTh ?? ""} />
            </div>
            <div>
              <label>ชื่อ Proposal ภาษาอังกฤษ</label>
              <input name="project_title_en" defaultValue={submission?.titleEn ?? project.currentTitleEn ?? ""} />
            </div>
            <div className="md:col-span-2">
              <MarkdownLatexEditor name="abstract_of_talk" label="บทคัดย่อการนำเสนอ" defaultValue={submission?.abstractText ?? ""} rows={7} />
            </div>
            <div className="md:col-span-2">
              <MarkdownLatexEditor name="motivation_background" label="ที่มาและความสำคัญ" defaultValue={content?.motivationBackground ?? ""} rows={5} />
            </div>
            <div className="md:col-span-2">
              <MarkdownLatexEditor name="objectives" label="วัตถุประสงค์" defaultValue={content?.objectives ?? ""} rows={5} />
            </div>
            <div className="md:col-span-2">
              <MarkdownLatexEditor name="proposed_methods" label="วิธีดำเนินงาน" defaultValue={content?.proposedMethods ?? ""} rows={5} />
            </div>
            <div className="md:col-span-2">
              <MarkdownLatexEditor name="expected_outcomes" label="ผลที่คาดว่าจะได้รับ" defaultValue={content?.expectedOutcomes ?? ""} rows={5} />
            </div>
            <div className="md:col-span-2">
              <ProposalTimelineBuilder defaultValue={content?.timeline} />
            </div>
            <div className="md:col-span-2">
              <MarkdownLatexEditor
                name="questions_for_teachers"
                label="คำถามหรือประเด็นที่ต้องการให้อาจารย์ช่วยพิจารณา"
                defaultValue={content?.questionsForTeachers ?? ""}
                helpText="ระบุข้อสงสัย จุดที่ยังไม่มั่นใจ หรือประเด็นใน Proposal ที่ต้องการให้อาจารย์ช่วยให้คำแนะนำ หากไม่มีให้เว้นว่างได้"
                rows={5}
                required={false}
              />
            </div>
            <div className="md:col-span-2">
              <MaterialLinkField defaultValue={submission?.materialLink} />
            </div>
            <label className="flex items-center gap-2 md:col-span-2">
              <input className="h-4 w-4" type="checkbox" name="student_declaration" required defaultChecked={submission?.declarationAccepted ?? false} />
              <span>ข้าพเจ้ารับรองว่า Proposal นี้เป็นงานของตนเองและไม่ใช้ raw HTML</span>
            </label>
          </div>
          <div className="sticky bottom-0 -mx-4 mt-4 border-t border-line bg-surface/95 p-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
            <SubmitButton disabled={!project.origin || !canSubmitProposal} pendingText="กำลังส่ง Proposal..." className="w-full sm:w-auto">
              {canSubmitProposal ? "ส่ง Proposal" : "Proposal ยังไม่เปิดให้แก้ไข"}
            </SubmitButton>
          </div>
        </FormSection>
      </form>
      <section className="panel">
        <h2 className="text-lg font-semibold">Comment จากอาจารย์</h2>
        <p className="mt-1 text-sm text-muted">ส่วนนี้แสดง comment ทันที พร้อมชื่ออาจารย์ แต่ไม่แสดงคะแนน Proposal</p>
        <div className="mt-3 space-y-3">
          {proposalComments.length ? (
            proposalComments.map((vote) => (
              <div key={vote.id} className="rounded-md border border-line p-3 text-sm">
                <div className="font-medium">{teacherDisplayName(vote.teacher)} · {vote.vote}</div>
                <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0 text-muted" value={vote.comment} emptyText="ไม่มี comment เพิ่มเติม" />
              </div>
            ))
          ) : (
            <EmptyState title="ยังไม่มี comment" description="เมื่ออาจารย์เริ่มประเมิน comment จะแสดงที่นี่ทันที" />
          )}
        </div>
      </section>
    </div>
  );
}
