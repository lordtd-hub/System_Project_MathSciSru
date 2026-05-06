import { auth } from "@/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/db";
import { importStudents } from "../actions";

export default async function AdminStudentsPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return <div className="panel">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</div>;
  const [students, offerings] = await Promise.all([
    prisma.student.findMany({ orderBy: { studentCode: "asc" }, take: 100, include: { projects: { take: 1 } } }),
    prisma.courseOffering.findMany({ include: { term: true }, orderBy: { id: "desc" } })
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="จัดการนักศึกษา" description="นำเข้ารายชื่อนักศึกษาจาก CSV และตรวจรายการที่มีในระบบ" />
      <GuidancePanel
        title="การนำเข้านักศึกษา"
        current="ใช้คอลัมน์ student_code, first_name_th, last_name_th เท่านั้น"
        next="ระบบจะสร้างอีเมล student_code@student.sru.ac.th และสร้าง project เริ่มที่ STUDENT_PROFILE"
        actor="ผู้ดูแลระบบเป็นผู้นำเข้าและตรวจความถูกต้อง"
      />
      <form action={importStudents} className="panel space-y-4">
        <h2 className="text-lg font-semibold">นำเข้านักศึกษา</h2>
        <div>
          <label>รายวิชา/ภาคเรียน</label>
          <select name="course_offering_id" required>
            {offerings.map((offering) => <option key={offering.id} value={offering.id}>{offering.term.displayName}</option>)}
          </select>
        </div>
        <div>
          <label>CSV จาก Excel</label>
          <textarea name="csv" rows={8} required defaultValue={"student_code,first_name_th,last_name_th\n65123456789,สมชาย,ใจดี"} />
          <p className="mt-1 text-xs text-muted">ตัวอย่าง CSV ต้องมี header และข้อมูล 3 คอลัมน์ตามรูปแบบนี้</p>
        </div>
        <button type="submit" disabled={!offerings.length}>ตรวจสอบและนำเข้า</button>
      </form>
      <section className="panel">
        <h2 className="text-lg font-semibold">รายชื่อนักศึกษาที่นำเข้าแล้ว</h2>
        <div className="mt-3 overflow-x-auto">
          {students.length ? (
            <table className="responsive-table">
              <thead className="border-b border-line text-muted">
                <tr><th className="py-2">รหัส</th><th>ชื่อ-สกุล</th><th>อีเมล</th><th>โปรเจค</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {students.map((student) => (
                  <tr key={student.id}>
                    <td className="py-2">{student.studentCode}</td>
                    <td>{student.firstNameTh} {student.lastNameTh}</td>
                    <td>{student.generatedEmail}</td>
                    <td>{student.projects[0]?.status ?? "ยังไม่มี"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title="ยังไม่มีนักศึกษาที่นำเข้า" description="เริ่มจากสร้างภาคเรียน/รายวิชา แล้วนำเข้า CSV จากหน้านี้" />
          )}
        </div>
      </section>
    </div>
  );
}
