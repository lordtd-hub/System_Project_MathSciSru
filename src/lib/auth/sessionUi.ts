import type { GlobalRole } from "@prisma/client";
import { getEffectiveRoles, hasApprovedTeacherCapability, type CapabilityUser } from "@/lib/auth/capabilities";

type SessionUserSummary = {
  name?: string | null;
  email?: string | null;
};

export function getSessionDisplayName(user?: SessionUserSummary | null) {
  return user?.name?.trim() || user?.email?.trim() || "ผู้ใช้";
}

export function getFallbackInitials(value?: string | null) {
  const source = value?.trim();
  if (!source) return "U";

  const label = source.includes("@") ? source.split("@")[0] : source;
  const parts = label.split(/\s+/).filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .filter(Boolean)
    .join("");

  return (initials || "U").toUpperCase();
}

export function getRoleDashboardHref(role?: GlobalRole | null) {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "TEACHER":
      return "/teacher";
    case "STUDENT":
      return "/student";
    case "PENDING_TEACHER":
      return "/teacher/claim";
    default:
      return "/login";
  }
}

export function getRoleDashboardLabel(role?: GlobalRole | null) {
  switch (role) {
    case "ADMIN":
      return "Admin";
    case "TEACHER":
      return "Teacher";
    case "STUDENT":
      return "Student";
    case "PENDING_TEACHER":
      return "สถานะคำขอผูกบัญชี";
    default:
      return "เข้าสู่ระบบ";
  }
}

export function getSessionRoleLabel(user?: CapabilityUser | null) {
  const roles = getEffectiveRoles(user);
  return roles.length ? roles.join(" • ") : "SIGNED_IN";
}

export function getSessionDashboardLinks(user?: CapabilityUser | null) {
  const roles = getEffectiveRoles(user);
  const links: { href: string; label: string }[] = [];

  if (roles.includes("ADMIN")) links.push({ href: "/admin", label: "ผู้ดูแลระบบ" });
  if (hasApprovedTeacherCapability(user)) links.push({ href: "/teacher", label: "อาจารย์" });
  if (roles.includes("STUDENT")) links.push({ href: "/student", label: "นักศึกษา" });
  if (roles.includes("PENDING_TEACHER")) links.push({ href: "/teacher/claim", label: "สถานะคำขอผูกบัญชี" });

  return links.length ? links : [{ href: "/login", label: "เข้าสู่ระบบ" }];
}
