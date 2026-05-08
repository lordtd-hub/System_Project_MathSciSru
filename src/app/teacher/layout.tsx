import { RoleDashboardNav } from "@/components/ui/RoleDashboardNav";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RoleDashboardNav role="teacher" />
      {children}
    </>
  );
}
