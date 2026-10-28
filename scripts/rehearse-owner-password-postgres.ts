import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

// Local synthetic rehearsal only: creates its own disposable container and URL.
// It never accepts a database URL, real user ID, credential or host from input.
async function main() {
  const context = execFileSync("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"], { encoding: "utf8" }).trim();
  if (!context.startsWith("npipe:////./pipe/dockerDesktopLinuxEngine") && !context.startsWith("unix://"))
    throw new Error("Local Docker engine required");
  const runId = randomUUID();
  const name = `codex-owner-password-test-${runId}`;
  const password = randomBytes(32).toString("base64url");
  const container = execFileSync("docker", ["run", "--detach", "--pull", "never", "--name", name,
    "--label", `codex.owner-password-rehearsal=${runId}`, "--env", "POSTGRES_PASSWORD", "--env", "POSTGRES_DB=owner_password_rehearsal",
    "--publish", "127.0.0.1::5432", "--tmpfs", "/var/lib/postgresql/data:rw,noexec,nosuid", "postgres:16"],
  { encoding: "utf8", env: { ...process.env, POSTGRES_PASSWORD: password }, windowsHide: true }).trim();
  if (!/^[a-f0-9]{64}$/.test(container)) throw new Error("Unexpected disposable container identity");
  let disconnect: (() => Promise<void>) | undefined;
  let stage = "container startup";
  try {
    const published = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8", windowsHide: true }).trim();
    const match = published.match(/^127\.0\.0\.1:(\d+)$/);
    if (!match) throw new Error("Loopback-only binding required");
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        execFileSync("docker", ["exec", container, "pg_isready", "-U", "postgres", "-d", "owner_password_rehearsal"], { stdio: "pipe", windowsHide: true });
        ready = true; break;
      } catch { await delay(500); }
    }
    if (!ready) throw new Error("Disposable PostgreSQL did not become ready");
    const url = `postgresql://postgres:${password}@127.0.0.1:${match[1]}/owner_password_rehearsal?schema=public&connection_limit=5`;
    process.env.DATABASE_URL = url;
    process.env.DIRECT_URL = url;
    process.env.ENABLE_OWNER_PASSWORD_LOGIN = "1";
    const ownerId = `synthetic-owner-${runId}`;
    process.env.OWNER_PASSWORD_USER_ID = ownerId;
    console.log("PASS: own disposable PostgreSQL16, tmpfs data, localhost-only random port, no host mounts.");

    stage = "complete migration history";
    execFileSync("docker", ["exec", container, "psql", "-U", "postgres", "-d", "owner_password_rehearsal", "-v", "ON_ERROR_STOP=1", "-c",
      "CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;"], { stdio: "pipe", windowsHide: true });
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: process.env, stdio: "pipe", windowsHide: true });
    const { prisma } = await import("../src/lib/db");
    disconnect = () => prisma.$disconnect();
    const service = await import("../src/lib/auth/ownerPassword");
    const provisioning = await import("../src/lib/auth/ownerPasswordProvision");
    const migrations = await prisma.$queryRaw<Array<{ migration_name: string }>>`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    check(migrations.some((entry) => entry.migration_name === "20261028190000_owner_password_credential"), "new migration was recorded");
    const rowSecurity = await prisma.$queryRaw<Array<{ relrowsecurity: boolean }>>`SELECT relrowsecurity FROM pg_class WHERE relname = 'owner_password_credentials'`;
    check(rowSecurity[0]?.relrowsecurity === true, "RLS enabled");
    console.log(`PASS: full migration chain applied and recorded (${migrations.length} migrations); new table RLS enabled.`);

    stage = "synthetic existing-owner setup";
    const originalEmail = "original-owner@sru.ac.th";
    const loginEmail = "owner-fixture@example.test";
    await prisma.user.create({ data: { id: ownerId, email: originalEmail, googleSub: `synthetic-google-${runId}`, name: "Synthetic Owner", globalRole: "ADMIN", active: true } });
    const teacher = await prisma.teacher.create({ data: { userId: ownerId, email: originalEmail, academicPrefix: "Dr.", firstNameTh: "Synthetic", lastNameTh: "Owner", department: "Mathematics", active: true } });
    const ownerBefore = await prisma.user.findUniqueOrThrow({ where: { id: ownerId }, select: { id: true, email: true, googleSub: true, globalRole: true, active: true, teacher: { select: { id: true } } } });
    const provisionInput = { userId: ownerId, expectedEmail: originalEmail, loginEmail, verificationReference: `SYNTHETIC-LOCAL-${runId}`, replaceExisting: false };
    let enrollment: string | undefined;
    await provisioning.provisionOwnerPassword(provisionInput, async (code) => { enrollment = code; });
    check(Boolean(enrollment), "synthetic setup code privately captured in memory");
    const code = enrollment!;
    await Promise.all(Array.from({ length: 12 }, () => service.authenticateOwnerPassword(loginEmail, code)));
    check((await prisma.ownerPasswordCredential.findUniqueOrThrow({ where: { userId: ownerId } })).attempts === 0, "pending enrollment cannot be locked through login");
    const firstPassword = "synthetic first owner password for rehearsal";
    const otherPassword = "synthetic other owner password for rehearsal";
    const consumed = await Promise.all([service.enrollOwnerPassword(code, firstPassword), service.enrollOwnerPassword(code, otherPassword)]);
    check(consumed.filter(Boolean).length === 1, "exactly one concurrent enrollment consumes the code");
    let currentPassword = consumed[0] ? firstPassword : otherPassword;
    check(!await service.enrollOwnerPassword(code, firstPassword), "consumed code replay denied");
    console.log("PASS: existing-owner provisioning, pending-login quota protection, concurrent single-use enrollment and replay rejection.");

    stage = "browser-role RLS/privilege checks";
    for (const role of ["anon", "authenticated"] as const) {
      let denied = false;
      try {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
          await tx.$queryRawUnsafe("SELECT user_id FROM owner_password_credentials");
        });
      } catch { denied = true; }
      check(denied, `${role} has no credential-table SELECT privilege`);
      // Rehearse defense-in-depth against accidental SELECT grants, in THIS
      // disposable database only: RLS must still return zero secret rows.
      await prisma.$executeRawUnsafe(`GRANT SELECT ON owner_password_credentials TO ${role}`);
      const counts = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
        return tx.$queryRawUnsafe<Array<{ count: bigint }>>("SELECT count(*) FROM owner_password_credentials");
      });
      check(counts[0].count === BigInt(0), `${role} sees zero rows even with accidental SELECT grant`);
      await prisma.$executeRawUnsafe(`REVOKE ALL ON owner_password_credentials FROM ${role}`);
    }
    console.log("PASS: anon/authenticated privileges revoked; RLS still hides all credential rows after temporary local SELECT grants.");

    const resetQuota = () => prisma.ownerPasswordCredential.update({ where: { userId: ownerId }, data: { attempts: 0, attemptWindowStart: new Date() } });
    stage = "atomic PostgreSQL quota under concurrency";
    await resetQuota();
    const reserved = await Promise.all(Array.from({ length: 32 }, () => service.reserveOwnerPasswordAttempt(ownerId)));
    check(reserved.filter(Boolean).length === 8, "exactly eight reservations across 32 concurrent DB requests");
    check((await prisma.ownerPasswordCredential.findUniqueOrThrow({ where: { userId: ownerId } })).attempts === 8, "quota persisted in PostgreSQL");
    check(await service.authenticateOwnerPassword(loginEmail, currentPassword) === null, "full quota denies further login");
    console.log("PASS: 32 concurrent PostgreSQL requests reserved exactly8 slots; persisted quota blocked further hashing/login.");

    stage = "login/password changes/session invalidation";
    await resetQuota();
    const login = await service.authenticateOwnerPassword(` ${loginEmail.toUpperCase()} `, currentPassword);
    check(login?.id === ownerId && login.email === originalEmail, "login returns existing canonical owner");
    const version = login!.ownerPasswordVersion;
    check((await service.getOwnerPasswordSession(ownerId, version))?.teacher?.id === teacher.id, "same teacher role link");
    check(!await service.changeOwnerPassword(ownerId, "synthetic wrong current password", otherPassword), "wrong current password denied");
    const changeA = "synthetic changed owner password A for rehearsal";
    const changeB = "synthetic changed owner password B for rehearsal";
    const changed = await Promise.all([service.changeOwnerPassword(ownerId, currentPassword, changeA), service.changeOwnerPassword(ownerId, currentPassword, changeB)]);
    check(changed.filter(Boolean).length === 1, "exactly one concurrent current-password change wins CAS");
    const previousPassword = currentPassword;
    currentPassword = changed[0] ? changeA : changeB;
    check(await service.getOwnerPasswordSession(ownerId, version) === null, "old credential-version session revoked");
    await resetQuota();
    check(await service.authenticateOwnerPassword(loginEmail, previousPassword) === null, "previous password denied");
    const changedLogin = await service.authenticateOwnerPassword(loginEmail, currentPassword);
    check(changedLogin?.id === ownerId && changedLogin.ownerPasswordVersion === version + 1, "new password and single version increment");
    const ownerAfter = await prisma.user.findUniqueOrThrow({ where: { id: ownerId }, select: { id: true, email: true, googleSub: true, globalRole: true, active: true, teacher: { select: { id: true } } } });
    check(JSON.stringify(ownerAfter) === JSON.stringify(ownerBefore), "canonical identity/role/Google identifier/teacher link unchanged");
    console.log("PASS: canonical owner login, current-password check, concurrent change CAS, old-session/password invalidation and preserved original identity/teacher link.");

    stage = "exact owner-state and operator guards";
    for (const state of [{ globalRole: "TEACHER" as const, active: true }, { globalRole: "ADMIN" as const, active: false }]) {
      await prisma.user.update({ where: { id: ownerId }, data: state });
      check(await service.getOwnerPasswordSession(ownerId, changedLogin!.ownerPasswordVersion) === null, "demoted/inactive owner denied");
      check(await service.authenticateOwnerPassword(loginEmail, currentPassword) === null, "demoted/inactive login denied");
    }
    await prisma.user.update({ where: { id: ownerId }, data: { globalRole: "ADMIN", active: true } });
    let wrongTargetDenied = false;
    try { await provisioning.provisionOwnerPassword({ ...provisionInput, userId: "wrong-synthetic-owner" }, async () => { throw new Error("must not deliver"); }); }
    catch { wrongTargetDenied = true; }
    check(wrongTargetDenied, "wrong configured owner provisioning denied");
    const collision = await prisma.user.create({ data: { email: loginEmail.toUpperCase(), globalRole: "STUDENT" } });
    let collisionDenied = false;
    try { await provisioning.provisionOwnerPassword({ ...provisionInput, replaceExisting: true }, async () => { throw new Error("must not deliver"); }); }
    catch { collisionDenied = true; }
    check(collisionDenied, "case-insensitive existing personal-user collision denied");
    await prisma.user.delete({ where: { id: collision.id } });
    console.log("PASS: wrong target, demoted/disabled owner and existing mixed-case personal-user collision denied.");

    stage = "expiry, replacement, rollback and revocation";
    await provisioning.provisionOwnerPassword({ ...provisionInput, replaceExisting: true }, async (replacement) => { enrollment = replacement; });
    await prisma.ownerPasswordCredential.update({ where: { userId: ownerId }, data: { enrollmentExpiresAt: new Date(Date.now() - 1000) } });
    check(!await service.enrollOwnerPassword(enrollment!, currentPassword), "expired enrollment denied");
    check(await service.getOwnerPasswordSession(ownerId, changedLogin!.ownerPasswordVersion) === null, "replacement invalidated previous sessions");
    await provisioning.revokeOwnerPassword(ownerId, provisionInput.verificationReference);
    const revoked = await prisma.ownerPasswordCredential.findUniqueOrThrow({ where: { userId: ownerId } });
    check(!revoked.enabled && revoked.passwordHash === null && revoked.enrollmentTokenHash === null && revoked.revokedAt !== null, "operator revoke clears credential and enrollment");
    check(await service.getOwnerPasswordSession(ownerId, revoked.credentialVersion - 1) === null, "revoked session denied");
    process.env.ENABLE_OWNER_PASSWORD_LOGIN = "0";
    check(await service.authenticateOwnerPassword(loginEmail, currentPassword) === null, "global disable fail closed");
    const audit = await prisma.auditLog.count({ where: { entityId: ownerId, action: { in: ["OWNER_PASSWORD_ENROLLMENT_ISSUED", "OWNER_PASSWORD_ENROLLED", "OWNER_PASSWORD_SIGN_IN", "OWNER_PASSWORD_CHANGED", "OWNER_PASSWORD_REVOKED"] } } });
    check(audit >= 7, "auth audit evidence retained");
    console.log("PASS: actual expiry/replacement/revocation, disabled feature and authentication audit evidence.");
    console.log("PASS: disposable PostgreSQL migration/concurrency/security rehearsal complete; synthetic fixtures only.");
  } catch (error) {
    const detail = error as { code?: string; message?: string };
    console.error(`FAIL at ${stage}: ${String(detail.code ?? detail.message ?? "unknown").replaceAll(password, "<redacted synthetic password>")}`);
    throw new Error("Disposable PostgreSQL rehearsal failed");
  } finally {
    try {
      if (disconnect) await disconnect();
    } catch { console.error("FAIL: disposable DB disconnect; continuing verified container cleanup."); process.exitCode = 1; }
    try {
      const label = execFileSync("docker", ["inspect", "--format", '{{index .Config.Labels "codex.owner-password-rehearsal"}}', container], { encoding: "utf8", windowsHide: true }).trim();
      if (label === runId) {
        execFileSync("docker", ["rm", "--force", "--volumes", container], { stdio: "pipe", windowsHide: true });
        console.log("PASS: removed only the label-verified disposable test container and its ephemeral data.");
      } else {
        console.error(`FAIL: refusing cleanup of unverified container ${container}.`);
        process.exitCode = 1;
      }
    } catch { console.error(`FAIL: owner attention needed for disposable container cleanup ${container}.`); process.exitCode = 1; }
  }
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch(() => { console.error("Local PostgreSQL rehearsal failed; no production connection or credential was used."); process.exitCode = 1; });
