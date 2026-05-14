import Link from "next/link";
import { auth } from "@/auth";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { courseOfferingLabel, defaultCourseTitle } from "@/lib/admin/courseOffering";
import { isAdminTestingToolsEnabled } from "@/lib/admin/testingMode";
import { prisma } from "@/lib/db";
import { importManualDemoStudents, importStudents, openCourseOffering, resetCourseOfferingTestData } from "../actions";

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
  const testingToolsEnabled = isAdminTestingToolsEnabled();
  const offerings = await prisma.courseOffering.findMany({
    include: { term: { include: { academicYear: true } }, _count: { select: { projects: true } } },
    orderBy: { id: "desc" }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="เปิดรายวิชาและนำเข้านักศึกษา"
        description="เริ่มจากเปิดรายวิชาด้วยปีการศึกษาและภาคเรียน จากนั้นนำเข้านักศึกษาให้ผูกกับรายวิชานั้น"
      />
      <ActionFeedback success={params.success} error={params.error} />

      <section className="panel">
        <h2 className="text-lg font-semibold">เปิดรายวิชา</h2>
        <p className="mt-1 text-sm text-muted">ระบบจะสร้างปีการศึกษา ภาคเรียน รายวิชาที่เปิดสอน และรอบสอบระดับรายวิชาแบบร่าง ให้พร้อมจัดการต่อ</p>
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
            <p className="mt-1 text-sm text-muted">เลือกรายวิชาที่เปิดไว้แล้วก่อนนำเข้า CSV นักศึกษา</p>
          </div>
          <Link className="button-secondary" href="/admin/students">ดูรายชื่อนักศึกษาทั้งหมด</Link>
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
        {testingToolsEnabled && offerings.length ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-semibold text-amber-900">ชุดข้อมูลคู่มือ</h3>
            <p className="mt-1 text-sm text-amber-800">
              เพิ่มนักศึกษาคู่มือ 3 คนเข้า roster ของรายวิชาที่เลือก เพื่อใช้ถ่ายคู่มือใน QA เท่านั้น
            </p>
            <form action={importManualDemoStudents} className="mt-3 flex flex-wrap items-end gap-3">
              <div className="min-w-72 flex-1">
                <label>รายวิชาสำหรับนักศึกษาคู่มือ</label>
                <select name="course_offering_id" required defaultValue={selectedOfferingId ?? offerings[0]?.id}>
                  {offerings.map((offering) => (
                    <option key={offering.id} value={offering.id}>
                      {courseOfferingLabel(offering)} ({offering._count.projects} คน)
                    </option>
                  ))}
                </select>
              </div>
              <SubmitButton
                className="button-secondary"
                pendingText="กำลังเพิ่มนักศึกษาคู่มือ..."
                confirmMessage="ยืนยันเพิ่มนักศึกษาคู่มือ 3 คนเข้า roster ของรายวิชาที่เลือกหรือไม่?"
              >
                เพิ่มนักศึกษาคู่มือเข้า roster
              </SubmitButton>
            </form>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2 className="text-lg font-semibold">รายวิชาที่เปิดแล้ว</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {offerings.map((offering) => (
            <div key={offering.id} className="rounded-md border border-line p-4">
              <div className="font-semibold">{courseOfferingLabel(offering)}</div>
              <dl className="mt-2 grid gap-1 text-sm text-muted">
                <div className="flex justify-between gap-3"><dt>ปีการศึกษา</dt><dd>{offering.term.academicYear.yearBe}</dd></div>
                <div className="flex justify-between gap-3"><dt>สถานะ</dt><dd>{offering.status}</dd></div>
                <div className="flex justify-between gap-3"><dt>นักศึกษาในรายวิชา</dt><dd>{offering._count.projects}</dd></div>
              </dl>
              <Link className="button-secondary mt-3 inline-flex" href={`/admin/import-students?course_offering_id=${offering.id}`}>
                นำเข้านักศึกษาในรายวิชานี้
              </Link>
              {testingToolsEnabled ? (
                <form action={resetCourseOfferingTestData} className="mt-3">
                  <input type="hidden" name="course_offering_id" value={offering.id} />
                  <input type="hidden" name="return_to" value="/admin/import-students" />
                  <SubmitButton
                    className="button-secondary"
                    pendingText="กำลังลบรายวิชา..."
                    confirmMessage={`ยืนยันลบรายวิชา ${courseOfferingLabel(offering)} พร้อมโครงงาน/รอบสอบ/คะแนน/รายงานที่ผูกกับรายวิชานี้หรือไม่?`}
                  >
                    ลบรายวิชานี้
                  </SubmitButton>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
