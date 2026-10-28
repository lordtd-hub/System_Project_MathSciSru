import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  db: { ownerPasswordCredential: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() }, auditLog: { create: vi.fn() }, $transaction: vi.fn() },
  hash: vi.fn(), verify: vi.fn()
}));
vi.mock("@/lib/db", () => ({ prisma: mock.db }));
vi.mock("./ownerPasswordCrypto", async (original) => ({ ...await original<typeof import("./ownerPasswordCrypto")>(), hashOwnerPassword: mock.hash, verifyOwnerPassword: mock.verify }));
import { authenticateOwnerPassword, changeOwnerPassword, enrollOwnerPassword, getOwnerPasswordSession, reserveOwnerPasswordAttempt } from "./ownerPassword";
import { enrollmentCodeHash } from "./ownerPasswordCrypto";
import { provisionOwnerPassword, revokeOwnerPassword } from "./ownerPasswordProvision";

const password = "synthetic owner password for tests";
const newPassword = "synthetic replacement password for tests";
const code = "A".repeat(43);
const owner = { id: "synthetic-existing-owner", email: "synthetic@sru.ac.th", googleSub: "original-google-sub", name: "Synthetic Owner", globalRole: "ADMIN", active: true, teacher: { id: "original-teacher", active: true } };
const active = { userId: owner.id, loginEmail: "synthetic@example.test", enabled: true, passwordHash: "synthetic-scrypt-hash", activatedAt: new Date(), revokedAt: null,
  credentialVersion: 3, attempts: 0, attemptWindowStart: new Date(), enrollmentTokenHash: null, enrollmentExpiresAt: null, user: owner };
const pending = { ...active, passwordHash: null, activatedAt: null, enrollmentTokenHash: enrollmentCodeHash(code), enrollmentExpiresAt: new Date(Date.now() + 60000) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ENABLE_OWNER_PASSWORD_LOGIN", "1");
  vi.stubEnv("OWNER_PASSWORD_USER_ID", owner.id);
  mock.db.ownerPasswordCredential.findUnique.mockResolvedValue(active);
  mock.db.ownerPasswordCredential.updateMany.mockResolvedValue({ count: 1 });
  mock.db.ownerPasswordCredential.create.mockResolvedValue({});
  mock.db.user.findUnique.mockResolvedValue(owner);
  mock.db.user.findFirst.mockResolvedValue(null);
  mock.db.user.update.mockResolvedValue(owner);
  mock.db.auditLog.create.mockResolvedValue({});
  mock.db.$transaction.mockImplementation((fn: (tx: typeof mock.db) => unknown) => fn(mock.db));
  mock.verify.mockResolvedValue(true);
  mock.hash.mockResolvedValue("synthetic-new-hash");
});
afterEach(() => vi.unstubAllEnvs());

describe("independent owner password login", () => {
  it("is disabled by default and never queries credentials while disabled", async () => {
    vi.stubEnv("ENABLE_OWNER_PASSWORD_LOGIN", "0");
    expect(await authenticateOwnerPassword(active.loginEmail, password)).toBeNull();
    expect(mock.db.ownerPasswordCredential.findUnique).not.toHaveBeenCalled();
  });
  it("returns original identity, accepts email casing, and updates only login evidence", async () => {
    expect(await authenticateOwnerPassword(` ${active.loginEmail.toUpperCase()} `, password)).toEqual({ id: owner.id, email: owner.email, name: owner.name, ownerPasswordVersion: 3 });
    expect(mock.db.user.update).toHaveBeenCalledWith({ where: { id: owner.id }, data: { lastLoginAt: expect.any(Date) } });
    expect(mock.db.ownerPasswordCredential.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ credentialVersion: 3, passwordHash: active.passwordHash, user: { active: true, globalRole: "ADMIN" } }) }));
    expect(mock.db.auditLog.create).toHaveBeenCalledWith({ data: { actorUserId: owner.id, action: "OWNER_PASSWORD_SIGN_IN", entityType: "User", entityId: owner.id } });
  });
  it("does not accept a matching email without the correct password", async () => {
    mock.verify.mockResolvedValue(false);
    expect(await authenticateOwnerPassword(active.loginEmail, password)).toBeNull();
    expect(mock.db.user.update).not.toHaveBeenCalled();
  });
  it("charges unknown email attempts to the distributed quota before dummy hashing", async () => {
    expect(await authenticateOwnerPassword("unknown@example.test", password)).toBeNull();
    expect(mock.verify).toHaveBeenCalledWith(password, null);
    expect(mock.db.ownerPasswordCredential.updateMany.mock.invocationCallOrder[1]).toBeLessThan(mock.verify.mock.invocationCallOrder[0]);
  });
  it("does not let public login exhaust a pending enrollment quota", async () => {
    mock.db.ownerPasswordCredential.findUnique.mockResolvedValue(pending);
    expect(await authenticateOwnerPassword(active.loginEmail, code)).toBeNull();
    expect(mock.db.ownerPasswordCredential.updateMany).not.toHaveBeenCalled();
    expect(mock.verify).not.toHaveBeenCalled();
  });
  it("does not hash after a full quota", async () => {
    mock.db.ownerPasswordCredential.updateMany.mockResolvedValue({ count: 0 });
    expect(await authenticateOwnerPassword(active.loginEmail, password)).toBeNull();
    expect(mock.verify).not.toHaveBeenCalled();
  });
  it("rejects a login if the password/version changes during verification", async () => {
    mock.db.ownerPasswordCredential.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect(await authenticateOwnerPassword(active.loginEmail, password)).toBeNull();
    expect(mock.db.user.update).not.toHaveBeenCalled();
  });
  it.each([{ ...active, enabled: false }, { ...active, revokedAt: new Date() }, { ...active, user: { ...owner, active: false } }, { ...active, user: { ...owner, globalRole: "TEACHER" } }, null])("denies disabled/revoked/ineligible/missing records", async (credential) => {
    mock.db.ownerPasswordCredential.findUnique.mockResolvedValue(credential);
    expect(await authenticateOwnerPassword(active.loginEmail, password)).toBeNull();
    expect(mock.db.user.update).not.toHaveBeenCalled();
  });
});

describe("persistent atomic quota", () => {
  it("reserves at most eight slots across concurrent callers", async () => {
    let attempts = 0;
    mock.db.ownerPasswordCredential.updateMany.mockImplementation(async ({ where }: { where: { attempts?: { lt: number } } }) => {
      if (!where.attempts) return { count: 0 };
      if (attempts >= where.attempts.lt) return { count: 0 };
      attempts += 1;
      return { count: 1 };
    });
    const results = await Promise.all(Array.from({ length: 20 }, () => reserveOwnerPasswordAttempt(owner.id)));
    expect(results.filter(Boolean)).toHaveLength(8);
    expect(mock.db.ownerPasswordCredential.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ attempts: { lt: 8 } }), data: { attempts: { increment: 1 } } }));
  });
});

describe("single-use enrollment", () => {
  beforeEach(() => mock.db.ownerPasswordCredential.findUnique.mockResolvedValue(pending));
  it("consumes the code and creates a password without granting a session or changing User", async () => {
    expect(await enrollOwnerPassword(code, password)).toBe(true);
    expect(mock.db.user.update).not.toHaveBeenCalled();
    expect(mock.db.ownerPasswordCredential.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ enrollmentTokenHash: enrollmentCodeHash(code), passwordHash: null, enrollmentExpiresAt: { gt: expect.any(Date) } }),
      data: expect.objectContaining({ passwordHash: "synthetic-new-hash", enrollmentTokenHash: null, enrollmentExpiresAt: null, credentialVersion: { increment: 1 } }) }));
  });
  it.each([{ ...pending, enrollmentExpiresAt: new Date(0) }, { ...pending, enrollmentTokenHash: "wrong-digest" }, { ...pending, passwordHash: "already-set" }, { ...pending, enabled: false }, { ...pending, user: { ...owner, active: false } }])("rejects expired/wrong/used/disabled code without hashing", async (record) => {
    mock.db.ownerPasswordCredential.findUnique.mockResolvedValue(record);
    expect(await enrollOwnerPassword(code, password)).toBe(false);
    expect(mock.hash).not.toHaveBeenCalled();
  });
  it("cannot reuse the enrollment code itself as the permanent password", async () => {
    expect(await enrollOwnerPassword(code, code)).toBe(false);
    expect(mock.hash).not.toHaveBeenCalled();
  });
  it("loses a consume race safely after hashing", async () => {
    mock.db.ownerPasswordCredential.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect(await enrollOwnerPassword(code, password)).toBe(false);
    expect(mock.db.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("password sessions and changes", () => {
  it("revalidates existing owner and teacher capability by ID", async () => {
    expect(await getOwnerPasswordSession(owner.id, 3)).toEqual(owner);
    expect(mock.db.ownerPasswordCredential.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: owner.id } }));
  });
  it.each([{ ...active, credentialVersion: 4 }, { ...active, revokedAt: new Date() }, { ...active, user: { ...owner, active: false } }, { ...active, user: { ...owner, globalRole: "TEACHER" } }, null])("revokes changed/revoked/disabled/demoted/deleted credential sessions", async (record) => {
    mock.db.ownerPasswordCredential.findUnique.mockResolvedValue(record);
    expect(await getOwnerPasswordSession(owner.id, 3)).toBeNull();
  });
  it("rejects wrong user IDs and a disabled global switch", async () => {
    expect(await getOwnerPasswordSession("other-owner", 3)).toBeNull();
    vi.stubEnv("ENABLE_OWNER_PASSWORD_LOGIN", "0");
    expect(await getOwnerPasswordSession(owner.id, 3)).toBeNull();
  });
  it("requires current password, rotates version atomically and never changes canonical User", async () => {
    expect(await changeOwnerPassword(owner.id, password, newPassword)).toBe(true);
    expect(mock.verify).toHaveBeenCalledWith(password, active.passwordHash);
    expect(mock.db.ownerPasswordCredential.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { passwordHash: "synthetic-new-hash", credentialVersion: { increment: 1 } } }));
    expect(mock.db.user.update).not.toHaveBeenCalled();
  });
  it("denies wrong current password and another owner ID", async () => {
    mock.verify.mockResolvedValue(false);
    expect(await changeOwnerPassword(owner.id, password, newPassword)).toBe(false);
    expect(await changeOwnerPassword("other-id", password, newPassword)).toBe(false);
    expect(mock.hash).not.toHaveBeenCalled();
  });
});

describe("operator-only verified enrollment provisioning", () => {
  const input = { userId: owner.id, expectedEmail: owner.email, loginEmail: active.loginEmail, verificationReference: "SYNTHETIC-APPROVAL-ONLY", replaceExisting: false };
  beforeEach(() => mock.db.ownerPasswordCredential.findUnique.mockResolvedValue(null));
  it("provisions the existing owner only, privately delivers once, stores digest not secret", async () => {
    const deliver = vi.fn(async () => undefined);
    const result = await provisionOwnerPassword(input, deliver);
    expect(result.userId).toBe(owner.id);
    expect(result).not.toHaveProperty("code");
    expect(deliver).toHaveBeenCalledTimes(1);
    const delivered = deliver.mock.calls[0] as unknown as [string, Date];
    const data = mock.db.ownerPasswordCredential.create.mock.calls[0][0].data;
    expect(data.enrollmentTokenHash).toBe(enrollmentCodeHash(delivered[0]));
    expect(JSON.stringify(data)).not.toContain(delivered[0]);
    expect(JSON.stringify(mock.db.auditLog.create.mock.calls)).not.toContain(delivered[0]);
    expect(data.passwordHash).toBeNull();
    expect(delivered[1].getTime() - Date.now()).toBeLessThanOrEqual(15 * 60 * 1000);
    expect(mock.db.user.update).not.toHaveBeenCalled();
  });
  it.each([{ ...input, userId: "other-owner" }, { ...input, expectedEmail: "other@sru.ac.th" }])("rejects mismatched owner verification without secret delivery", async (candidate) => {
    const deliver = vi.fn();
    await expect(provisionOwnerPassword(candidate, deliver)).rejects.toThrow();
    expect(deliver).not.toHaveBeenCalled();
  });
  it("rejects pre-existing personal User/email collisions and unapproved replacement", async () => {
    const deliver = vi.fn();
    mock.db.user.findFirst.mockResolvedValue({ id: "existing-personal-user" });
    await expect(provisionOwnerPassword(input, deliver)).rejects.toThrow();
    mock.db.user.findFirst.mockResolvedValue(null);
    mock.db.ownerPasswordCredential.findUnique.mockResolvedValue(active);
    await expect(provisionOwnerPassword(input, deliver)).rejects.toThrow();
    expect(deliver).not.toHaveBeenCalled();
  });
  it("propagates private delivery failure to abort the transaction", async () => {
    await expect(provisionOwnerPassword(input, async () => { throw new Error("synthetic delivery failure"); })).rejects.toThrow("synthetic delivery failure");
  });
  it("operator revocation clears both enrollment/password and increments session version", async () => {
    await revokeOwnerPassword(owner.id, input.verificationReference);
    expect(mock.db.ownerPasswordCredential.updateMany).toHaveBeenCalledWith({ where: { userId: owner.id }, data: expect.objectContaining({ enabled: false, credentialVersion: { increment: 1 }, passwordHash: null, enrollmentTokenHash: null }) });
  });
});
