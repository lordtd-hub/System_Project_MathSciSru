import { describe, expect, it } from "vitest";
import { createEnrollmentCode, enrollmentCodeHash, hashOwnerPassword, validEnrollmentCode, validOwnerPassword, verifyOwnerPassword } from "./ownerPasswordCrypto";

describe("owner password cryptography", () => {
  it("requires 15–128 Unicode characters without truncating or normalizing", () => {
    expect(validOwnerPassword("short")).toBe(false);
    expect(validOwnerPassword("x".repeat(15))).toBe(true);
    expect(validOwnerPassword("x".repeat(129))).toBe(false);
    expect(validOwnerPassword("ก".repeat(15))).toBe(true);
    expect(validOwnerPassword(null)).toBe(false);
  });
  it("salts scrypt hashes and rejects wrong passwords/malformed hashes", async () => {
    const phrase = "synthetic long passphrase for test";
    const first = await hashOwnerPassword(phrase);
    const second = await hashOwnerPassword(phrase);
    expect(first).not.toBe(second);
    expect(first).not.toContain(phrase);
    expect(await verifyOwnerPassword(phrase, first)).toBe(true);
    expect(await verifyOwnerPassword("another synthetic test passphrase", first)).toBe(false);
    expect(await verifyOwnerPassword(phrase, "scrypt-v1$bad$bad")).toBe(false);
    expect(await verifyOwnerPassword(phrase, null)).toBe(false);
  }, 10000);
  it("uses a 256-bit one-time code and stores only its digest", () => {
    const code = createEnrollmentCode();
    expect(validEnrollmentCode(code)).toBe(true);
    expect(Buffer.from(code, "base64url").length).toBe(32);
    expect(enrollmentCodeHash(code)).toHaveLength(64);
    expect(enrollmentCodeHash(code)).not.toContain(code);
    expect(validEnrollmentCode("dummy")).toBe(false);
  });
});
