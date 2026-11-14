import { AcademicResultActionForm } from "@/components/ui/AcademicResultActionForm";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { selectedOfferingId } from "@/lib/terms/selection";
import { courseOfferingLabel } from "@/lib/admin/courseOffering";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { closeAcademicOffering, continueIncompleteRound, resolveAcademicIncomplete } from "./actions";
import { missingPresentationTypes } from "@/lib/terms/incompletePolicy";

export default async function AcademicResultsPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return <p>หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>;
  const offering = await prisma.courseOffering.findUnique({ where: { id: await selectedOfferingId() }, include: {
    term: true, assessmentRounds: true, projects: { include: { student: true, academicResult: { include: { continuations: true } }, attempts: { include: { assessmentRound: { select: { roundType: true } }, evaluatorAssignments: { select: { scoreSubmission: { select: { status: true } } } } } } }, orderBy: { student: { studentCode: "asc" } } }
  } });
  if (!offering) return <p>ยังไม่มีรายวิชา</p>;
  const unfinished = offering.projects.filter(project => project.status !== "COMPLETED");
  return <div className="space-y-5">
    <PageHeader title="ปิดผลรายวิชา / สะสาง I" description={courseOfferingLabel(offering)} />
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
      {offering.status === "ACTIVE" && offering.projects.length ? <AcademicResultActionForm action={closeAcademicOffering} className="mt-4 space-y-3">
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
          <AcademicResultActionForm action={continueIncompleteRound} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="project_id" value={project.id} /><input type="hidden" name="version" value={result.version} />
            <label>รอบที่อนุญาตให้สะสาง<select name="round_id" required>{offering.assessmentRounds.filter(round => ["PROGRESS_1", "PROGRESS_2", "FINAL_PRESENTATION"].includes(round.roundType)).map(round => <option key={round.id} value={round.id}>{round.name}{result.continuations.some(continuation => continuation.assessmentRoundId === round.id && continuation.status === "OPEN") ? " · เปิดสะสางแล้ว" : ""}</option>)}</select></label>
            <label>เหตุผลการให้เวลาเพิ่ม<input name="reason" required maxLength={2000} /></label>
            <label>คำตัดสินเรื่อง penalty<select name="penalty_decision" required defaultValue=""><option value="" disabled>ต้องตรวจและมีคำตัดสินก่อนเปิด</option><option value="PRESERVE_EXISTING">คงกติกา/flags เดิม ไม่ waive เพราะ I</option><option value="NO_ADDITIONAL_PENALTY">อนุมัติไม่เพิ่ม penalty เฉพาะกรณี (ไม่มี penalty เดิม)</option></select></label>
            <label>หลักฐานคำตัดสิน<input name="reference" required maxLength={2000} /></label>
            <SubmitButton pendingText="กำลังเปิด...">อนุญาตสะสางเฉพาะรอบ/โครงงานนี้</SubmitButton>
          </AcademicResultActionForm>
          {project.status === "COMPLETED" ? <AcademicResultActionForm action={resolveAcademicIncomplete} className="space-y-3 border-t border-line pt-3">
            <input type="hidden" name="project_id" value={project.id} /><input type="hidden" name="version" value={result.version} />
            <label>ผลที่ผู้มีอำนาจยืนยัน<select name="grade" required defaultValue=""><option value="" disabled>เลือกผลที่ยืนยันแล้ว</option>{["A", "B+", "B", "C+", "C", "D+", "D", "E", "S", "U"].map(grade => <option key={grade}>{grade}</option>)}</select></label>
            <label>หลักฐานผลยืนยัน<input name="reference" required maxLength={2000} /></label><label>เหตุผลการสะสาง<input name="reason" required maxLength={2000} /></label>
            <SubmitButton confirmMessage="ยืนยันผลจากหลักฐานแล้วหรือไม่? ระบบไม่คำนวณหรือส่ง REG แทน" pendingText="กำลังบันทึก...">บันทึกว่าสะสาง I แล้ว</SubmitButton>
          </AcademicResultActionForm> : <p>ดำเนินงานและ closeout ตามหลักฐานจริงให้ครบก่อนบันทึกการสะสาง I</p>}
        </> : <p>ผลที่ยืนยัน: {result.resolutionGrade ?? result.originalGrade} · {result.resolutionReference ?? result.reference}</p>}
      </section>;
    })}
  </div>;
}
