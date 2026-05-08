import { RoleDashboardNav } from "@/components/ui/RoleDashboardNav";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RoleDashboardNav role="student" />
      {children}
    </>
  );
}
