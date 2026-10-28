import { prisma } from "@/lib/db";
import { createEnrollmentCode, enrollmentCodeHash } from "./ownerPasswordCrypto";
import { getOwnerPasswordUserId } from "./ownerPassword";

export type OwnerProvisionInput = {
  userId: string;
  expectedEmail: string;
  loginEmail: string;
  verificationReference: string;
  replaceExisting: boolean;
};

// Operator-only module: no web route or server action exposes provisioning.
export async function provisionOwnerPassword(input: OwnerProvisionInput,
  deliverPrivately: (code: string, expiresAt: Date) => Promise<void>) {
  if (!input.userId || input.userId !== getOwnerPasswordUserId() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.loginEmail) || input.loginEmail !== input.loginEmail.toLowerCase() ||
    input.verificationReference.length < 8 || input.verificationReference.length > 256) throw new Error("Invalid verified operator input");
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true, email: true, globalRole: true, active: true } });
    if (!user?.active || user.globalRole !== "ADMIN" || user.email?.trim().toLowerCase() !== input.expectedEmail.trim().toLowerCase() ||
      user.email?.trim().toLowerCase() === input.loginEmail) throw new Error("Existing owner verification failed");
    const collision = await tx.user.findFirst({ where: { email: { equals: input.loginEmail, mode: "insensitive" } }, select: { id: true } });
    if (collision) throw new Error("Login identity already exists");
    const existing = await tx.ownerPasswordCredential.findUnique({ where: { userId: input.userId } });
    if (existing && !input.replaceExisting) throw new Error("Replacement needs explicit operator approval");
    const code = createEnrollmentCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const data = { loginEmail: input.loginEmail, enabled: true, passwordHash: null, activatedAt: null, revokedAt: null,
      enrollmentTokenHash: enrollmentCodeHash(code), enrollmentExpiresAt: expiresAt, attempts: 0, attemptWindowStart: new Date() };
    if (existing) {
      const updated = await tx.ownerPasswordCredential.updateMany({ where: { userId: input.userId, credentialVersion: existing.credentialVersion },
        data: { ...data, credentialVersion: { increment: 1 } } });
      if (updated.count !== 1) throw new Error("Concurrent credential change");
    } else await tx.ownerPasswordCredential.create({ data: { userId: input.userId, ...data } });
    await tx.auditLog.create({ data: { actorUserId: null, action: "OWNER_PASSWORD_ENROLLMENT_ISSUED", entityType: "User", entityId: input.userId,
      metadataJson: { verificationReference: input.verificationReference, replaced: Boolean(existing), expiresAt: expiresAt.toISOString() } } });
    // Failed private delivery aborts the transaction. This is a local secure-file
    // callback, never email/network; the plaintext code is not returned or logged.
    await deliverPrivately(code, expiresAt);
    return { userId: input.userId, expiresAt };
  }, { isolationLevel: "Serializable" });
}

export async function revokeOwnerPassword(userId: string, verificationReference: string) {
  if (!userId || userId !== process.env.OWNER_PASSWORD_USER_ID?.trim() || verificationReference.length < 8 || verificationReference.length > 256)
    throw new Error("Invalid operator revocation");
  return prisma.$transaction(async (tx) => {
    const changed = await tx.ownerPasswordCredential.updateMany({ where: { userId }, data: {
      enabled: false, revokedAt: new Date(), credentialVersion: { increment: 1 }, passwordHash: null,
      enrollmentTokenHash: null, enrollmentExpiresAt: null
    } });
    if (changed.count !== 1) throw new Error("No owner credential");
    await tx.auditLog.create({ data: { actorUserId: null, action: "OWNER_PASSWORD_REVOKED", entityType: "User", entityId: userId,
      metadataJson: { verificationReference } } });
  });
}
