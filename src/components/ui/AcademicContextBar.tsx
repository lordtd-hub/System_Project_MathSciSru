import { auth } from "@/auth";
import { selectAcademicContext } from "@/app/term-selection-actions";
import { getCourseOfferingChoices, getStudentProjectChoices, selectedOfferingId } from "@/lib/terms/selection";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { SubmitButton } from "./SubmitButton";

export async function AcademicContextBar() {
  const session = await auth();
  if (!session?.user.id) return null;
  const user = session.user;
  const student = user.role === "STUDENT" && user.email ? await getStudentProjectChoices(user.email) : null;
  if (!student && user.role !== "ADMIN" && !hasApprovedTeacherCapability(user)) return null;
  const choices = student ? student.projects.map(project => ({
    id: project.id,
    label: `${project.courseOffering.term.displayName} · ${project.courseOffering.courseCode ?? project.courseOffering.courseTitle} ${project.courseOffering.section ?? ""}${project.academicResult?.status === "INCOMPLETE" ? " · I รอสะสาง" : project.academicResult?.originalGrade === "E" ? " · E ตามคำยืนยัน" : ""}`
  })) : (await getCourseOfferingChoices()).map(offering => ({ id: offering.id,
    label: `${offering.term.displayName} · ${offering.courseCode ?? offering.courseTitle} ${offering.section ?? ""} · ${offering.status === "CLOSED" ? "ปิดผลแล้ว" : "เปิดอยู่"}${offering._count.projects ? ` · I ${offering._count.projects} คน` : ""}`
  }));
  const selected = student ? student.selected?.id : await selectedOfferingId();
  if (!choices.length) return null;
  return <section className="panel mb-4" aria-label="เลือกภาคเรียนและรายวิชา">
    <form action={selectAcademicContext} className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1">ภาคเรียน / รายวิชา / กลุ่ม
        <select key={selected} name="context_id" defaultValue={selected} required>{choices.map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select>
      </label>
      <SubmitButton pendingText="กำลังเปลี่ยน...">เลือกภาคเรียน</SubmitButton>
    </form>
    <p className="mt-2 text-sm text-muted">ดูงานภาคเรียนเดิมได้เสมอ งาน I ใช้โครงงานและคะแนนเดิม ไม่ย้ายไปภาคเรียนใหม่</p>
    {student?.selected?.academicResult?.status === "INCOMPLETE" ? <p className="mt-2 font-semibold">I — ยังไม่ครบผลการศึกษา มีเวลาสะสางงานในภาคเรียนเดิม คะแนนจริงและประวัติยังคงอยู่</p> : null}
  </section>;
}
