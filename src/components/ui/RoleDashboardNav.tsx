"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type RoleDashboardNavProps = {
  role: "admin" | "teacher" | "student";
};

const roleConfig = {
  admin: {
    href: "/admin",
    label: "กลับหน้า Admin",
    helper: "กลับไปดูภาพรวมงานของผู้ดูแลระบบ"
  },
  teacher: {
    href: "/teacher",
    label: "กลับหน้าอาจารย์",
    helper: "กลับไปดูงานที่เกี่ยวข้องกับอาจารย์"
  },
  student: {
    href: "/student",
    label: "กลับหน้านักศึกษา",
    helper: "กลับไปดูขั้นตอนปัจจุบันของนักศึกษา"
  }
} as const;

export function RoleDashboardNav({ role }: RoleDashboardNavProps) {
  const pathname = usePathname();
  const config = roleConfig[role];

  if (pathname === config.href) return null;

  return (
    <nav className="role-dashboard-nav">
      <div className="text-sm text-muted">{config.helper}</div>
      <Link className="button-secondary w-full justify-center sm:w-auto" href={config.href}>
        {config.label}
      </Link>
    </nav>
  );
}
