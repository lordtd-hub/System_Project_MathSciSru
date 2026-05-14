import { RoleDashboardNav } from "@/components/ui/RoleDashboardNav";
import { StudentSchedulePostSubmitGuard } from "@/components/ui/StudentSchedulePostSubmitGuard";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RoleDashboardNav role="student" />
      <StudentSchedulePostSubmitGuard />
      {children}
    </>
  );
}
