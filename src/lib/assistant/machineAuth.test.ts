import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyConfiguredMachineBearer, type MachineCredentialRecord } from "./machineAuth";

// Public, deterministic fake value. It is never configured in a deployed service.
const fakeToken = "FAKE_UNIT_TEST_ONLY_NEVER_AN_OPERATIONAL_CREDENTIAL";
const clock = Date.parse("2026-10-30T00:01:00Z");
const record: MachineCredentialRecord = {
  credentialId: "fake-unit-reader", audience: "synthetic-unit-audience",
  tokenSha256: createHash("sha256").update(fakeToken).digest("hex"),
  notBeforeEpochMs: clock - 1000, expiresAtEpochMs: clock + 1000, revoked: false
};

describe("opaque machine verifier using public fake test inputs", () => {
  it("checks the hash and returns only the fixed machine read capability", () => {
    const identity = verifyConfiguredMachineBearer(fakeToken, record, clock);
    expect(identity).toMatchObject({ principalId: "nia-demo-reader", credentialId: "fake-unit-reader",
      audience: record.audience, fixtureSet: "nia-demo-v1", scopes: ["demo:projects:read"] });
    expect(JSON.stringify(identity)).not.toContain(fakeToken);
    expect(JSON.stringify(identity)).not.toContain(record.tokenSha256);
    expect(identity).not.toHaveProperty("role");
  });
  it.each(["FAKE_WRONG_UNIT_TEST_ONLY_NEVER_AN_OPERATIONAL_CREDENTIAL", "short", "bad value", "x".repeat(257)])(
    "rejects invalid fake token %s", (token) => expect(verifyConfiguredMachineBearer(token, record, clock)).toBeNull()
  );
  it.each([clock - 1001, clock + 1000, clock + 1001, NaN])("enforces validity boundary %s", (now) => {
    expect(verifyConfiguredMachineBearer(fakeToken, record, now)).toBeNull();
  });
  it.each([
    { revoked: true }, { tokenSha256: "not-a-hash" }, { credentialId: "unsafe\nlog" },
    { audience: "" }, { expiresAtEpochMs: clock - 1001 }, { expiresAtEpochMs: clock + 3_600_000 }
  ])("rejects invalid or revoked record %j", (change) => {
    expect(verifyConfiguredMachineBearer(fakeToken, { ...record, ...change }, clock)).toBeNull();
  });
});
