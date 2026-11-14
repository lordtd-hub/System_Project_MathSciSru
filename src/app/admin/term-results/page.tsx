import Link from "next/link";
import { AcademicResultActionForm } from "@/components/ui/AcademicResultActionForm";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { selectedOfferingId } from "@/lib/terms/selection";
import { courseOfferingLabel } from "@/lib/admin/courseOffering";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { closeAcademicOffering } from "./actions";
import { missingPresentationTypes } from "@/lib/terms/incompletePolicy";
import { notFound } from "next/navigation";
import { CourseContextBadge } from "@/components/ui/CourseContextBadge";

export default async function AcademicResultsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return <p>หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>;
  const params = (await searchParams) ?? {};
  const requested = Array.isArray(params.offering_id) ? params.offering_id[0] : params.offering_id;
  if (requested && requested.length > 100) notFound();
  const offering = await prisma.courseOffering.findUnique({ where: { id: requested ?? await selectedOfferingId() }, include: {
    term: true, assessmentRounds: true, projects: { include: { student: true, academicResult: { include: { continuations: true } }, attempts: { include: { assessmentRound: { select: { roundType: true } }, evaluatorAssignments: { select: { scoreSubmission: { select: { status: true } } } } } } }, orderBy: { student: { studentCode: "asc" } } }
  } });
  if (!offering) { if (requested) notFound(); return <p>ยังไม่มีรายวิชา</p>; }
  const unfinished = offering.projects.filter(project => project.status !== "COMPLETED");
  return <div className="space-y-5">
    <PageHeader title="ปิดผลรายวิชา / สะสาง I" description={courseOfferingLabel(offering)} />
    <CourseContextBadge offering={offering} label="เป้าหมายของแบบฟอร์มหน้านี้" />
    <div className="panel space-y-2"><p>ผล I คือยังไม่ครบผลการศึกษา ไม่ใช่ศูนย์/ตก/ถอน และไม่เปลี่ยนงานเป็น COMPLETED</p>
      <p>หน้านี้ไม่ส่งหรือแก้ REG และไม่คำนวณเกรดใหม่ ผลที่ส่งไปแล้วและคะแนนจริงยังคงเดิม</p>
      <p>สูตรรายวิชา 40/50/10 คงเดิม ข้อมูลคะแนนองค์ประกอบในระบบไม่ใช่เกรดสุดท้ายที่คำนวณแทนผู้สอน</p></div>
    <section className="panel"><h2 className="font-semibold">ตรวจรายชื่อก่อนปิดผล</h2>
      <p>นักศึกษา {offering.projects.length} คน · โครงงานเสร็จแล้ว {offering.projects.length - unfinished.length} คน · งานยังไม่ครบ {unfinished.length} คน (ต้องยืนยัน I/E)</p>
      <div className="mt-3 space-y-2">{offering.projects.map(project => <div key={project.id} className="border-b border-line py-2">
        <p>{project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}</p>
        <p className="text-sm">{project.status} · {project.academicResult?.status === "INCOMPLETE" ? "I รอสะสาง" : project.academicResult?.status === "RESOLVED" ? `สะสาง I แล้ว: ${project.academicResult.resolutionGrade}` : project.academicResult?.status === "FINALIZED" ? "E ตามคำยืนยันผู้สอน" : project.status === "COMPLETED" ? "คงผลที่ส่งแล้ว" : "ต้องยืนยัน I หรือ E"}</p>
        <p className="break-all text-xs text-muted">โครงงาน {project.id}</p>
        {missingPresentationTypes(project.attempts).length ? <p className="text-sm">ยังไม่มีหลักฐานคะแนน: {missingPresentationTypes(project.attempts).join(", ")} — ไม่เติมเป็นศูนย์</p> : null}
      </div>)}</div>
      {offering.status === "ACTIVE" ? <AcademicResultActionForm action={closeAcademicOffering} className="mt-4 space-y-3">
        <input type="hidden" name="offering_id" value={offering.id} />
        <input type="hidden" name="project_ids" value={JSON.stringify(offering.projects.map(project => project.id))} />
        <input type="hidden" name="unfinished_ids" value={JSON.stringify(unfinished.map(project => project.id))} />
        {unfinished.map(project => <fieldset key={project.id} className="rounded border border-line p-3"><legend>{project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}</legend>
          <label>ผลที่ผู้สอนยืนยัน<select name={`result_${project.id}`} defaultValue="" required><option value="" disabled>เลือก I หรือ E ตามหลักฐาน</option><option value="I">I — ยังไม่ครบ ให้สะสางต่อ</option><option value="E">E — ผลที่ผู้สอนยืนยัน ไม่สร้างคะแนนศูนย์</option></select></label>
          <label>เหตุผลเฉพาะคน<input name={`reason_${project.id}`} required maxLength={2000} /></label>
        </fieldset>)}
        <label>เหตุผลการปิดผลรายวิชา<textarea name="reason" required maxLength={2000} /></label>
        <label>หลักฐานยืนยันผลที่ส่งแล้ว / มติผู้สอน<input name="reference" required maxLength={2000} /></label>
        <label className="flex gap-2"><input type="checkbox" name="confirmed" required className="h-5 w-5" />ตรวจรายชื่อแล้ว ยืนยันปิดผลรายวิชาและบันทึก I/E ตามคำตัดสินเฉพาะผู้ที่งานยังไม่ครบตามรายการข้างต้น</label>
        <SubmitButton confirmMessage="ยืนยันรายชื่อและผล I/E แล้วหรือไม่? คะแนนและงานเดิมจะไม่เปลี่ยน" pendingText="กำลังบันทึก...">ปิดผลรายวิชานี้</SubmitButton>
      </AcademicResultActionForm> : <p className="mt-3">รายวิชาปิดผลแล้ว งาน I ยังคงสะสางต่อในภาคเรียนเดิมได้</p>}
    </section>
    {offering.projects.filter(project => project.academicResult).map(project => {
      const result = project.academicResult!;
      return <section key={project.id} className="panel space-y-3"><h2 className="font-semibold">{project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh} — {result.status === "INCOMPLETE" ? "I" : result.status === "FINALIZED" ? "E ตามคำยืนยัน" : "สะสางแล้ว"}</h2>
        <p>บันทึกผลเดิม {result.originalGrade}: {result.reason} · หลักฐาน {result.reference} · เวอร์ชัน {result.version}</p>
        {result.status === "INCOMPLETE" ? <>
          <Link className="button-primary" href={`/admin/i-score-entry?project_id=${project.id}`}>เปิดงานสะสาง I</Link>
          <p className="text-sm text-muted">ตรวจเอกสาร คะแนน ยืนยันจบ และบันทึกผลแก้ I ต่อได้ในหน้างานสะสาง I</p>
        </> : <p>ผลที่ยืนยัน: {result.resolutionGrade ?? result.originalGrade} · {result.resolutionReference ?? result.reference}</p>}
      </section>;
    })}
  </div>;
}
