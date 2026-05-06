import type { GlobalRole } from "@prisma/client";

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
      return "ไปหน้า Admin dashboard";
    case "TEACHER":
      return "ไปหน้า Teacher dashboard";
    case "STUDENT":
      return "ไปหน้า Student dashboard";
    case "PENDING_TEACHER":
      return "ดูสถานะคำขอผูกบัญชีอาจารย์";
    default:
      return "เข้าสู่ระบบ";
  }
}

