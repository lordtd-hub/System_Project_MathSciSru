"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type RoleDashboardNavProps = {
  role: "admin" | "teacher" | "student";
};

const roleConfig = {
  admin: {
    href: "/admin",
    label: "กลับแดชบอร์ดผู้ดูแลระบบ",
  },
  teacher: {
    href: "/teacher",
    label: "กลับแดชบอร์ดอาจารย์",
  },
  student: {
    href: "/student",
    label: "กลับแดชบอร์ดนักศึกษา",
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
