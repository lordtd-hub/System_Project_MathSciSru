import type { GlobalRole } from "@prisma/client";

export type CapabilityUser = {
  role?: GlobalRole | null;
  roles?: GlobalRole[] | null;
  teacherId?: string | null;
};

export function getEffectiveRoles(user?: CapabilityUser | null): GlobalRole[] {
  const roles = new Set<GlobalRole>();
  if (user?.role) roles.add(user.role);
  for (const role of user?.roles ?? []) roles.add(role);
  if (user?.role === "ADMIN" && user.teacherId) roles.add("TEACHER");
  return [...roles];
}

export function hasAdminCapability(user?: CapabilityUser | null): boolean {
  return getEffectiveRoles(user).includes("ADMIN");
}

export function hasApprovedTeacherCapability(user?: CapabilityUser | null): boolean {
  if (user?.role === "TEACHER") return true;
  return user?.role === "ADMIN" && Boolean(user.teacherId) && getEffectiveRoles(user).includes("TEACHER");
}

export function isPendingTeacherClaim(user?: CapabilityUser | null): boolean {
  return user?.role === "PENDING_TEACHER";
}

