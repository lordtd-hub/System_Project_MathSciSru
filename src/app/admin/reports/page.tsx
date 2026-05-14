import Link from "next/link";
import { auth } from "@/auth";
import { AdminOperationalSummary } from "@/components/ui/AdminOperationalQueue";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function AdminReportsPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return <div className="panel">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</div>;

  return (
    <div className="space-y-4">
      <PageHeader
        title="รายงานและผลตรวจ"
        description="หน้านี้สรุปทางไปยังงานรายงานที่ผู้ดูแลระบบต้องติดตาม โดยไม่เปลี่ยนขั้นตอนตรวจรายงานเดิมของอาจารย์"
      />

      <AdminOperationalSummary
        title="งานรายงานของผู้ดูแลระบบ"
        description="การตรวจรายงานยังเป็นหน้าที่ของอาจารย์ผู้ตรวจ ส่วนผู้ดูแลระบบใช้หน้านี้เพื่อติดตามความพร้อม หลักฐาน และการปิดโครงงาน"
        metrics={[
          { label: "หลักฐาน", count: 1, tone: "ready", description: "ตรวจรายงานฉบับล่าสุดและข้อมูลส่งออก" },
          { label: "ปิดโครงงาน", count: 1, tone: "ready", description: "ดูรายชื่อที่พร้อมปิดหรือยังขาดคะแนน/รายงาน" },
          { label: "ประวัติ", count: 1, tone: "completed", description: "ดู timeline และ audit log ที่เกี่ยวกับรายงาน" }
        ]}
      />

      <section className="grid gap-3 md:grid-cols-3">
        <Link className="panel block border-l-4 border-l-[var(--red-700)] hover:bg-paperSoft" href="/admin/evidence">
          <h2 className="text-base font-semibold">หลักฐานรายงาน</h2>
          <p className="mt-1 text-sm leading-6 text-muted">ดูสถานะรายงาน เวอร์ชันล่าสุด และดาวน์โหลด CSV/Excel สำหรับตรวจหลักฐาน</p>
        </Link>
        <Link className="panel block border-l-4 border-l-[var(--red-700)] hover:bg-paperSoft" href="/admin/closeout">
          <h2 className="text-base font-semibold">ปิดโครงงาน</h2>
          <p className="mt-1 text-sm leading-6 text-muted">ตรวจว่าโครงงานมีรายงานผ่านและคะแนนที่ปรึกษาครบก่อนปิดเป็น Completed</p>
        </Link>
        <Link className="panel block border-l-4 border-l-[var(--lock-700)] hover:bg-paperSoft" href="/admin/evidence#project-evidence">
          <h2 className="text-base font-semibold">สถานะรายโครงงาน</h2>
          <p className="mt-1 text-sm leading-6 text-muted">ไล่ดูรายชื่อนักศึกษา โครงงาน และหลักฐานที่ยังขาดในรายวิชาที่เลือก</p>
        </Link>
      </section>
    </div>
  );
}
