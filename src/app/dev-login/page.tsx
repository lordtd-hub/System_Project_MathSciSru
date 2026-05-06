import { auth } from "@/auth";
import { WarningAlert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/db";
import { isDevLoginEnabled } from "@/lib/auth/devSession";
import { teacherDisplayName } from "@/lib/teachers/displayName";
import { clearDevUser, selectDevUser } from "./actions";

export default async function DevLoginPage() {
  if (!isDevLoginEnabled()) {
    return <EmptyState title="Development login is disabled" description="หน้านี้เปิดใช้เฉพาะ NODE_ENV=development เท่านั้น" />;
  }

  const [session, students, teachers] = await Promise.all([
    auth(),
    prisma.student.findMany({ orderBy: { studentCode: "asc" }, include: { projects: { orderBy: { createdAt: "desc" }, take: 1 } } }),
    prisma.teacher.findMany({ where: { active: true, isInternal: true }, orderBy: [{ firstNameTh: "asc" }] })
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="โหมดทดสอบสำหรับนักพัฒนา" description="เลือกผู้ใช้สำหรับทดสอบ Lifecycle v2 ในเครื่อง local" />
      <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4 text-red-900">
        <div className="font-semibold">Development login only</div>
        <p className="mt-1 text-sm">ใช้สำหรับทดสอบใน NODE_ENV=development เท่านั้น และไม่กระทบ Google authentication ใน production</p>
      </div>
      {session?.user ? (
        <section className="panel flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-muted">ผู้ใช้ทดสอบปัจจุบัน</div>
            <div className="font-semibold">{session.user.name} · {session.user.role}</div>
            <div className="text-sm text-muted">{session.user.email}</div>
          </div>
          <form action={clearDevUser}>
            <button type="submit" className="button-secondary">ออกจากโหมดทดสอบ</button>
          </form>
        </section>
      ) : null}

      <WarningAlert title="เลือกผู้ใช้สำหรับทดสอบ">
        หลังเลือกแล้วเปิด `/student`, `/teacher`, หรือ `/admin` จะเห็น dashboard จริง ไม่ใช่ข้อความ guard
      </WarningAlert>

      <div className="grid gap-4 md:grid-cols-2">
        <form action={selectDevUser} className="panel space-y-4">
          <input type="hidden" name="mode" value="admin" />
          <div>
            <h2 className="text-lg font-semibold">Admin</h2>
            <p className="mt-1 text-sm text-muted">ใช้ INITIAL_ADMIN_EMAIL จาก `.env` เพื่อทดสอบ dashboard ผู้ดูแลระบบ</p>
          </div>
          <button type="submit">เข้าสู่ระบบแบบทดสอบ</button>
        </form>

        <form action={selectDevUser} className="panel space-y-4">
          <input type="hidden" name="mode" value="pending_teacher" />
          <div>
            <h2 className="text-lg font-semibold">Pending teacher claim</h2>
            <p className="mt-1 text-sm text-muted">ใช้ทดสอบสถานะอาจารย์ที่ยังรอผู้ดูแลระบบอนุมัติ</p>
          </div>
          <button type="submit" className="button-secondary">ทดสอบสถานะรออนุมัติ</button>
        </form>
      </div>

      <form action={selectDevUser} className="panel space-y-4">
        <input type="hidden" name="mode" value="student" />
        <div>
          <h2 className="text-lg font-semibold">Student</h2>
          <p className="mt-1 text-sm text-muted">เลือกนักศึกษาที่นำเข้า/seed demo แล้วเพื่อดู lifecycle dashboard</p>
        </div>
        <select name="student_id" required>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.studentCode} {student.firstNameTh} {student.lastNameTh} · {student.projects[0]?.status ?? "ยังไม่มีโปรเจค"}
            </option>
          ))}
        </select>
        <button type="submit" disabled={!students.length}>เข้าสู่ระบบแบบทดสอบ</button>
      </form>

      <form action={selectDevUser} className="panel space-y-4">
        <input type="hidden" name="mode" value="teacher" />
        <div>
          <h2 className="text-lg font-semibold">Teacher</h2>
          <p className="mt-1 text-sm text-muted">เลือกอาจารย์ seeded เพื่อดู dashboard อาจารย์ที่อนุมัติแล้ว</p>
        </div>
        <select name="teacher_id" required>
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacherDisplayName(teacher)} · {teacher.email ?? "ยังไม่มีอีเมล"}
            </option>
          ))}
        </select>
        <button type="submit" disabled={!teachers.length}>เข้าสู่ระบบแบบทดสอบ</button>
      </form>
    </div>
  );
}
