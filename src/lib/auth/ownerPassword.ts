import { prisma } from "@/lib/db";
import { enrollmentCodeHash, hashOwnerPassword, validEnrollmentCode, validOwnerPassword, verifyOwnerPassword } from "./ownerPasswordCrypto";

type EnvLike = Record<string, string | undefined>;
export const OWNER_PASSWORD_ATTEMPT_LIMIT = 8;
export const OWNER_PASSWORD_WINDOW_MS = 15 * 60 * 1000;

export function getOwnerPasswordUserId(env: EnvLike = process.env) {
  return env.ENABLE_OWNER_PASSWORD_LOGIN === "1" ? env.OWNER_PASSWORD_USER_ID?.trim() || null : null;
}

function eligibleOwner(user: { id: string; active: boolean; globalRole: string } | null, userId: string) {
  return Boolean(user && user.id === userId && user.active && user.globalRole === "ADMIN");
}

export async function reserveOwnerPasswordAttempt(userId: string, now = new Date()) {
  const cutoff = new Date(now.getTime() - OWNER_PASSWORD_WINDOW_MS);
  await prisma.ownerPasswordCredential.updateMany({
    where: { userId, attemptWindowStart: { lte: cutoff } },
    data: { attempts: 0, attemptWindowStart: now }
  });
  const result = await prisma.ownerPasswordCredential.updateMany({
    where: { userId, enabled: true, revokedAt: null, attempts: { lt: OWNER_PASSWORD_ATTEMPT_LIMIT }, attemptWindowStart: { gt: cutoff } },
    data: { attempts: { increment: 1 } }
  });
  return result.count === 1;
}

export async function authenticateOwnerPassword(email: unknown, password: unknown) {
  const userId = getOwnerPasswordUserId();
  if (!userId || typeof email !== "string" || email.length > 254 || !validOwnerPassword(password)) return null;
  const credential = await prisma.ownerPasswordCredential.findUnique({ where: { userId }, include: { user: true } });
  // Reserve even for an unknown email before any KDF: one distributed owner
  // quota prevents arbitrary email strings bypassing CPU/memory throttling.
  // Pending enrollment cannot log in and cannot have its setup quota exhausted
  // through the public login endpoint before the owner activates it.
  if (!credential?.enabled || credential.revokedAt || !credential.passwordHash || !credential.activatedAt ||
    !eligibleOwner(credential.user, userId) || !await reserveOwnerPasswordAttempt(userId)) return null;
  if (!credential || credential.loginEmail !== email.trim().toLowerCase() || !credential.enabled || credential.revokedAt ||
    !credential.passwordHash || !credential.activatedAt || !eligibleOwner(credential.user, userId)) {
    await verifyOwnerPassword(password, null);
    return null;
  }
  if (!await verifyOwnerPassword(password, credential.passwordHash)) return null;
  const version = credential.credentialVersion;
  return prisma.$transaction(async (tx) => {
    const accepted = await tx.ownerPasswordCredential.updateMany({
      where: { userId, enabled: true, revokedAt: null, credentialVersion: version, passwordHash: credential.passwordHash,
        user: { active: true, globalRole: "ADMIN" } }, data: { lastUsedAt: new Date() }
    });
    if (accepted.count !== 1) return null;
    const user = await tx.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
    await tx.auditLog.create({ data: { actorUserId: userId, action: "OWNER_PASSWORD_SIGN_IN", entityType: "User", entityId: userId } });
    return { id: user.id, email: user.email, name: user.name, ownerPasswordVersion: version };
  });
}

// Always called for a password JWT, including refresh; no role-cache shortcut.
export async function getOwnerPasswordSession(userId: unknown, version: unknown) {
  const configuredId = getOwnerPasswordUserId();
  if (!configuredId || userId !== configuredId || typeof version !== "number") return null;
  const credential = await prisma.ownerPasswordCredential.findUnique({
    where: { userId: configuredId }, include: { user: { include: { teacher: true } } }
  });
  if (!credential?.enabled || credential.revokedAt || !credential.passwordHash || !credential.activatedAt ||
    credential.credentialVersion !== version || !eligibleOwner(credential.user, configuredId)) return null;
  return credential.user;
}

export async function enrollOwnerPassword(code: unknown, password: unknown) {
  const userId = getOwnerPasswordUserId();
  if (!userId || !validEnrollmentCode(code) || !validOwnerPassword(password) || code === password) return false;
  const tokenHash = enrollmentCodeHash(code);
  const credential = await prisma.ownerPasswordCredential.findUnique({ where: { userId }, include: { user: true } });
  if (!credential?.enabled || credential.revokedAt || credential.passwordHash || credential.enrollmentTokenHash !== tokenHash ||
    !credential.enrollmentExpiresAt || credential.enrollmentExpiresAt <= new Date() || !eligibleOwner(credential.user, userId)) return false;
  if (!await reserveOwnerPasswordAttempt(userId)) return false;
  // The random code has 256 bits of entropy. Unknown codes never trigger a password KDF.
  const passwordHash = await hashOwnerPassword(password);
  return prisma.$transaction(async (tx) => {
    const consumed = await tx.ownerPasswordCredential.updateMany({
      where: { userId, enabled: true, revokedAt: null, passwordHash: null, enrollmentTokenHash: tokenHash,
        enrollmentExpiresAt: { gt: new Date() }, user: { active: true, globalRole: "ADMIN" } },
      data: { passwordHash, enrollmentTokenHash: null, enrollmentExpiresAt: null, activatedAt: new Date(), credentialVersion: { increment: 1 } }
    });
    if (consumed.count !== 1) return false;
    await tx.auditLog.create({ data: { actorUserId: userId, action: "OWNER_PASSWORD_ENROLLED", entityType: "User", entityId: userId } });
    return true;
  });
}

export async function changeOwnerPassword(userId: string, currentPassword: unknown, newPassword: unknown) {
  if (userId !== getOwnerPasswordUserId() || !validOwnerPassword(currentPassword) || !validOwnerPassword(newPassword) || currentPassword === newPassword) return false;
  const credential = await prisma.ownerPasswordCredential.findUnique({ where: { userId }, include: { user: true } });
  if (!credential?.enabled || credential.revokedAt || !credential.passwordHash || !eligibleOwner(credential.user, userId)) return false;
  if (!await reserveOwnerPasswordAttempt(userId) || !await verifyOwnerPassword(currentPassword, credential.passwordHash)) return false;
  const passwordHash = await hashOwnerPassword(newPassword);
  return prisma.$transaction(async (tx) => {
    const changed = await tx.ownerPasswordCredential.updateMany({
      where: { userId, enabled: true, revokedAt: null, credentialVersion: credential.credentialVersion, passwordHash: credential.passwordHash,
        user: { active: true, globalRole: "ADMIN" } },
      data: { passwordHash, credentialVersion: { increment: 1 } }
    });
    if (changed.count !== 1) return false;
    await tx.auditLog.create({ data: { actorUserId: userId, action: "OWNER_PASSWORD_CHANGED", entityType: "User", entityId: userId } });
    return true;
  });
}
