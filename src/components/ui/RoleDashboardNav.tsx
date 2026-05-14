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

const contextLabels = {
  admin: [
    ["/admin/rounds", "รอบสอบของรายวิชา"],
    ["/admin/closeout", "ยืนยันจบโครงงาน"],
    ["/admin/proposals", "ผล Proposal"],
    ["/admin/schedules", "ตารางสอบ"],
    ["/admin/reports", "รายงานและผลตรวจ"],
    ["/admin/evidence", "หลักฐานและ AUN-QA"],
    ["/admin/claims", "คำขอผูกบัญชี"],
    ["/admin/teachers", "จัดการอาจารย์"],
    ["/admin/students", "จัดการนักศึกษา"],
    ["/admin/committee", "จัดการกรรมการ"],
    ["/admin/import-students", "นำเข้านักศึกษา"],
    ["/admin/round-exceptions", "ข้อยกเว้นรอบสอบ"]
  ],
  teacher: [
    ["/teacher/advicees", "ลูกศิษย์ที่ปรึกษา"],
    ["/teacher/advisor-requests", "คำขอที่ปรึกษา"],
    ["/teacher/schedules", "ตารางสอบ"],
    ["/teacher/proposals", "ประเมิน Proposal"],
    ["/teacher/progress1", "คะแนนความก้าวหน้าครั้งที่ 1"],
    ["/teacher/progress2", "คะแนนความก้าวหน้าครั้งที่ 2"],
    ["/teacher/final", "คะแนนสอบขั้นสุดท้าย"],
    ["/teacher/reports", "ตรวจรายงาน"],
    ["/teacher/advisor-score", "คะแนนที่ปรึกษา"],
    ["/teacher/scoring", "บันทึกคะแนน"]
  ],
  student: [
    ["/student/profile", "ข้อมูลนักศึกษา"],
    ["/student/project", "ข้อมูลโครงงาน"],
    ["/student/origin", "ที่มาโครงงาน"],
    ["/student/proposal", "เอกสารเสนอหัวข้อ"],
    ["/student/schedule", "เสนอวันสอบ"],
    ["/student/report", "ส่งรายงาน"],
    ["/student/feedback", "ผลและข้อเสนอแนะ"]
  ]
} as const;

function getContextLabel(role: RoleDashboardNavProps["role"], pathname: string) {
  const match = contextLabels[role].find(([prefix]) => pathname.startsWith(prefix));
  return match?.[1] ?? "ระบบจัดการโครงงาน";
}

export function RoleDashboardNav({ role }: RoleDashboardNavProps) {
  const pathname = usePathname();
  const config = roleConfig[role];
  const contextLabel = getContextLabel(role, pathname);

  if (pathname === config.href) return null;

  return (
    <nav className="role-dashboard-nav">
      <div className="role-dashboard-nav-copy">
        <span className="role-dashboard-context">{contextLabel}</span>
        <Link className="button-secondary role-dashboard-return" href={config.href}>
          {config.label}
        </Link>
      </div>
    </nav>
  );
}
