import Link from "next/link";
import { auth } from "@/auth";
import { seedTeacherBaselineFromAdmin, updateTeacherEmail } from "@/app/admin/actions";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/db";
import { teacherDisplayName } from "@/lib/teachers/displayName";

export const dynamic = "force-dynamic";

export default async function AdminTeachersPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return <div className="panel">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</div>;
  const params = (await searchParams) ?? {};
  const [teachers, pendingClaims] = await Promise.all([
    prisma.teacher.findMany({ include: { claims: { orderBy: { requestedAt: "desc" }, take: 1 } }, orderBy: [{ firstNameTh: "asc" }] }),
    prisma.teacherAccountClaim.count({ where: { status: "PENDING" } })
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="จัดการอาจารย์"
        description="ดูโปรไฟล์อาจารย์และตั้งค่าอีเมลสำหรับการผูกบัญชี Google"
        actions={<Link className="button" href="/admin/claims">คำขอผูกบัญชี {pendingClaims}</Link>}
      />
      <ActionFeedback success={params.success} error={params.error} />
      <GuidancePanel
        title="อีเมลอาจารย์"
        current="ผู้ดูแลระบบแก้ได้เฉพาะอีเมลของโปรไฟล์อาจารย์ เพื่อให้ระบบผูกบัญชีกับ Google login ครั้งถัดไป"
        next="หลังบันทึกอีเมล ให้อาจารย์ออกจากระบบแล้วเข้าสู่ระบบใหม่เพื่อปรับปรุงสิทธิ์ผู้ดูแลระบบ/อาจารย์"
        actor="การอนุมัติคำขอผูกบัญชีอาจารย์ยังทำที่หน้าคำขอผูกบัญชีอาจารย์เหมือนเดิม"
      />
      <section className="panel">
        <h2 className="text-lg font-semibold">รายชื่ออาจารย์</h2>
        {teachers.length ? (
          <>
            <div className="mt-3 grid gap-3 md:hidden">
              {teachers.map((teacher) => {
                const displayName = teacherDisplayName(teacher);
                return (
                  <article key={teacher.id} className="rounded-xl border border-line bg-surface p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{displayName}</h3>
                        <p className="mt-1 text-xs text-muted">{teacher.department}</p>
                      </div>
                      <span className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-muted">
                        {teacher.canEvaluateProposal ? "ประเมินการเสนอหัวข้อได้" : "ไม่ประเมินการเสนอหัวข้อ"}
                      </span>
                    </div>
                    <dl className="mt-4 grid gap-3 text-sm">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-muted">อีเมลที่ผูกบัญชี</dt>
                        <dd className="mt-1 break-all">{teacher.email ?? "ยังไม่ผูกอีเมล"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-muted">คำขอล่าสุด</dt>
                        <dd className="mt-1">{teacher.claims[0]?.status ?? "-"}</dd>
                      </div>
                    </dl>
                    <form action={updateTeacherEmail} className="mt-4 grid gap-2">
                      <input type="hidden" name="teacher_id" value={teacher.id} />
                      <label className="text-sm font-medium" htmlFor={`teacher-email-mobile-${teacher.id}`}>
                        แก้ไขอีเมล
                      </label>
                      <input
                        id={`teacher-email-mobile-${teacher.id}`}
                        name="email"
                        type="email"
                        defaultValue={teacher.email ?? ""}
                        placeholder="name@sru.ac.th หรือเว้นว่าง"
                        aria-label={`อีเมลของ ${displayName}`}
                      />
                      <SubmitButton className="w-full justify-center" pendingText="กำลังบันทึก...">
                        บันทึกอีเมล
                      </SubmitButton>
                    </form>
                  </article>
                );
              })}
            </div>
            <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="responsive-table">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="py-2 text-left">ชื่ออาจารย์</th>
                  <th className="text-left">อีเมลที่ผูกบัญชี</th>
                  <th className="text-left">ประเมินการเสนอหัวข้อ</th>
                  <th className="text-left">คำขอล่าสุด</th>
                  <th className="text-left">แก้ไขอีเมล</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {teachers.map((teacher) => (
                  <tr key={teacher.id}>
                    <td className="py-3 align-top">
                      <div className="font-medium">{teacherDisplayName(teacher)}</div>
                      <div className="text-xs text-muted">{teacher.department}</div>
                    </td>
                    <td className="align-top">{teacher.email ?? "ยังไม่ผูกอีเมล"}</td>
                    <td className="align-top">{teacher.canEvaluateProposal ? "ได้" : "ไม่ได้"}</td>
                    <td className="align-top">{teacher.claims[0]?.status ?? "-"}</td>
                    <td className="align-top">
                      <form action={updateTeacherEmail} className="flex min-w-72 flex-col gap-2 sm:flex-row">
                        <input type="hidden" name="teacher_id" value={teacher.id} />
                        <input
                          name="email"
                          type="email"
                          defaultValue={teacher.email ?? ""}
                          placeholder="name@sru.ac.th หรือเว้นว่าง"
                          aria-label={`อีเมลของ ${teacherDisplayName(teacher)}`}
                        />
                        <SubmitButton className="whitespace-nowrap" pendingText="กำลังบันทึก...">
                          บันทึกอีเมล
                        </SubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        ) : (
          <div className="mt-3 rounded-md border border-dashed border-line p-6 text-center">
            <EmptyState title="ยังไม่มีข้อมูลอาจารย์" description="เพิ่มข้อมูลอาจารย์พื้นฐานสำหรับเริ่มใช้งานระบบจริง โดยไม่สร้างข้อมูลโครงงานหรือนักศึกษาทดสอบ" />
            <form action={seedTeacherBaselineFromAdmin} className="mt-4">
              <SubmitButton pendingText="กำลังเพิ่มข้อมูลอาจารย์...">เพิ่มข้อมูลอาจารย์พื้นฐาน</SubmitButton>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
