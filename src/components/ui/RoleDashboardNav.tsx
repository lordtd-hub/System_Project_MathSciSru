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
    helper: "กลับไปดูภาพรวมงานของผู้ดูแลระบบ",
    secondaryHref: "/admin/evidence",
    secondaryLabel: "Evidence & AUN-QA"
  },
  teacher: {
    href: "/teacher",
    label: "กลับหน้าอาจารย์",
    helper: "กลับไปดูงานที่เกี่ยวข้องกับอาจารย์",
    secondaryHref: null,
    secondaryLabel: null
  },
  student: {
    href: "/student",
    label: "กลับหน้านักศึกษา",
    helper: "กลับไปดูขั้นตอนปัจจุบันของนักศึกษา",
    secondaryHref: null,
    secondaryLabel: null
  }
} as const;

export function RoleDashboardNav({ role }: RoleDashboardNavProps) {
  const pathname = usePathname();
  const config = roleConfig[role];

  if (pathname === config.href) return null;

  return (
    <nav className="role-dashboard-nav">
      <div className="text-sm text-muted">{config.helper}</div>
      <div className="flex flex-wrap gap-2">
        {config.secondaryHref && pathname !== config.secondaryHref ? (
          <Link className="button-secondary w-full justify-center sm:w-auto" href={config.secondaryHref}>
            {config.secondaryLabel}
          </Link>
        ) : null}
        <Link className="button-secondary w-full justify-center sm:w-auto" href={config.href}>
          {config.label}
        </Link>
      </div>
    </nav>
  );
}
