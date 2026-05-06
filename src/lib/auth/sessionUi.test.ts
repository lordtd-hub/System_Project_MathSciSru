import { describe, expect, it } from "vitest";
import {
  getFallbackInitials,
  getRoleDashboardHref,
  getRoleDashboardLabel,
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

  it("uses clear labels for dashboard links", () => {
    expect(getRoleDashboardLabel("ADMIN")).toContain("Admin dashboard");
    expect(getRoleDashboardLabel("PENDING_TEACHER")).toContain("คำขอผูกบัญชีอาจารย์");
  });
});

