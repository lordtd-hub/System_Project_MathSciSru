import { describe, expect, it } from "vitest";
import { hasUsableCachedRole } from "./jwtRoleCache";

describe("JWT role cache", () => {
  it("reuses a fresh token with complete role data", () => {
    expect(
      hasUsableCachedRole({
        appUserId: "user-1",
        role: "ADMIN",
        roles: ["ADMIN"],
        teacherId: null
      })
    ).toBe(true);
  });

  it("keeps ADMIN plus TEACHER capability cacheable when linked to a teacher profile", () => {
    expect(
      hasUsableCachedRole({
        appUserId: "user-1",
        role: "ADMIN",
        roles: ["ADMIN", "TEACHER"],
        teacherId: "teacher-1"
      })
    ).toBe(true);
  });

  it("forces a role lookup when cached role data is incomplete", () => {
    expect(hasUsableCachedRole({ appUserId: "user-1", role: "STUDENT" })).toBe(false);
    expect(hasUsableCachedRole({ role: "TEACHER", roles: ["TEACHER"], teacherId: "teacher-1" })).toBe(false);
    expect(hasUsableCachedRole({ appUserId: "user-1", role: "TEACHER", roles: ["STUDENT"] })).toBe(false);
  });
});
