import { describe, expect, it } from "vitest";
import {
  getFallbackInitials,
  getRoleDashboardHref,
  getRoleDashboardLabel,
  getSessionDashboardLinks,
  getSessionRoleLabel,
  getSessionDisplayName
} from "@/lib/auth/sessionUi";

describe("session UI helpers", () => {
  it("uses Google profile name before email", () => {
    expect(getSessionDisplayName({ name: "Sittichoke Son", email: "sittichoke.son@sru.ac.th" })).toBe("Sittichoke Son");
  });

  it("falls back to email when name is missing", () => {
    expect(getSessionDisplayName({ email: "admin@sru.ac.th" })).toBe("admin@sru.ac.th");
  });

  it("builds fallback initials from name or email", () => {
    expect(getFallbackInitials("Sittichoke Son")).toBe("SS");
    expect(getFallbackInitials("admin@sru.ac.th")).toBe("A");
  });

  it("maps roles to the correct next dashboard", () => {
    expect(getRoleDashboardHref("ADMIN")).toBe("/admin");
    expect(getRoleDashboardHref("TEACHER")).toBe("/teacher");
    expect(getRoleDashboardHref("STUDENT")).toBe("/student");
    expect(getRoleDashboardHref("PENDING_TEACHER")).toBe("/teacher/claim");
  });

  it("uses short labels for dashboard links", () => {
    expect(getRoleDashboardLabel("ADMIN")).toBe("Admin");
    expect(getRoleDashboardLabel("TEACHER")).toBe("Teacher");
    expect(getRoleDashboardLabel("STUDENT")).toBe("Student");
    expect(getRoleDashboardLabel("PENDING_TEACHER")).toBe("สถานะคำขอผูกบัญชี");
  });

  it("shows both admin and teacher links for linked admin-teacher users", () => {
    const user = { role: "ADMIN" as const, roles: ["ADMIN", "TEACHER"] as ("ADMIN" | "TEACHER")[], teacherId: "teacher-1" };
    expect(getSessionRoleLabel(user)).toBe("ADMIN • TEACHER");
    expect(getSessionDashboardLinks(user)).toEqual([
      { href: "/admin", label: "ผู้ดูแลระบบ" },
      { href: "/teacher", label: "อาจารย์" }
    ]);
  });
});
