import { AcademicContextBar } from "@/components/ui/AcademicContextBar";
import { RoleDashboardNav } from "@/components/ui/RoleDashboardNav";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RoleDashboardNav role="teacher" />
      <AcademicContextBar />
      {children}
    </>
  );
}
