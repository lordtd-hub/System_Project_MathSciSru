import Link from "next/link";
import { setUiModeAction } from "@/app/ui-mode/actions";
import type { UiMode } from "@/lib/uiMode";

type Role = "admin" | "teacher" | "student";

const navIconByHref: Record<string, string> = {
  "/admin": "OV",
  "/admin/rounds": "RD",
  "/admin/proposals": "PP",
  "/admin/schedules": "SC",
  "/admin/reports": "RP",
  "/admin/closeout": "CL",
  "/admin/evidence": "EV",
  "/teacher": "IN",
  "/teacher/schedules": "SC",
  "/teacher/proposals": "PP",
  "/teacher/progress1": "P1",
  "/teacher/progress2": "P2",
  "/teacher/final": "FN",
  "/teacher/reports": "RP",
  "/teacher/advisor-score": "AS",
  "/student": "OV",
  "/student/project": "PJ",
  "/student/proposal": "PP",
  "/student/schedule": "SC",
  "/student/report": "RP",
  "/student/feedback": "FB"
};

const roleNavigation: Record<Role, { home: string; label: string; items: Array<{ href: string; label: string }> }> = {
  admin: {
    home: "/admin",
    label: "ผู้ดูแลระบบ",
    items: [
      { href: "/admin", label: "ภาพรวม" },
      { href: "/admin/rounds", label: "รอบสอบ" },
      { href: "/admin/proposals", label: "Proposal" },
      { href: "/admin/schedules", label: "ตารางสอบ" },
      { href: "/admin/reports", label: "รายงาน" },
      { href: "/admin/closeout", label: "ปิดโครงงาน" },
      { href: "/admin/evidence", label: "หลักฐาน" }
    ]
  },
  teacher: {
    home: "/teacher",
    label: "อาจารย์",
    items: [
      { href: "/teacher", label: "กล่องงาน" },
      { href: "/teacher/schedules", label: "ตารางสอบ" },
      { href: "/teacher/proposals", label: "Proposal" },
      { href: "/teacher/progress1", label: "Progress 1" },
      { href: "/teacher/progress2", label: "Progress 2" },
      { href: "/teacher/final", label: "Final" },
      { href: "/teacher/reports", label: "รายงาน" },
      { href: "/teacher/advisor-score", label: "Advisor Score" }
    ]
  },
  student: {
    home: "/student",
    label: "นักศึกษา",
    items: [
      { href: "/student", label: "ภาพรวม" },
      { href: "/student/project", label: "โครงงาน" },
      { href: "/student/proposal", label: "Proposal" },
      { href: "/student/schedule", label: "รอบสอบ" },
      { href: "/student/report", label: "รายงาน" },
      { href: "/student/feedback", label: "ผล/ข้อเสนอแนะ" }
    ]
  }
};

export function UiModeSwitch({ mode }: { mode: UiMode }) {
  return (
    <form action={setUiModeAction} className="figma-ui-mode-switch" aria-label="UI mode">
      <button type="submit" name="mode" value="classic" className={mode === "classic" ? "is-active" : ""}>
        Classic
      </button>
      <button type="submit" name="mode" value="figma" className={mode === "figma" ? "is-active" : ""}>
        Figma
      </button>
    </form>
  );
}

export function FigmaRoleShell({ role, mode, children }: { role: Role; mode: UiMode; children: React.ReactNode }) {
  const config = roleNavigation[role];

  return (
    <div className="figma-role-shell" data-role={role}>
      <aside className="figma-role-sidebar" aria-label={`${config.label} navigation`}>
        <Link href={config.home} className="figma-role-brand">
          <span className="figma-role-brand-mark">{config.label.slice(0, 1)}</span>
          <span>
            <strong>{config.label}</strong>
            <small>Project Operations</small>
          </span>
        </Link>
        <nav className="figma-role-nav">
          {config.items.map((item) => (
            <Link key={item.href} href={item.href} title={item.label} data-label={item.label}>
              <span className="figma-role-nav-icon" aria-hidden="true">{navIconByHref[item.href] ?? item.label.slice(0, 2)}</span>
              <span className="figma-role-nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="figma-role-sidebar-footer">
          <UiModeSwitch mode={mode} />
        </div>
      </aside>
      <div className="figma-role-main">
        <div className="figma-role-mobile-bar">
          <Link href={config.home} className="font-semibold text-brand">
            {config.label}
          </Link>
          <UiModeSwitch mode={mode} />
        </div>
        <div className="figma-role-content">{children}</div>
      </div>
    </div>
  );
}
