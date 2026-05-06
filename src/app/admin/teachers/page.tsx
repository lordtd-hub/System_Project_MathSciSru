import { auth } from "@/auth";
import { updateTeacherEmail } from "@/app/admin/actions";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/db";
import { teacherDisplayName } from "@/lib/teachers/displayName";

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
        actions={<a className="button" href="/admin/claims">คำขอ claim {pendingClaims}</a>}
      />
      <ActionFeedback success={params.success} error={params.error} />
      <GuidancePanel
        title="อีเมลอาจารย์"
        current="ผู้ดูแลระบบแก้ได้เฉพาะอีเมลของโปรไฟล์อาจารย์ เพื่อให้ระบบ auto-link กับ Google login ครั้งถัดไป"
        next="หลังบันทึกอีเมล ให้อาจารย์ออกจากระบบแล้วเข้าสู่ระบบใหม่เพื่อ refresh สิทธิ์ ADMIN/TEACHER"
        actor="การอนุมัติ teacher claim ยังทำที่หน้าคำขอผูกบัญชีอาจารย์เหมือนเดิม"
      />
      <section className="panel">
        <h2 className="text-lg font-semibold">รายชื่ออาจารย์</h2>
        <div className="mt-3 overflow-x-auto">
          {teachers.length ? (
            <table className="responsive-table">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="py-2 text-left">ชื่ออาจารย์</th>
                  <th className="text-left">อีเมลที่ผูกบัญชี</th>
                  <th className="text-left">ประเมิน Proposal</th>
                  <th className="text-left">Claim ล่าสุด</th>
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
          ) : (
            <EmptyState title="ยังไม่มีข้อมูลอาจารย์" description="เพิ่มข้อมูลอาจารย์จาก seed หรือเครื่องมือจัดการข้อมูลก่อนเริ่มใช้งาน" />
          )}
        </div>
      </section>
    </div>
  );
}

