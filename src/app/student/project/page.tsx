import { auth } from "@/auth";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormSection } from "@/components/ui/FormSection";
import { MarkdownLatexEditor } from "@/components/ui/MarkdownLatexEditor";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { MaterialLinkField } from "@/components/ui/MaterialLinkField";
import { PageHeader } from "@/components/ui/PageHeader";
import { DraftPreservingForm } from "@/components/ui/ProposalDraftForm";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StudentReadabilitySummary } from "@/components/ui/StudentReadabilitySummary";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/db";
import { selectableSourceTypes, sourceTypeLabelTh } from "@/lib/projects/sourceType";
import { teacherDisplayName } from "@/lib/teachers/displayName";
import { saveProjectOrigin } from "../actions";

function RequiredMark() {
  return <span className="ml-1 text-brand" aria-label="จำเป็นต้องกรอก">*</span>;
}

export default async function StudentProjectPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user.role !== "STUDENT" || !session.user.email) return <div className="panel">หน้านี้สำหรับนักศึกษาเท่านั้น</div>;
  const params = (await searchParams) ?? {};

  const [student] = await Promise.all([
    prisma.student.findUnique({
      where: { generatedEmail: session.user.email.toLowerCase() },
      include: { projects: { orderBy: { createdAt: "desc" }, include: { origin: true, advisorRequests: { include: { advisorTeacher: true }, orderBy: { requestedAt: "desc" } } } } }
    })
  ]);
  const project = student?.projects[0];
  if (!student) return <EmptyState title="ยังไม่พบข้อมูลนักศึกษา" description="บัญชีนี้ยังไม่อยู่ใน roster ที่นำเข้า กรุณาติดต่อผู้ดูแลระบบ" />;
  if (!project) return <EmptyState title="ยังไม่มีโครงงาน" description="กรุณาติดต่อผู้ดูแลระบบให้นำเข้ารายชื่อและสร้างรายวิชาก่อน" />;

  const teachers = await prisma.teacher.findMany({ where: { active: true, isInternal: true }, orderBy: [{ firstNameTh: "asc" }] });
  const advisorRequest = project?.advisorRequests[0];
  const canEditProject = project?.status === "DRAFT";
  const latestAdvisorRejected = canEditProject && advisorRequest?.status === "REJECTED";

  if (!student || !project) return <EmptyState title="ยังไม่มีโครงงาน" description="กรุณาติดต่อผู้ดูแลระบบให้นำเข้ารายชื่อและสร้างรายวิชาก่อน" />;

  return (
    <DraftPreservingForm action={saveProjectOrigin} storageKey={`student-project-origin-draft:${project.id}`} clearOnSuccess={params.success === "project_submitted"} className="space-y-6">
      <PageHeader
        title="สร้าง/แก้ไขข้อมูลโครงงาน"
        description="ระบุที่มาของหัวข้อ เลือกอาจารย์ที่ปรึกษา และส่งคำขออนุมัติ"
        actions={<StatusBadge status={project.status} />}
      />
      <ActionFeedback success={params.success} error={params.error} />
      <StudentReadabilitySummary
        title="สรุปสถานะหัวข้อและที่ปรึกษา"
        description="แยกสิ่งที่นักศึกษาต้องทำเองออกจากสถานะที่กำลังรออาจารย์หรือผู้ดูแลระบบ เพื่อไม่ให้เข้าใจว่าต้องส่งซ้ำระหว่างรอผล"
        items={[
          {
            label: "ต้องทำตอนนี้",
            value: canEditProject ? 1 : 0,
            detail: latestAdvisorRejected ? "แก้ไขข้อมูลตามความเห็นอาจารย์ แล้วส่งคำขอที่ปรึกษาใหม่" : "กรอกข้อมูลหัวข้อและเลือกอาจารย์ที่ปรึกษาเมื่อยังอยู่ในสถานะร่าง",
            tone: canEditProject ? "action" : "locked"
          },
          {
            label: "รออาจารย์",
            value: !canEditProject && advisorRequest?.status === "PENDING" ? 1 : 0,
            detail: "ส่งคำขอแล้วให้รออาจารย์ที่ปรึกษาพิจารณา ยังไม่ต้องส่งซ้ำจากหน้านี้",
            tone: advisorRequest?.status === "PENDING" ? "waiting" : "locked"
          },
          {
            label: "อนุมัติแล้ว",
            value: advisorRequest?.status === "APPROVED" ? 1 : 0,
            detail: "เมื่อที่ปรึกษาอนุมัติแล้ว ขั้นตอนถัดไปจะไปตามลำดับของรายวิชา",
            tone: advisorRequest?.status === "APPROVED" ? "done" : "locked"
          },
          {
            label: "สถานะโครงงาน",
            value: project.status,
            detail: "ใช้ป้ายสถานะด้านบนประกอบกับกล่องสรุปนี้เพื่อตรวจว่าขั้นตอนถูกล็อกหรือเปิดให้ทำแล้ว",
            tone: "info"
          }
        ]}
      />
      {latestAdvisorRejected ? (
        <section className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-ink">
          <p className="font-semibold">คำขอที่ปรึกษาถูกปฏิเสธ</p>
          <p className="mt-1 text-muted">กรุณาอ่านความเห็นของอาจารย์ แก้ไขข้อมูลหัวข้อ แล้วส่งคำขอใหม่หลังปรับข้อมูลเรียบร้อย</p>
          {advisorRequest.advisorComment ? (
            <div className="mt-3 rounded-md border border-line bg-surface p-3">
              <div className="mb-1 font-medium">ความเห็นจากอาจารย์</div>
              <MarkdownLatexViewer className="border-0 bg-transparent p-0 text-muted" value={advisorRequest.advisorComment} />
            </div>
          ) : null}
        </section>
      ) : null}
      {canEditProject ? (
        <section className="rounded-md border border-brand/25 bg-brand/5 p-4 text-sm text-ink">
          <p className="font-semibold">ก่อนส่งคำขอที่ปรึกษา</p>
          <p className="mt-1 text-muted">
            หลังส่งคำขอแล้ว นักศึกษาจะไม่สามารถแก้ไขข้อมูลหัวข้อได้ระหว่างรออาจารย์ที่ปรึกษาอนุมัติ หากอาจารย์ปฏิเสธหรือส่งกลับแก้ไข ระบบจึงจะเปิดให้แก้ไขอีกครั้ง
          </p>
        </section>
      ) : null}
      {advisorRequest ? (
        <section className="panel">
          <h2 className="font-semibold">คำขอที่ปรึกษาล่าสุด</h2>
          <p className="mt-2 text-sm text-muted">
            {teacherDisplayName(advisorRequest.advisorTeacher)} · สถานะ {advisorRequest.status}
          </p>
          {advisorRequest.advisorComment ? (
            <div className="mt-2 text-sm">
              <div className="mb-1 font-medium">ความเห็น</div>
              <MarkdownLatexViewer className="border-0 bg-transparent p-0 text-muted" value={advisorRequest.advisorComment} />
            </div>
          ) : null}
        </section>
      ) : null}
      <FormSection title="ข้อมูลหัวข้อ" description="ใช้เป็นหลักฐานต้นทางของโครงงานและส่งต่อให้ที่ปรึกษาพิจารณา">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label>ชื่อหัวข้อภาษาไทย<RequiredMark /></label>
            <input name="initial_project_title_th" required defaultValue={project.origin?.initialProjectTitleTh ?? project.currentTitleTh ?? ""} />
          </div>
          <div>
            <label>ชื่อหัวข้อภาษาอังกฤษ</label>
            <input name="initial_project_title_en" defaultValue={project.origin?.initialProjectTitleEn ?? project.currentTitleEn ?? ""} />
          </div>
          <div className="md:col-span-2">
            <MarkdownLatexEditor name="reason_for_topic" label="เหตุผลที่เลือกหัวข้อ" defaultValue={project.origin?.reasonForTopic ?? ""} rows={4} />
          </div>
          <div className="md:col-span-2">
            <MarkdownLatexEditor name="expected_math_area" label="ขอบเขตคณิตศาสตร์ที่เกี่ยวข้อง" defaultValue={project.origin?.expectedMathArea ?? ""} rows={4} />
          </div>
          <div className="md:col-span-2">
            <MarkdownLatexEditor name="consultation_summary" label="สรุปการปรึกษาเบื้องต้น" defaultValue={project.origin?.consultationSummary ?? ""} rows={4} />
          </div>
          <div>
            <label>อาจารย์ที่ปรึกษา<RequiredMark /></label>
            <select name="tentative_advisor_id" required defaultValue={project.origin?.tentativeAdvisorId ?? ""}>
              <option value="">เลือกอาจารย์ที่ปรึกษา</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>{teacherDisplayName(teacher)}</option>
              ))}
            </select>
          </div>
          <div>
            <label>แหล่งที่มาหัวข้อ</label>
            <select name="source_type" defaultValue={project.origin?.sourceType ?? "STUDENT_INITIATED"}>
              {selectableSourceTypes.map((sourceType) => (
                <option key={sourceType} value={sourceType}>{sourceTypeLabelTh(sourceType)}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <MarkdownLatexEditor name="initial_references" label="เอกสารอ้างอิงเบื้องต้น" defaultValue={project.origin?.initialReferences ?? ""} rows={4} />
          </div>
          <div className="md:col-span-2">
            <MaterialLinkField defaultValue={project.origin?.materialLink} />
          </div>
          <label className="flex items-center gap-2 md:col-span-2">
            <input className="h-4 w-4" type="checkbox" name="student_declaration" required defaultChecked={project.origin?.declarationAccepted ?? false} />
            <span>
              ข้าพเจ้ารับรองว่าเนื้อหาที่ส่งเป็นงานของตนเอง และใช้เฉพาะข้อความ/สูตรที่ระบบรองรับ
              <span className="mt-1 block text-xs text-muted">รองรับข้อความธรรมดา Markdown และสูตรคณิตศาสตร์ LaTeX หากต้องการแนบไฟล์ รูปภาพ หรือเอกสาร ให้ใส่เป็นลิงก์ Google Drive/Docs/Classroom แทน</span>
            </span>
          </label>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button type="button" data-draft-save className="button-secondary w-full sm:w-auto">
            บันทึกไว้ก่อน
          </button>
          <SubmitButton disabled={!canEditProject} pendingText="กำลังส่งคำขอ..." className="w-full sm:w-auto">
          {canEditProject ? (latestAdvisorRejected ? "ส่งคำขอใหม่หลังแก้ไข" : "ส่งคำขอให้อาจารย์ที่ปรึกษา") : "ขั้นตอนนี้ถูกล็อก"}
          </SubmitButton>
        </div>
      </FormSection>
    </DraftPreservingForm>
  );
}
