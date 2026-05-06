import { auth } from "@/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/db";
import { teacherDisplayName } from "@/lib/teachers/displayName";

export default async function AdminTeachersPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return <div className="panel">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</div>;
  const [teachers, pendingClaims] = await Promise.all([
    prisma.teacher.findMany({ include: { claims: { orderBy: { requestedAt: "desc" }, take: 1 } }, orderBy: [{ firstNameTh: "asc" }] }),
    prisma.teacherAccountClaim.count({ where: { status: "PENDING" } })
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="จัดการอาจารย์"
        description="ตรวจโปรไฟล์อาจารย์ อีเมลที่ผูกบัญชี และคำขอ claim"
        actions={<a className="button" href="/admin/claims">คำขอ claim {pendingClaims}</a>}
      />
      <GuidancePanel
        title="Teacher account claim"
        current="ตรวจคำขอผูกบัญชีจากอาจารย์ที่ login ด้วย @sru.ac.th"
        next="เมื่ออนุมัติแล้วอาจารย์จึงเข้าถึงข้อมูลนักศึกษาและหน้าประเมินได้"
        actor="ผู้ดูแลระบบเป็นผู้อนุมัติหรือปฏิเสธ claim"
      />
      <section className="panel">
        <h2 className="text-lg font-semibold">รายชื่ออาจารย์</h2>
        <div className="mt-3 overflow-x-auto">
          {teachers.length ? (
            <table className="responsive-table">
              <thead className="border-b border-line text-muted">
                <tr><th className="py-2">ชื่ออาจารย์</th><th>อีเมล</th><th>ประเมิน Proposal</th><th>Claim ล่าสุด</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {teachers.map((teacher) => (
                  <tr key={teacher.id}>
                    <td className="py-2">{teacherDisplayName(teacher)}</td>
                    <td>{teacher.email ?? "ยังไม่ผูกบัญชี"}</td>
                    <td>{teacher.canEvaluateProposal ? "ได้" : "ไม่ได้"}</td>
                    <td>{teacher.claims[0]?.status ?? "-"}</td>
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
