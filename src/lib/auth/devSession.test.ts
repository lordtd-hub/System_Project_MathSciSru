import { describe, expect, it } from "vitest";
import { decodeDevSession, devSessionToAuthSession, encodeDevSession, isDevLoginEnabled } from "./devSession";

describe("development dev session", () => {
  const secret = "test-dev-secret";

  it("enables dev login only in development", () => {
    expect(isDevLoginEnabled("development")).toBe(true);
    expect(isDevLoginEnabled("production")).toBe(false);
    expect(isDevLoginEnabled("test")).toBe(false);
  });

  it("round trips selected student for student dashboard", () => {
    const payload = {
      userId: "student-user-1",
      role: "STUDENT" as const,
      email: "65123456789@student.sru.ac.th",
      name: "สมชาย ใจดี"
    };
    const session = devSessionToAuthSession(decodeDevSession(encodeDevSession(payload, secret), secret)!);

    expect(session.user.role).toBe("STUDENT");
    expect(session.user.email).toBe("65123456789@student.sru.ac.th");
    expect(session.user.name).toBe("สมชาย ใจดี");
  });

  it("round trips approved teacher and does not look like pending teacher", () => {
    const payload = {
      userId: "teacher-user-1",
      role: "TEACHER" as const,
      email: "demo.teacher01@sru.ac.th",
      name: "ผศ.ดร.สิทธิโชค ทรงสอาด"
    };
    const session = devSessionToAuthSession(decodeDevSession(encodeDevSession(payload, secret), secret)!);

    expect(session.user.role).toBe("TEACHER");
    expect(session.user.role).not.toBe("PENDING_TEACHER");
    expect(session.user.email).toBe("demo.teacher01@sru.ac.th");
  });

  it("supports pending teacher claim state for development testing", () => {
    const payload = {
      userId: "pending-teacher-user",
      role: "PENDING_TEACHER" as const,
      email: "dev.pending.teacher@sru.ac.th",
      name: "อาจารย์รออนุมัติ"
    };
    const session = devSessionToAuthSession(decodeDevSession(encodeDevSession(payload, secret), secret)!);

    expect(session.user.role).toBe("PENDING_TEACHER");
  });

  it("rejects unsigned dev session values", () => {
    const unsigned = Buffer.from(JSON.stringify({
      userId: "admin-user",
      role: "ADMIN",
      email: "admin@sru.ac.th",
      name: "Admin"
    }), "utf8").toString("base64url");

    expect(decodeDevSession(unsigned, secret)).toBeNull();
  });

  it("rejects tampered payloads and invalid signatures", () => {
    const payload = {
      userId: "teacher-user-1",
      role: "TEACHER" as const,
      email: "demo.teacher01@sru.ac.th",
      name: "Teacher"
    };
    const signed = encodeDevSession(payload, secret);
    const [encodedPayload, signature] = signed.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ ...payload, role: "ADMIN" }), "utf8").toString("base64url");

    expect(decodeDevSession(`${tamperedPayload}.${signature}`, secret)).toBeNull();
    expect(decodeDevSession(`${encodedPayload}.invalid-signature`, secret)).toBeNull();
  });

  it("keeps production path disabled regardless of signed cookie support", () => {
    expect(isDevLoginEnabled("production")).toBe(false);
    expect(decodeDevSession(encodeDevSession({
      userId: "admin-user",
      role: "ADMIN",
      email: "admin@sru.ac.th",
      name: "Admin"
    }, secret), secret)?.role).toBe("ADMIN");
  });
});
