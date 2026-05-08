import type { GlobalRole } from "@prisma/client";
import type { JWT } from "next-auth/jwt";

const validRoles = new Set<GlobalRole>(["ADMIN", "TEACHER", "STUDENT", "PENDING_TEACHER"]);

function isGlobalRole(value: unknown): value is GlobalRole {
  return typeof value === "string" && validRoles.has(value as GlobalRole);
}

export function hasUsableCachedRole(token: JWT) {
  if (typeof token.appUserId !== "string") return false;
  if (!isGlobalRole(token.role)) return false;
  if (!Array.isArray(token.roles) || token.roles.length === 0) return false;
  if (!token.roles.every(isGlobalRole)) return false;
  if (!token.roles.includes(token.role)) return false;
  if (token.teacherId !== null && token.teacherId !== undefined && typeof token.teacherId !== "string") return false;
  return true;
}
