"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type RoleDashboardNavProps = {
  role: "admin" | "teacher" | "student";
};

const roleConfig = {
  admin: {
    href: "/admin",
    label: "กลับหน้าหลักผู้ดูแลระบบ",
  },
  teacher: {
    href: "/teacher",
    label: "กลับหน้าหลักอาจารย์",
  },
  student: {
    href: "/student",
    label: "กลับหน้าหลักนักศึกษา",
  }
} as const;

export function RoleDashboardNav({ role }: RoleDashboardNavProps) {
  const pathname = usePathname();
  const config = roleConfig[role];

  if (pathname === config.href) return null;

  return (
    <nav className="role-dashboard-nav">
      <div className="role-dashboard-nav-copy">
        <Link className="button-secondary role-dashboard-return" href={config.href}>
          {config.label}
        </Link>
      </div>
    </nav>
  );
}
