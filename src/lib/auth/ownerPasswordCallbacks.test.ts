import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ config: {} as { callbacks: Record<string, (args: Record<string, unknown>) => Promise<unknown>>; providers: Array<{ id: string; authorize?: (args: Record<string, unknown>) => Promise<unknown>; options?: { id?: string; authorize?: (args: Record<string, unknown>) => Promise<unknown> } }> },
  session: vi.fn(), authenticate: vi.fn(), db: { user: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() }, teacher: { findFirst: vi.fn(), updateMany: vi.fn() } } }));
vi.mock("next-auth", () => ({ default: (config: typeof mock.config) => { mock.config = config; return {}; } }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: mock.db }));
vi.mock("./ownerPassword", () => ({ authenticateOwnerPassword: mock.authenticate, getOwnerPasswordSession: mock.session }));
vi.mock("@/lib/diagnostics/navTiming", () => ({ createNavTimer: () => ({ measure: (_: string, fn: () => unknown) => fn(), end: vi.fn() }) }));

const owner = { id: "synthetic-original-owner", email: "original@sru.ac.th", globalRole: "ADMIN", active: true, teacher: { id: "original-teacher", active: true } };
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("INITIAL_ADMIN_EMAIL", owner.email);
  vi.stubEnv("ADDITIONAL_ADMIN_EMAILS", "");
  mock.session.mockResolvedValue(owner);
  mock.authenticate.mockResolvedValue({ id: owner.id, email: owner.email, ownerPasswordVersion: 2 });
  mock.db.user.findUnique.mockResolvedValue(owner);
  mock.db.user.upsert.mockResolvedValue(owner);
  mock.db.user.updateMany.mockResolvedValue({count:1});
  mock.db.teacher.findFirst.mockResolvedValue(null);
  await import("../../auth");
});
afterEach(() => vi.unstubAllEnvs());
describe("independent owner credentials in actual NextAuth callbacks", () => {
  it("retains an explicitly assigned additional admin across verified Google login without replacing the owner", async () => {
    vi.stubEnv("ADDITIONAL_ADMIN_EMAILS", " BACKUP@SRU.AC.TH ");
    const backup = { ...owner, id:"backup-user", email:"backup@sru.ac.th", teacher:{id:"backup-teacher",active:true} };
    mock.db.user.findUnique.mockResolvedValue(backup);
    mock.db.user.upsert.mockResolvedValue(backup);
    expect(await mock.config.callbacks.signIn({account:{provider:"google"},profile:{sub:"backup-google-sub",email_verified:true},user:{email:" BACKUP@SRU.AC.TH "}})).toBe(true);
    expect(mock.db.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:{id:backup.id,email:backup.email,globalRole:"ADMIN",active:true}}));
    expect(mock.db.user.updateMany.mock.calls[0][0].data).not.toHaveProperty("globalRole");
    expect(mock.db.user.upsert).not.toHaveBeenCalled();
    mock.db.user.findUnique.mockResolvedValue(owner);
    mock.db.user.upsert.mockResolvedValue(owner);
    expect(await mock.config.callbacks.signIn({account:{provider:"google"},profile:{sub:"owner-google-sub",email_verified:true},user:{email:owner.email}})).toBe(true);
    expect(mock.db.user.upsert).toHaveBeenLastCalledWith(expect.objectContaining({where:{email:owner.email},update:expect.objectContaining({globalRole:"ADMIN"})}));
  });
  it("does not restore ADMIN when demotion/disablement races an additional admin login", async () => {
    vi.stubEnv("ADDITIONAL_ADMIN_EMAILS","backup@sru.ac.th");
    mock.db.user.findUnique.mockResolvedValue({...owner,id:"backup-user"});
    mock.db.user.updateMany.mockResolvedValue({count:0});
    expect(await mock.config.callbacks.signIn({account:{provider:"google"},profile:{sub:"backup-sub",email_verified:true},user:{email:"backup@sru.ac.th"}})).toBe(false);
    expect(mock.db.user.upsert).not.toHaveBeenCalled();
  });
  it.each([null,{id:"unassigned",globalRole:"TEACHER",active:true},{id:"disabled",globalRole:"ADMIN",active:false}])("configuration alone cannot promote/create an additional administrator: %s", async (assigned) => {
    vi.stubEnv("ADDITIONAL_ADMIN_EMAILS","backup@sru.ac.th");
    mock.db.user.findUnique.mockResolvedValue(assigned);
    mock.db.teacher.findFirst.mockResolvedValue({email:"backup@sru.ac.th"});
    await mock.config.callbacks.signIn({account:{provider:"google"},profile:{sub:"backup-sub",email_verified:true},user:{email:"backup@sru.ac.th"}});
    expect(mock.db.user.upsert).toHaveBeenCalledWith(expect.objectContaining({update:expect.objectContaining({globalRole:"TEACHER"}),create:expect.objectContaining({globalRole:"TEACHER"})}));
  });
  it.each([false,undefined,"true"])("additional designation cannot bypass verified Google identity: %s", async (email_verified) => {
    vi.stubEnv("ADDITIONAL_ADMIN_EMAILS","backup@sru.ac.th");
    expect(await mock.config.callbacks.signIn({account:{provider:"google"},profile:{sub:"backup-sub",email_verified},user:{email:"backup@sru.ac.th"}})).toBe(false);
    expect(mock.db.user.upsert).not.toHaveBeenCalled();
  });
  it("removing a designation invalidates an existing cached ADMIN session immediately", async () => {
    const result=await mock.config.callbacks.jwt({token:{email:"backup@sru.ac.th",appUserId:"backup-user",role:"ADMIN",roles:["ADMIN","TEACHER"],teacherId:"backup-teacher",roleSyncedAt:Date.now()}});
    for(const key of ["appUserId","role","roles","teacherId","roleSyncedAt"]) expect(result).not.toHaveProperty(key);
    expect(mock.db.user.findUnique).not.toHaveBeenCalled();
  });
  it.each([null,{...owner,active:false},{...owner,globalRole:"TEACHER"}])("rechecks additional admins against deletion, disablement and demotion on every auth call: %s", async (current) => {
    vi.stubEnv("ADDITIONAL_ADMIN_EMAILS","backup@sru.ac.th");
    mock.db.user.findUnique.mockResolvedValue(current);
    const result=await mock.config.callbacks.jwt({token:{email:"backup@sru.ac.th",appUserId:"backup-user",role:"ADMIN",roles:["ADMIN"],teacherId:null,roleSyncedAt:Date.now()}}) as Record<string,unknown>;
    expect(mock.db.user.findUnique).toHaveBeenCalled();
    expect(result.role).not.toBe("ADMIN");
    expect(result.roles ?? []).not.toContain("ADMIN");
  });
  it("does not revive an undesignated database ADMIN through an uncached Google session", async () => {
    const result=await mock.config.callbacks.jwt({token:{email:"backup@sru.ac.th"}});
    expect(result).not.toHaveProperty("role");
  });
  it("preserves original owner ID/roles/teacher link through password JWT and session", async () => {
    const user = { id: owner.id, email: owner.email, ownerPasswordVersion: 2 };
    expect(await mock.config.callbacks.signIn({ account: { provider: "owner-password" }, user })).toBe(true);
    const token = await mock.config.callbacks.jwt({ token: { email: owner.email }, user });
    const session = await mock.config.callbacks.session({ session: { user: {} }, token });
    expect(session).toMatchObject({ user: { id: owner.id, email: owner.email, role: "ADMIN", roles: ["ADMIN", "TEACHER"], teacherId: owner.teacher.id, authMethod: "owner-password" } });
    expect(mock.db.user.upsert).not.toHaveBeenCalled();
  });
  it("rechecks every password JWT refresh even with no email and cached ADMIN roles", async () => {
    const token = { appUserId: owner.id, ownerPasswordVersion: 2, role: "ADMIN", roles: ["ADMIN"], roleSyncedAt: Date.now() };
    await mock.config.callbacks.jwt({ token });
    expect(mock.session).toHaveBeenCalledWith(owner.id, 2);
  });
  it("does not let a rollback reinterpret a password JWT as the former email-based Google session", async () => {
    const result = await mock.config.callbacks.jwt({ token: { appUserId: owner.id, email: owner.email, ownerPasswordVersion: 2,
      role: "ADMIN", roles: ["ADMIN"], roleSyncedAt: Date.now() } }) as Record<string, unknown>;
    expect(result.email).toBe(`owner-password:${owner.id}`);
    expect(result.email).not.toBe(owner.email);
    expect(result).not.toHaveProperty("roleSyncedAt");
    expect(result.ownerCanonicalEmail).toBe(owner.email);
  });
  it("keeps the rollback guard when revocation races initial password JWT creation", async () => {
    mock.session.mockResolvedValue(null);
    const result = await mock.config.callbacks.jwt({ token: { email: owner.email, roleSyncedAt: Date.now() },
      user: { id: owner.id, email: owner.email, ownerPasswordVersion: 2 } }) as Record<string, unknown>;
    expect(result.email).toBe(`owner-password:${owner.id}`);
    expect(result).not.toHaveProperty("role");
    expect(result).not.toHaveProperty("appUserId");
    expect(result).not.toHaveProperty("ownerCanonicalEmail");
    expect(result).not.toHaveProperty("roleSyncedAt");
  });
  it("clears every authorization field when credential/session version is revoked", async () => {
    mock.session.mockResolvedValue(null);
    const token = { appUserId: owner.id, ownerPasswordVersion: 2, role: "ADMIN", roles: ["ADMIN"], teacherId: "old-teacher", roleSyncedAt: Date.now() };
    const result = await mock.config.callbacks.jwt({ token });
    for (const key of ["appUserId", "role", "roles", "teacherId", "roleSyncedAt"]) expect(result).not.toHaveProperty(key);
  });
  it("does not let invalid credentials enter through the signIn callback", async () => {
    mock.session.mockResolvedValue(null);
    expect(await mock.config.callbacks.signIn({ account: { provider: "owner-password" }, user: { id: "forged-user", email: "owner@example.test" } })).toBe(false);
  });
  it("keeps original university Google sign-in path and clears password marker on new Google login", async () => {
    expect(await mock.config.callbacks.signIn({ account: { provider: "google" }, profile: { sub: "original-sub", email_verified: true }, user: { email: owner.email } })).toBe(true);
    expect(mock.db.user.upsert).toHaveBeenCalled();
    const result = await mock.config.callbacks.jwt({ token: { ownerPasswordVersion: 2, email: owner.email }, user: { email: owner.email } });
    expect(result).not.toHaveProperty("ownerPasswordVersion");
    expect(result).toMatchObject({ appUserId: owner.id, role: "ADMIN" });
  });
  it("fails closed on storage errors without logging supplied credentials", async () => {
    const provider = mock.config.providers.find((entry) => entry.id === "owner-password" || entry.options?.id === "owner-password")!;
    mock.authenticate.mockRejectedValue(new Error("synthetic sensitive error"));
    const authorize = provider.options?.authorize ?? provider.authorize!;
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await authorize({ email: "synthetic@example.test", password: "synthetic password" })).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it.each(["outsider@gmail.com", "owner@sru.ac.th.evil.test", "owner@student.sru.ac.th.evil.test", "owner@evilsru.ac.th", "owner@evil.test@sru.ac.th"])("keeps Google university-only even for a configured initial-admin outsider: %s", async (email) => {
    vi.stubEnv("INITIAL_ADMIN_EMAIL", email);
    expect(await mock.config.callbacks.signIn({ account: { provider: "google" }, profile: { sub: "external-sub", email_verified: true }, user: { email } })).toBe(false);
    expect(mock.db.user.upsert).not.toHaveBeenCalled();
  });
  it.each([false, undefined, "true"])("rejects unverified university Google identity: %s", async (email_verified) => {
    expect(await mock.config.callbacks.signIn({ account: { provider: "google" }, profile: { sub: "university-sub", email_verified }, user: { email: owner.email } })).toBe(false);
    expect(mock.db.user.upsert).not.toHaveBeenCalled();
  });
});
