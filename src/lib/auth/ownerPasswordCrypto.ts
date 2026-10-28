import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export function validOwnerPassword(password: unknown): password is string {
  if (typeof password !== "string") return false;
  const length = Array.from(password).length;
  return length >= 15 && length <= 128 && Buffer.byteLength(password, "utf8") <= 512;
}

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64,
    { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
    (error, key) => error ? reject(error) : resolve(key)));
}

export async function hashOwnerPassword(password: string) {
  if (!validOwnerPassword(password)) throw new Error("Invalid password length");
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt-v1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyOwnerPassword(password: unknown, stored: string | null) {
  if (!validOwnerPassword(password)) return false;
  const parts = stored?.split("$");
  const validHash = parts?.length === 3 && parts[0] === "scrypt-v1" &&
    /^[A-Za-z0-9_-]{22}$/.test(parts[1]) && /^[A-Za-z0-9_-]{86}$/.test(parts[2]);
  const salt = validHash ? Buffer.from(parts[1], "base64url") : Buffer.alloc(16);
  const expected = validHash ? Buffer.from(parts[2], "base64url") : Buffer.alloc(64);
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, expected) && Boolean(validHash);
}

export function validEnrollmentCode(code: unknown): code is string {
  return typeof code === "string" && /^[A-Za-z0-9_-]{43}$/.test(code);
}

export function enrollmentCodeHash(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

// Used only by an explicitly approved operator provisioning command; never log it.
export function createEnrollmentCode() {
  return randomBytes(32).toString("base64url");
}
