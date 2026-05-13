import { auth } from "@/auth";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormSection } from "@/components/ui/FormSection";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { MarkdownLatexEditor } from "@/components/ui/MarkdownLatexEditor";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { MaterialLinkField } from "@/components/ui/MaterialLinkField";
import { PageHeader } from "@/components/ui/PageHeader";
import { DraftPreservingForm } from "@/components/ui/ProposalDraftForm";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StudentReadabilitySummary } from "@/components/ui/StudentReadabilitySummary";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  FigmaMetricCard,
  FigmaPageHeader,
  FigmaPanel,
  FigmaReviewLayout,
  FigmaStatusBadge
} from "@/components/redesign/VisualSurfaces";
import { prisma } from "@/lib/db";
import { selectableSourceTypes, sourceTypeLabelTh } from "@/lib/projects/sourceType";
import { teacherDisplayName } from "@/lib/teachers/displayName";
import { getUiMode } from "@/lib/uiMode";
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
  const uiMode = await getUiMode();

  if (!student || !project) return <EmptyState title="ยังไม่มีโครงงาน" description="กรุณาติดต่อผู้ดูแลระบบให้นำเข้ารายชื่อและสร้างรายวิชาก่อน" />;

  const projectOriginFields = (
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
  );

  const projectFormActions = (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
      <button type="button" data-draft-save className="button-secondary w-full sm:w-auto">
        บันทึกไว้ก่อน
      </button>
      <SubmitButton disabled={!canEditProject} pendingText="กำลังส่งคำขอ..." className="w-full sm:w-auto">
        {canEditProject ? (latestAdvisorRejected ? "ส่งคำขอใหม่หลังแก้ไข" : "ส่งคำขอให้อาจารย์ที่ปรึกษา") : "ขั้นตอนนี้ถูกล็อก"}
      </SubmitButton>
    </div>
  );

  const advisorRequestStatus = advisorRequest?.status ?? "ยังไม่มีคำขอ";
  const actionTone = canEditProject ? "action" : advisorRequest?.status === "PENDING" ? "waiting" : advisorRequest?.status === "APPROVED" ? "success" : "muted";

  if (uiMode === "figma") {
    return (
      <DraftPreservingForm action={saveProjectOrigin} storageKey={`student-project-origin-draft:${project.id}`} clearOnSuccess={params.success === "project_submitted"} className="figma-dashboard-page figma-student-project">
        <FigmaPageHeader
          eyebrow="Student Project"
          title="สร้าง/แก้ไขข้อมูลโครงงาน"
          description="ระบุที่มาของหัวข้อ เลือกอาจารย์ที่ปรึกษา และส่งคำขออนุมัติ"
          actions={
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={project.status} />
              <FigmaStatusBadge tone={actionTone}>{advisorRequestStatus}</FigmaStatusBadge>
            </div>
          }
        />
        <ActionFeedback success={params.success} error={params.error} />
        <div className="figma-kpi-grid">
          <FigmaMetricCard
            label="ต้องทำตอนนี้"
            value={canEditProject ? 1 : 0}
            tone={canEditProject ? "action" : "muted"}
            description={latestAdvisorRejected ? "แก้ไขตามความเห็นแล้วส่งคำขอใหม่" : "กรอกข้อมูลหัวข้อและเลือกอาจารย์ที่ปรึกษา"}
          />
          <FigmaMetricCard
            label="รออาจารย์"
            value={!canEditProject && advisorRequest?.status === "PENDING" ? 1 : 0}
            tone={advisorRequest?.status === "PENDING" ? "waiting" : "muted"}
            description="ส่งคำขอแล้วให้รอที่ปรึกษาพิจารณา"
          />
          <FigmaMetricCard
            label="อนุมัติแล้ว"
            value={advisorRequest?.status === "APPROVED" ? 1 : 0}
            tone={advisorRequest?.status === "APPROVED" ? "success" : "muted"}
            description="เมื่อที่ปรึกษาอนุมัติแล้ว ขั้นตอนถัดไปจะไปตามลำดับรายวิชา"
          />
          <FigmaMetricCard label="สถานะโครงงาน" value={project.status} description="ใช้ตรวจว่าขั้นตอนถูกล็อกหรือเปิดให้ทำแล้ว" />
        </div>
        {latestAdvisorRejected ? (
          <FigmaPanel title="คำขอที่ปรึกษาถูกปฏิเสธ" description="กรุณาอ่านความเห็นของอาจารย์ แก้ไขข้อมูลหัวข้อ แล้วส่งคำขอใหม่หลังปรับข้อมูลเรียบร้อย" tone="warning">
            {advisorRequest.advisorComment ? (
              <div className="rounded-md border border-line bg-surface p-3 text-sm">
                <div className="mb-1 font-medium">ความเห็นจากอาจารย์</div>
                <MarkdownLatexViewer className="border-0 bg-transparent p-0 text-muted" value={advisorRequest.advisorComment} />
              </div>
            ) : null}
          </FigmaPanel>
        ) : null}
        <FigmaReviewLayout
          context={
            <>
              <FigmaPanel title="สรุปสถานะหัวข้อและที่ปรึกษา" description="แยกสิ่งที่นักศึกษาต้องทำเองออกจากสถานะที่กำลังรออาจารย์หรือผู้ดูแลระบบ" tone={actionTone}>
                <div className="figma-action-list">
                  <div className="figma-action-row" data-tone={canEditProject ? "action" : "muted"}>
                    <div>
                      <div className="figma-action-title">ต้องทำตอนนี้</div>
                      <p>{latestAdvisorRejected ? "แก้ไขข้อมูลตามความเห็นอาจารย์ แล้วส่งคำขอที่ปรึกษาใหม่" : "กรอกข้อมูลหัวข้อและเลือกอาจารย์ที่ปรึกษาเมื่อยังอยู่ในสถานะร่าง"}</p>
                    </div>
                    <div className="figma-action-side"><strong>{canEditProject ? 1 : 0}</strong></div>
                  </div>
                  <div className="figma-action-row" data-tone={advisorRequest?.status === "PENDING" ? "warning" : "muted"}>
                    <div>
                      <div className="figma-action-title">รออาจารย์</div>
                      <p>ส่งคำขอแล้วให้รออาจารย์ที่ปรึกษาพิจารณา ยังไม่ต้องส่งซ้ำจากหน้านี้</p>
                    </div>
                    <div className="figma-action-side"><strong>{!canEditProject && advisorRequest?.status === "PENDING" ? 1 : 0}</strong></div>
                  </div>
                  <div className="figma-action-row" data-tone={advisorRequest?.status === "APPROVED" ? "success" : "muted"}>
                    <div>
                      <div className="figma-action-title">อนุมัติแล้ว</div>
                      <p>เมื่อที่ปรึกษาอนุมัติแล้ว ขั้นตอนถัดไปจะไปตามลำดับของรายวิชา</p>
                    </div>
                    <div className="figma-action-side"><strong>{advisorRequest?.status === "APPROVED" ? 1 : 0}</strong></div>
                  </div>
                </div>
              </FigmaPanel>
              {canEditProject ? (
                <FigmaPanel title="ก่อนส่งคำขอที่ปรึกษา" description="หลังส่งคำขอแล้ว นักศึกษาจะไม่สามารถแก้ไขข้อมูลหัวข้อได้ระหว่างรออาจารย์ที่ปรึกษาอนุมัติ หากอาจารย์ปฏิเสธหรือส่งกลับแก้ไข ระบบจึงจะเปิดให้แก้ไขอีกครั้ง" tone="action">
                  <div className="text-sm text-muted">ตรวจชื่อหัวข้อ เหตุผล ขอบเขต ที่ปรึกษา และลิงก์หลักฐานก่อนส่งคำขอ</div>
                </FigmaPanel>
              ) : null}
              {advisorRequest ? (
                <FigmaPanel title="คำขอที่ปรึกษาล่าสุด" description={`${teacherDisplayName(advisorRequest.advisorTeacher)} · สถานะ ${advisorRequest.status}`}>
                  {advisorRequest.advisorComment ? (
                    <div className="text-sm">
                      <div className="mb-1 font-medium">ความเห็น</div>
                      <MarkdownLatexViewer className="border-0 bg-transparent p-0 text-muted" value={advisorRequest.advisorComment} />
                    </div>
                  ) : (
                    <p className="text-sm text-muted">ยังไม่มีความเห็นเพิ่มเติม</p>
                  )}
                </FigmaPanel>
              ) : null}
            </>
          }
          action={
            <FigmaPanel title="ข้อมูลหัวข้อ" description="ใช้เป็นหลักฐานต้นทางของโครงงานและส่งต่อให้ที่ปรึกษาพิจารณา" tone={canEditProject ? "action" : "muted"}>
              {projectOriginFields}
              {projectFormActions}
            </FigmaPanel>
          }
        />
      </DraftPreservingForm>
    );
  }

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
      <GuidancePanel
        title="ขั้นร่างหัวข้อ"
        current="กรอกชื่อหัวข้อ เหตุผล ขอบเขต และเลือกอาจารย์ที่ปรึกษา"
        next="ระบบจะส่งคำขอไปยังอาจารย์ที่ปรึกษา หากถูกปฏิเสธจะกลับมาแก้ไขในสถานะ DRAFT"
        actor="นักศึกษาเริ่มส่งคำขอ จากนั้นอาจารย์ที่ปรึกษาเป็นผู้อนุมัติ"
      />
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
        {projectOriginFields}
        {projectFormActions}
      </FormSection>
    </DraftPreservingForm>
  );
}
