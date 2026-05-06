import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { importStudents } from "../actions";

export default async function ImportStudentsPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return <div className="panel">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</div>;

  const offerings = await prisma.courseOffering.findMany({ include: { term: true }, orderBy: { id: "desc" } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">นำเข้านักศึกษา</h1>
      <form action={importStudents} className="panel space-y-4">
        <div>
          <label>รายวิชา</label>
          <select name="course_offering_id" required>
            {offerings.map((offering) => (
              <option key={offering.id} value={offering.id}>
                {offering.term.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>CSV จาก Excel</label>
          <textarea
            name="csv"
            rows={10}
            required
            defaultValue={"student_code,first_name_th,last_name_th\n65123456789,สมชาย,ใจดี"}
          />
          <p className="mt-1 text-xs text-muted">
            คอลัมน์ที่ต้องมี: student_code, first_name_th, last_name_th ระบบจะสร้างอีเมล @student.sru.ac.th ให้อัตโนมัติ
          </p>
        </div>
        <button type="submit">ตรวจสอบและนำเข้า</button>
      </form>
    </div>
  );
}
