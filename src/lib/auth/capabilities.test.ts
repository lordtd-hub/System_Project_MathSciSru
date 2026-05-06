import { describe, expect, it } from "vitest";
import {
  getEffectiveRoles,
  hasAdminCapability,
  hasApprovedTeacherCapability,
  isPendingTeacherClaim
} from "@/lib/auth/capabilities";

describe("auth capabilities", () => {
  it("keeps a plain admin admin-only", () => {
    const user = { role: "ADMIN" as const };
    expect(hasAdminCapability(user)).toBe(true);
    expect(hasApprovedTeacherCapability(user)).toBe(false);
    expect(getEffectiveRoles(user)).toEqual(["ADMIN"]);
  });

  it("allows an admin with a linked teacher profile to use teacher capability", () => {
    const user = { role: "ADMIN" as const, roles: ["ADMIN", "TEACHER"] as ("ADMIN" | "TEACHER")[], teacherId: "teacher-1" };
    expect(hasAdminCapability(user)).toBe(true);
    expect(hasApprovedTeacherCapability(user)).toBe(true);
    expect(getEffectiveRoles(user)).toEqual(["ADMIN", "TEACHER"]);
  });

  it("keeps approved teachers and pending teacher claims separate", () => {
    expect(hasApprovedTeacherCapability({ role: "TEACHER" })).toBe(true);
    expect(hasApprovedTeacherCapability({ role: "PENDING_TEACHER" })).toBe(false);
    expect(isPendingTeacherClaim({ role: "PENDING_TEACHER" })).toBe(true);
  });
});
