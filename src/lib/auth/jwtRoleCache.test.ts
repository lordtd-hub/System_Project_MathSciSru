import { describe, expect, it } from "vitest";
import { AUTH_ROLE_CACHE_TTL_MS, hasUsableCachedRole } from "./jwtRoleCache";

describe("JWT role cache", () => {
  const now = 1_700_000_000_000;

  it("reuses a fresh token with complete role data", () => {
    expect(
      hasUsableCachedRole(
        {
          appUserId: "user-1",
          role: "ADMIN",
          roles: ["ADMIN"],
          teacherId: null,
          roleSyncedAt: now - 1_000
        },
        now
      )
    ).toBe(true);
  });

  it("keeps ADMIN plus TEACHER capability cacheable when linked to a teacher profile", () => {
    expect(
      hasUsableCachedRole(
        {
          appUserId: "user-1",
          role: "ADMIN",
          roles: ["ADMIN", "TEACHER"],
          teacherId: "teacher-1",
          roleSyncedAt: now - 1_000
        },
        now
      )
    ).toBe(true);
  });

  it("forces a role lookup when cached role data is stale or incomplete", () => {
    expect(
      hasUsableCachedRole(
        {
          appUserId: "user-1",
          role: "TEACHER",
          roles: ["TEACHER"],
          teacherId: "teacher-1",
          roleSyncedAt: now - AUTH_ROLE_CACHE_TTL_MS - 1
        },
        now
      )
    ).toBe(false);

    expect(hasUsableCachedRole({ appUserId: "user-1", role: "STUDENT", roles: ["STUDENT"] }, now)).toBe(false);
  });
});
