import { describe, expect, it } from "vitest";
import { hasUsableCachedRole, ROLE_CACHE_TTL_MS } from "./jwtRoleCache";

describe("JWT role cache", () => {
  const now = new Date("2026-05-09T00:00:00.000Z").getTime();

  it("reuses a fresh token with complete role data", () => {
    expect(
      hasUsableCachedRole({
        appUserId: "user-1",
        role: "ADMIN",
        roles: ["ADMIN"],
        teacherId: null,
        roleSyncedAt: now
      }, now)
    ).toBe(true);
  });

  it("keeps ADMIN plus TEACHER capability cacheable when linked to a teacher profile", () => {
    expect(
      hasUsableCachedRole({
        appUserId: "user-1",
        role: "ADMIN",
        roles: ["ADMIN", "TEACHER"],
        teacherId: "teacher-1",
        roleSyncedAt: now
      }, now)
    ).toBe(true);
  });

  it("forces a role lookup when cached role data is expired", () => {
    expect(
      hasUsableCachedRole({
        appUserId: "user-1",
        role: "ADMIN",
        roles: ["ADMIN"],
        teacherId: null,
        roleSyncedAt: now - ROLE_CACHE_TTL_MS - 1
      }, now)
    ).toBe(false);
  });

  it("forces a role lookup when cached role data is incomplete", () => {
    expect(hasUsableCachedRole({ appUserId: "user-1", role: "STUDENT" })).toBe(false);
    expect(hasUsableCachedRole({ role: "TEACHER", roles: ["TEACHER"], teacherId: "teacher-1", roleSyncedAt: now }, now)).toBe(false);
    expect(hasUsableCachedRole({ appUserId: "user-1", role: "TEACHER", roles: ["STUDENT"], roleSyncedAt: now }, now)).toBe(false);
    expect(hasUsableCachedRole({ appUserId: "user-1", role: "ADMIN", roles: ["ADMIN"], teacherId: null })).toBe(false);
  });

  it("forces a role lookup when ADMIN plus TEACHER capability is missing teacherId", () => {
    expect(
      hasUsableCachedRole({
        appUserId: "user-1",
        role: "ADMIN",
        roles: ["ADMIN", "TEACHER"],
        teacherId: null,
        roleSyncedAt: now
      }, now)
    ).toBe(false);
  });
});
