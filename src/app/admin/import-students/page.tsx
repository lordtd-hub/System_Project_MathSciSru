import { auth } from "@/auth";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { courseOfferingLabel, defaultCourseTitle } from "@/lib/admin/courseOffering";
import { prisma } from "@/lib/db";
import { importStudents, openCourseOffering } from "../actions";

export default async function ImportStudentsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return <div className="panel">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</div>;

  const params = (await searchParams) ?? {};
  const selectedOfferingId = Array.isArray(params.course_offering_id) ? params.course_offering_id[0] : params.course_offering_id;
  const currentYearBe = new Date().getFullYear() + 543;
  const offerings = await prisma.courseOffering.findMany({
    include: { term: { include: { academicYear: true } }, _count: { select: { projects: true } } },
    orderBy: { id: "desc" }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="เปิดรายวิชาและนำเข้านักศึกษา"
        description="เริ่มจากเปิด Course Offering ด้วยปีการศึกษาและภาคเรียน จากนั้นนำเข้านักศึกษาให้ผูกกับรายวิชานั้น"
      />
      <ActionFeedback success={params.success} error={params.error} />
      <GuidancePanel
        title="ขั้นตอนการใช้งานจริง"
        current="เปิดรายวิชาด้วยปีการศึกษาและภาคเรียน เช่น 2569 / ภาคเรียนที่ 1"
        next="หลังเปิดรายวิชาแล้ว เลือกรายวิชานั้นในฟอร์มนำเข้านักศึกษา"
        actor="ผู้ดูแลระบบเท่านั้นที่เปิดรายวิชาและนำเข้ารายชื่อนักศึกษาได้"
      />

      <section className="panel">
        <h2 className="text-lg font-semibold">เปิดรายวิชา</h2>
        <p className="mt-1 text-sm text-muted">ระบบจะสร้างปีการศึกษา ภาคเรียน Course Offering และรอบสอบระดับรายวิชาแบบ DRAFT ให้พร้อมจัดการต่อ</p>
        <form action={openCourseOffering} className="mt-4 grid gap-4 md:grid-cols-4">
          <div>
            <label>ปีการศึกษา</label>
            <input name="year_be" type="number" min={2500} max={2700} defaultValue={currentYearBe} required />
          </div>
          <div>
            <label>ภาคเรียน</label>
            <select name="term_type" required defaultValue="1">
              <option value="1">ภาคเรียนที่ 1</option>
              <option value="2">ภาคเรียนที่ 2</option>
              <option value="summer">ภาคฤดูร้อน</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label>ชื่อรายวิชา</label>
            <input name="course_title" defaultValue={defaultCourseTitle} placeholder="Mathematical Project Course" />
          </div>
          <div className="md:col-span-4">
            <SubmitButton pendingText="กำลังเปิดรายวิชา...">เปิดรายวิชา</SubmitButton>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">นำเข้านักศึกษาในรายวิชานี้</h2>
            <p className="mt-1 text-sm text-muted">เลือก Course Offering ที่เปิดไว้แล้วก่อนนำเข้า CSV นักศึกษา</p>
          </div>
          <a className="button-secondary" href="/admin/students">ดูรายชื่อนักศึกษาทั้งหมด</a>
        </div>
        {offerings.length ? (
          <form action={importStudents} className="mt-4 space-y-4">
            <div>
              <label>รายวิชา / ปีการศึกษา / ภาคเรียน</label>
              <select name="course_offering_id" required defaultValue={selectedOfferingId ?? offerings[0]?.id}>
                {offerings.map((offering) => (
                  <option key={offering.id} value={offering.id}>
                    {courseOfferingLabel(offering)} ({offering._count.projects} คน)
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
                คอลัมน์ที่ต้องมี: student_code, first_name_th, last_name_th ระบบจะสร้างอีเมล student_code@student.sru.ac.th ให้อัตโนมัติ
              </p>
            </div>
            <SubmitButton pendingText="กำลังนำเข้า...">นำเข้านักศึกษาในรายวิชานี้</SubmitButton>
          </form>
        ) : (
          <EmptyState title="ยังไม่มีรายวิชาที่เปิด" description="กรอกปีการศึกษาและภาคเรียนด้านบน แล้วกดเปิดรายวิชาก่อนนำเข้านักศึกษา" />
        )}
      </section>

      <section className="panel">
        <h2 className="text-lg font-semibold">Course Offering ที่เปิดแล้ว</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {offerings.map((offering) => (
            <div key={offering.id} className="rounded-md border border-line p-4">
              <div className="font-semibold">{courseOfferingLabel(offering)}</div>
              <dl className="mt-2 grid gap-1 text-sm text-muted">
                <div className="flex justify-between gap-3"><dt>ปีการศึกษา</dt><dd>{offering.term.academicYear.yearBe}</dd></div>
                <div className="flex justify-between gap-3"><dt>สถานะ</dt><dd>{offering.status}</dd></div>
                <div className="flex justify-between gap-3"><dt>นักศึกษาในรายวิชา</dt><dd>{offering._count.projects}</dd></div>
              </dl>
              <a className="button-secondary mt-3 inline-flex" href={`/admin/import-students?course_offering_id=${offering.id}`}>
                นำเข้านักศึกษาในรายวิชานี้
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
