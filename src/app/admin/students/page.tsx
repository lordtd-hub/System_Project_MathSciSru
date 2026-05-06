import { auth } from "@/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { courseOfferingLabel } from "@/lib/admin/courseOffering";
import { prisma } from "@/lib/db";

export default async function AdminStudentsPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return <div className="panel">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</div>;
  const [students, offerings] = await Promise.all([
    prisma.student.findMany({ orderBy: { studentCode: "asc" }, take: 100, include: { projects: { take: 1, include: { courseOffering: { include: { term: true } } } } } }),
    prisma.courseOffering.findMany({ include: { term: true, _count: { select: { projects: true } } }, orderBy: { id: "desc" } })
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="จัดการนักศึกษา" description="ตรวจรายชื่อนักศึกษาและโปรเจคที่นำเข้าแล้ว การนำเข้าต้องเลือก Course Offering ที่เปิดไว้จริง" />
      <GuidancePanel
        title="การนำเข้านักศึกษา"
        current="ใช้คอลัมน์ student_code, first_name_th, last_name_th เท่านั้น"
        next="เปิดรายวิชาจากปีการศึกษาและภาคเรียนก่อน แล้วนำเข้า CSV ในรายวิชานั้น"
        actor="ผู้ดูแลระบบเป็นผู้นำเข้าและตรวจความถูกต้อง"
      />
      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">เปิดรายวิชาและนำเข้านักศึกษา</h2>
            <p className="mt-1 text-sm text-muted">รายชื่อนักศึกษาจะถูกสร้างเป็น project ใน Course Offering ที่เลือกเท่านั้น</p>
          </div>
          <a className="button" href="/admin/import-students">เปิดรายวิชา / นำเข้านักศึกษา</a>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {offerings.length ? offerings.map((offering) => (
            <div key={offering.id} className="rounded-md border border-line p-3 text-sm">
              <div className="font-medium">{courseOfferingLabel(offering)}</div>
              <div className="text-muted">{offering._count.projects} คนในรายวิชานี้</div>
            </div>
          )) : <p className="text-sm text-muted">ยังไม่มีรายวิชาที่เปิด</p>}
        </div>
      </section>
      <section className="panel">
        <h2 className="text-lg font-semibold">รายชื่อนักศึกษาที่นำเข้าแล้ว</h2>
        <div className="mt-3 overflow-x-auto">
          {students.length ? (
            <table className="responsive-table">
              <thead className="border-b border-line text-muted">
                <tr><th className="py-2">รหัส</th><th>ชื่อ-สกุล</th><th>อีเมล</th><th>รายวิชาล่าสุด</th><th>โปรเจค</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {students.map((student) => {
                  const project = student.projects[0];
                  return (
                    <tr key={student.id}>
                      <td className="py-2">{student.studentCode}</td>
                      <td>{student.firstNameTh} {student.lastNameTh}</td>
                      <td>{student.generatedEmail}</td>
                      <td>{project ? courseOfferingLabel(project.courseOffering) : "-"}</td>
                      <td>{project?.status ?? "ยังไม่มี"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState title="ยังไม่มีนักศึกษาที่นำเข้า" description="เริ่มจากเปิดรายวิชา แล้วนำเข้า CSV จากหน้าเปิดรายวิชา / นำเข้านักศึกษา" />
          )}
        </div>
      </section>
    </div>
  );
}
