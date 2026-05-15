import Link from "next/link";
import { auth } from "@/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { courseOfferingLabel } from "@/lib/admin/courseOffering";
import { prisma } from "@/lib/db";
import { projectStatusLabelTh } from "@/lib/lifecycle/statusLabels";

export default async function AdminStudentsPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return <div className="panel">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</div>;
  const [students, offerings] = await Promise.all([
    prisma.student.findMany({ orderBy: { studentCode: "asc" }, take: 100, include: { projects: { take: 1, include: { courseOffering: { include: { term: true } } } } } }),
    prisma.courseOffering.findMany({ include: { term: true, _count: { select: { projects: true } } }, orderBy: { id: "desc" } })
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="จัดการนักศึกษา" description="ตรวจรายชื่อนักศึกษาและโครงงานที่นำเข้าแล้ว การนำเข้าต้องเลือกรายวิชาที่เปิดไว้จริง" />
      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">เปิดรายวิชาและนำเข้านักศึกษา</h2>
            <p className="mt-1 text-sm text-muted">รายชื่อนักศึกษาจะถูกสร้างเป็นโครงงานในรายวิชาที่เลือกเท่านั้น</p>
          </div>
          <Link className="button" href="/admin/import-students">เปิดรายวิชา / นำเข้านักศึกษา</Link>
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
        {students.length ? (
          <>
            <div className="mt-3 grid gap-3 md:hidden">
              {students.map((student) => {
                const project = student.projects[0];
                return (
                  <article key={student.id} className="rounded-xl border border-line bg-surface p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">รหัสนักศึกษา</p>
                        <h3 className="mt-1 text-lg font-semibold">{student.studentCode}</h3>
                      </div>
                      <span className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-muted">
                        {project ? projectStatusLabelTh(project.status) : "ยังไม่มีโครงงาน"}
                      </span>
                    </div>
                    <dl className="mt-4 grid gap-3 text-sm">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-muted">ชื่อ-สกุล</dt>
                        <dd className="mt-1">{student.firstNameTh} {student.lastNameTh}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-muted">อีเมล</dt>
                        <dd className="mt-1 break-all">{student.generatedEmail}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-muted">รายวิชาล่าสุด</dt>
                        <dd className="mt-1">{project ? courseOfferingLabel(project.courseOffering) : "-"}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>
            <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="responsive-table">
              <thead className="border-b border-line text-muted">
                <tr><th className="py-2">รหัส</th><th>ชื่อ-สกุล</th><th>อีเมล</th><th>รายวิชาล่าสุด</th><th>โครงงาน</th></tr>
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
                      <td>{project ? projectStatusLabelTh(project.status) : "ยังไม่มี"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </>
        ) : (
          <div className="mt-3">
            <EmptyState title="ยังไม่มีนักศึกษาที่นำเข้า" description="เริ่มจากเปิดรายวิชา แล้วนำเข้า CSV จากหน้าเปิดรายวิชา / นำเข้านักศึกษา" />
          </div>
        )}
      </section>
    </div>
  );
}
