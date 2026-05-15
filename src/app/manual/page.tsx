import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { manualGuides } from "./manualContent";

export const metadata = {
  title: "คู่มือการใช้งาน | ระบบประเมินการนำเสนอโครงงาน",
  description: "คู่มือการใช้งานสำหรับนักศึกษาและอาจารย์"
};

export default function ManualIndexPage() {
  return (
    <section id="top" className="space-y-6">
      <PageHeader
        title="คู่มือการใช้งาน"
        description="คู่มือสำหรับนักศึกษาและอาจารย์ ครอบคลุมการส่งงานปกติ การเสนอวันสอบใหม่เมื่อถูกปฏิเสธ และการส่งรายงานฉบับใหม่เมื่ออาจารย์ขอแก้ไข"
      />

      <section className="app-card overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="p-6 sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-red-50 px-3 py-1 text-xs font-semibold text-brand">
              <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
              คู่มือการใช้งาน
            </div>
            <h2 className="mt-4 max-w-3xl text-2xl font-semibold leading-10 text-ink sm:text-3xl">
              เลือกคู่มือให้ตรงกับบทบาทของคุณ
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
              คู่มือนี้ช่วยบอกว่าต้องกดตรงไหน ส่งงานอย่างไร ดูผลตอบกลับตรงไหน และควรเห็นสถานะอะไรหลังทำแต่ละขั้นตอนเสร็จ
            </p>
          </div>
          <div className="border-t border-line bg-paperSoft p-6 lg:border-l lg:border-t-0">
            <SectionHeading title="เลือกอ่านตามงานที่ต้องทำ" compact />
            <ul className="space-y-3 text-sm leading-6 text-muted">
              <li>นักศึกษา: ส่งข้อมูลโครงงาน เสนอวันสอบ ส่งหลักฐาน และส่งรายงาน</li>
              <li>อาจารย์: รับเป็นที่ปรึกษา ตรวจตารางสอบ ประเมิน และตรวจรายงาน</li>
              <li>มีขั้นตอนสำหรับกรณีวันสอบถูกปฏิเสธและกรณีรายงานต้องแก้ไข</li>
            </ul>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {manualGuides.map((guide) => (
          <section key={guide.role} className="panel">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">คู่มือตามบทบาท</div>
            <h2 className="mt-2 text-xl font-semibold text-ink">{guide.title}</h2>
            <p className="mt-2 text-sm leading-7 text-muted">{guide.description}</p>
            <div className="mt-4 rounded-lg border border-line bg-paperSoft p-4">
              <div className="text-sm font-semibold text-ink">ครอบคลุม {guide.steps.length} ขั้นตอน</div>
              <p className="mt-1 text-sm leading-6 text-muted">{guide.audience}</p>
            </div>
            <Link className="button mt-5" href={`/manual/${guide.role}`}>
              เปิด{guide.title}
            </Link>
          </section>
        ))}
      </div>
    </section>
  );
}
