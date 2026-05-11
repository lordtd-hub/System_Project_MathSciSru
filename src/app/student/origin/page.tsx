import { auth } from "@/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { MarkdownLatexEditor } from "@/components/ui/MarkdownLatexEditor";
import { DraftPreservingForm } from "@/components/ui/ProposalDraftForm";
import { prisma } from "@/lib/db";
import { saveProjectOrigin } from "../actions";

export default async function ProjectOriginPage() {
  const session = await auth();
  if (session?.user.role !== "STUDENT" || !session.user.email) return <div className="panel">หน้านี้สำหรับนักศึกษาเท่านั้น</div>;

  const student = await prisma.student.findUnique({
    where: { generatedEmail: session.user.email.toLowerCase() },
    include: { projects: { include: { origin: true } } }
  });
  if (!student) return <EmptyState title="ยังไม่พบข้อมูลนักศึกษา" description="บัญชีนี้ยังไม่อยู่ใน roster ที่นำเข้า กรุณาติดต่อผู้ดูแลระบบ" />;

  const project = student?.projects[0];
  if (!project) return <EmptyState title="ยังไม่มีโครงงาน" description="บัญชีนี้ยังไม่มีโครงงานในรายวิชา กรุณาติดต่อผู้ดูแลระบบ" />;

  const origin = project?.origin;
  const teachers = await prisma.teacher.findMany({ where: { active: true }, orderBy: { firstNameTh: "asc" } });

  return (
    <DraftPreservingForm action={saveProjectOrigin} storageKey={`student-project-origin-draft:${project.id}`} className="space-y-4">
      <h1 className="text-2xl font-semibold">ส่งข้อมูลเสนอหัวข้อ</h1>
      <section className="panel grid gap-4 md:grid-cols-2">
        <div>
          <label>ชื่อหัวข้อภาษาไทย</label>
          <input name="initial_project_title_th" required defaultValue={origin?.initialProjectTitleTh ?? ""} />
        </div>
        <div>
          <label>ชื่อหัวข้อภาษาอังกฤษ</label>
          <input name="initial_project_title_en" defaultValue={origin?.initialProjectTitleEn ?? ""} />
        </div>
        <div>
          <label>ที่มาของหัวข้อ</label>
          <select name="source_type" defaultValue={origin?.sourceType ?? "STUDENT_INITIATED"}>
            <option value="STUDENT_INITIATED">นักศึกษาเริ่มต้นเอง</option>
            <option value="ADVISOR_SUGGESTED">อาจารย์เสนอแนะ</option>
            <option value="TOPIC_BANK">คลังหัวข้อ</option>
            <option value="COURSEWORK_EXTENSION">ต่อยอดจากรายวิชา</option>
            <option value="RESEARCH_EXTENSION">ต่อยอดจากงานวิจัย</option>
            <option value="COMMUNITY_OR_INDUSTRY_PROBLEM">ปัญหาชุมชน/อุตสาหกรรม</option>
            <option value="OTHER">อื่น ๆ</option>
          </select>
        </div>
        <div>
          <label>อาจารย์ที่ปรึกษาเบื้องต้น</label>
          <select name="tentative_advisor_id" defaultValue={origin?.tentativeAdvisorId ?? ""}>
            <option value="">ยังไม่ระบุ</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.academicPrefix}
                {teacher.firstNameTh} {teacher.lastNameTh}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <MarkdownLatexEditor name="reason_for_topic" label="เหตุผลที่เลือกหัวข้อ" defaultValue={origin?.reasonForTopic ?? ""} rows={4} />
        </div>
        <div className="md:col-span-2">
          <MarkdownLatexEditor name="expected_math_area" label="ขอบเขตคณิตศาสตร์ที่เกี่ยวข้อง" defaultValue={origin?.expectedMathArea ?? ""} rows={4} />
        </div>
        <div className="md:col-span-2">
          <MarkdownLatexEditor name="consultation_summary" label="สรุปการปรึกษา" defaultValue={origin?.consultationSummary ?? ""} rows={4} />
        </div>
        <div className="md:col-span-2">
          <MarkdownLatexEditor name="initial_references" label="เอกสารอ้างอิงเบื้องต้น" defaultValue={origin?.initialReferences ?? ""} rows={4} />
        </div>
        <div className="md:col-span-2">
          <label>ลิงก์เอกสารประกอบ</label>
          <input name="material_link" type="url" required defaultValue={origin?.materialLink ?? ""} />
        </div>
        <label className="flex items-center gap-2 md:col-span-2">
          <input className="h-4 w-4" type="checkbox" name="student_declaration" required defaultChecked={origin?.declarationAccepted ?? false} />
          <span>ข้าพเจ้ารับรองว่าข้อมูลนี้เป็นข้อมูลการเสนอหัวข้อของตนเอง</span>
        </label>
        <button type="button" data-draft-save className="button-secondary">บันทึกไว้ก่อน</button>
        <button type="submit">บันทึกและส่งข้อมูลเสนอหัวข้อ</button>
      </section>
    </DraftPreservingForm>
  );
}
