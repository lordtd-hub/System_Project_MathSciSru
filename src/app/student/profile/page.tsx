import { auth } from "@/auth";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormSection } from "@/components/ui/FormSection";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/db";
import { saveStudentProfile } from "../actions";

export default async function StudentProfilePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user.role !== "STUDENT" || !session.user.email) return <div className="panel">หน้านี้สำหรับนักศึกษาเท่านั้น</div>;
  const params = (await searchParams) ?? {};

  const student = await prisma.student.findUnique({
    where: { generatedEmail: session.user.email.toLowerCase() },
    include: { profile: true, projects: { orderBy: { createdAt: "desc" }, take: 1 } }
  });

  if (!student) {
    return <EmptyState title="ยังไม่พบข้อมูลนักศึกษา" description="กรุณาติดต่อผู้ดูแลระบบให้นำเข้ารายชื่อก่อนใช้งาน" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="ข้อมูลนักศึกษา" description="ตรวจสอบข้อมูลพื้นฐานและช่องทางติดต่อก่อนเริ่มสร้างโครงงาน" />
      <ActionFeedback success={params.success} error={params.error} />
      <FormSection title="ข้อมูลพื้นฐาน" description="ข้อมูลจากการนำเข้าโดยผู้ดูแลระบบ">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label>รหัสนักศึกษา</label>
            <input value={student.studentCode} readOnly />
          </div>
          <div>
            <label>อีเมลนักศึกษา</label>
            <input value={student.generatedEmail} readOnly />
          </div>
          <div>
            <label>ชื่อ</label>
            <input value={student.firstNameTh} readOnly />
          </div>
          <div>
            <label>นามสกุล</label>
            <input value={student.lastNameTh} readOnly />
          </div>
        </div>
      </FormSection>
      <form action={saveStudentProfile}>
      <FormSection title="ช่องทางติดต่อ" description="บันทึกข้อมูลส่วนตัวให้ครบเพื่อปลดล็อกขั้นตอนสร้างโครงงาน">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label>ชื่อเล่น/ชื่อที่ต้องการให้เรียก</label>
            <input name="preferred_name" defaultValue={student.profile?.preferredName ?? ""} placeholder="เช่น เมย์" />
          </div>
          <div>
            <label>เบอร์โทรศัพท์</label>
            <input name="phone" defaultValue={student.profile?.phone ?? ""} placeholder="08x-xxx-xxxx" />
          </div>
          <div>
            <label>LINE ID</label>
            <input name="line_id" defaultValue={student.profile?.lineId ?? ""} placeholder="line_id" />
          </div>
        </div>
        <SubmitButton pendingText="กำลังบันทึก..." className="mt-4">บันทึกข้อมูลนักศึกษา</SubmitButton>
      </FormSection>
      </form>
    </div>
  );
}
