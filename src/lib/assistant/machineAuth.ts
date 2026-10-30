import { createHash, timingSafeEqual } from "node:crypto";
import { DEMO_FIXTURE_SET, DEMO_PRINCIPAL_ID, DEMO_READ_SCOPE } from "./demoFixtures";

export const MAX_DEMO_CREDENTIAL_WINDOW_MS = 60 * 60 * 1000;

export type MachineIdentity = Readonly<{
  principalId: string;
  credentialId: string;
  audience: string;
  fixtureSet: string;
  scopes: readonly string[];
  notBeforeEpochMs: number;
  expiresAtEpochMs: number;
}>;

// Server-owned credential metadata. There is no credential issuer or plaintext
// token store here, and no real credential is included in this change.
export type MachineCredentialRecord = Readonly<{
  credentialId: string;
  tokenSha256: string;
  audience: string;
  notBeforeEpochMs: number;
  expiresAtEpochMs: number;
  revoked: boolean;
}>;

export type MachineVerifier = (token: string) => MachineIdentity | null | Promise<MachineIdentity | null>;

export function validMachineCredentialRecord(record: MachineCredentialRecord): boolean {
  return /^[A-Za-z0-9_-]{1,80}$/.test(record.credentialId) &&
    /^[a-fA-F0-9]{64}$/.test(record.tokenSha256) &&
    Boolean(record.audience && record.audience.length <= 256) &&
    Number.isFinite(record.notBeforeEpochMs) && Number.isFinite(record.expiresAtEpochMs) &&
    record.expiresAtEpochMs > record.notBeforeEpochMs &&
    record.expiresAtEpochMs - record.notBeforeEpochMs <= MAX_DEMO_CREDENTIAL_WINDOW_MS;
}

/** Verify an opaque machine token against an explicitly supplied server record. */
export function verifyConfiguredMachineBearer(
  token: string,
  record: MachineCredentialRecord,
  now = Date.now()
): MachineIdentity | null {
  if (!validMachineCredentialRecord(record) || record.revoked || !Number.isFinite(now) ||
    now < record.notBeforeEpochMs || now >= record.expiresAtEpochMs ||
    !/^[A-Za-z0-9_-]{43,256}$/.test(token)) return null;

  const actual = createHash("sha256").update(token, "utf8").digest();
  const expected = Buffer.from(record.tokenSha256, "hex");
  if (!timingSafeEqual(actual, expected)) return null;

  return Object.freeze({
    principalId: DEMO_PRINCIPAL_ID,
    credentialId: record.credentialId,
    audience: record.audience,
    fixtureSet: DEMO_FIXTURE_SET,
    scopes: Object.freeze([DEMO_READ_SCOPE]),
    notBeforeEpochMs: record.notBeforeEpochMs,
    expiresAtEpochMs: record.expiresAtEpochMs
  });
}
