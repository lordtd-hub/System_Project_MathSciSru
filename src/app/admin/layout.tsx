import { RoleDashboardNav } from "@/components/ui/RoleDashboardNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RoleDashboardNav role="admin" />
      {children}
    </>
  );
}
