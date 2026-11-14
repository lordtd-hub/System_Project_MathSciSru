import { AcademicContextBar } from "@/components/ui/AcademicContextBar";
import { AdminContextBoundary } from "@/components/ui/AdminContextBoundary";
import { RoleDashboardNav } from "@/components/ui/RoleDashboardNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RoleDashboardNav role="admin" />
      <AdminContextBoundary><AcademicContextBar contextRole="ADMIN" /></AdminContextBoundary>
      {children}
    </>
  );
}
