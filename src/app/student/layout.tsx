import { auth } from "@/auth";
import { getStudentProjectChoices } from "@/lib/terms/selection";
import { AcademicContextBar } from "@/components/ui/AcademicContextBar";
import { RoleDashboardNav } from "@/components/ui/RoleDashboardNav";
import { StudentSchedulePostSubmitGuard } from "@/components/ui/StudentSchedulePostSubmitGuard";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const selected = session?.user.role === "STUDENT" && session.user.email ? (await getStudentProjectChoices(session.user.email)).selected : null;
  const readOnly = selected?.courseOffering.status === "CLOSED" && selected.academicResult?.status !== "INCOMPLETE";
  return (
    <>
      <RoleDashboardNav role="student" />
      <StudentSchedulePostSubmitGuard />
      <AcademicContextBar />
      {readOnly ? <p className="panel mb-3">รายวิชานี้ปิดผลแล้ว เปิดอ่านข้อมูลเดิมได้ การส่ง/แก้งานปิดอยู่</p> : null}
      <fieldset disabled={readOnly} className="contents">{children}</fieldset>
    </>
  );
}
