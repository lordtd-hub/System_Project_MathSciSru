import Link from "next/link";
import { setUiModeAction } from "@/app/ui-mode/actions";
import type { UiMode } from "@/lib/uiMode";

type Role = "admin" | "teacher" | "student";

const iconPaths = {
  inbox: (
    <>
      <path d="M4 5.5h16v9l-3 4h-10l-3-4v-9Z" />
      <path d="M4 14.5h4l1.5 2h5l1.5-2h4" />
    </>
  ),
  calendar: (
    <>
      <path d="M5 5h14v14h-14z" />
      <path d="M8 3.5v3" />
      <path d="M16 3.5v3" />
      <path d="M5 9h14" />
      <path d="M8 12h2" />
      <path d="M12 12h2" />
      <path d="M16 12h1" />
      <path d="M8 15h2" />
      <path d="M12 15h2" />
    </>
  ),
  presentation: (
    <>
      <path d="M4 5h16v11h-16z" />
      <path d="M8 19l4-3 4 3" />
      <path d="M12 16v3" />
      <path d="M8 12l2-2 2 1.5 3-4 2 3" />
    </>
  ),
  progress1: (
    <>
      <path d="M5 18h14" />
      <path d="M7 15v-4" />
      <path d="M12 15v-8" />
      <path d="M17 15v-6" />
      <path d="M6 6h3" />
    </>
  ),
  progress2: (
    <>
      <path d="M5 18h14" />
      <path d="M7 15v-4" />
      <path d="M12 15v-8" />
      <path d="M17 15v-6" />
      <path d="M15 5.5h3l-3 3h3" />
    </>
  ),
  final: (
    <>
      <path d="M5 5h14v14h-14z" />
      <path d="M8 9h8" />
      <path d="M8 12h8" />
      <path d="M8 15h4" />
      <path d="M15 14l1 1 2-2" />
    </>
  ),
  report: (
    <>
      <path d="M7 4h7l3 3v13h-10z" />
      <path d="M14 4v4h4" />
      <path d="M9.5 11h5" />
      <path d="M9.5 14h5" />
      <path d="M9.5 17h3" />
    </>
  ),
  score: (
    <>
      <path d="M6 19v-7" />
      <path d="M12 19v-14" />
      <path d="M18 19v-10" />
      <path d="M5 19h14" />
      <path d="M7 8l2 2 4-5" />
    </>
  ),
  closeout: (
    <>
      <path d="M5 6h14v12h-14z" />
      <path d="M8 12l2.5 2.5 5-5" />
    </>
  ),
  evidence: (
    <>
      <path d="M6 4h12v16h-12z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h3" />
      <path d="M15 15l1 1 2-2" />
    </>
  ),
  project: (
    <>
      <path d="M5 7h6l2 2h6v10h-14z" />
      <path d="M8 13h8" />
      <path d="M8 16h5" />
    </>
  ),
  feedback: (
    <>
      <path d="M5 5h14v10h-8l-4 4v-4h-2z" />
      <path d="M8 9h8" />
      <path d="M8 12h5" />
    </>
  ),
  overview: (
    <>
      <path d="M5 5h6v6h-6z" />
      <path d="M13 5h6v6h-6z" />
      <path d="M5 13h6v6h-6z" />
      <path d="M13 13h6v6h-6z" />
    </>
  )
} satisfies Record<string, React.ReactNode>;

const navIconByHref: Record<string, keyof typeof iconPaths> = {
  "/admin": "overview",
  "/admin/rounds": "calendar",
  "/admin/proposals": "presentation",
  "/admin/schedules": "calendar",
  "/admin/reports": "report",
  "/admin/closeout": "closeout",
  "/admin/evidence": "evidence",
  "/teacher": "inbox",
  "/teacher/schedules": "calendar",
  "/teacher/proposals": "presentation",
  "/teacher/progress1": "progress1",
  "/teacher/progress2": "progress2",
  "/teacher/final": "final",
  "/teacher/reports": "report",
  "/teacher/advisor-score": "score",
  "/student": "overview",
  "/student/project": "project",
  "/student/proposal": "presentation",
  "/student/schedule": "calendar",
  "/student/report": "report",
  "/student/feedback": "feedback"
};

function NavIcon({ href }: { href: string }) {
  const icon = iconPaths[navIconByHref[href] ?? "overview"];

  return (
    <svg className="figma-role-nav-svg" viewBox="0 0 24 24" aria-hidden="true">
      {icon}
    </svg>
  );
}

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
              <span className="figma-role-nav-icon" aria-hidden="true"><NavIcon href={item.href} /></span>
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
