import type { GlobalRole } from "@prisma/client";
import { createHmac, timingSafeEqual } from "node:crypto";

export const DEV_SESSION_COOKIE = "project_assessment_dev_session";

export type DevSessionPayload = {
  userId: string;
  role: GlobalRole;
  roles?: GlobalRole[];
  teacherId?: string | null;
  email: string;
  name: string;
};

export function isDevLoginEnabled(nodeEnv = process.env.NODE_ENV): boolean {
  return nodeEnv === "development";
}

export function getDevSessionCookieOptions(nodeEnv = process.env.NODE_ENV) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: nodeEnv === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  };
}

function getDevSessionSecret(secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET) {
  return secret?.trim() || "dev-session-local-fallback-secret";
}

function signPayload(payload: string, secret?: string) {
  return createHmac("sha256", getDevSessionSecret(secret)).update(payload).digest("base64url");
}

function signaturesMatch(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual, "base64url");
  const expectedBuffer = Buffer.from(expected, "base64url");
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function encodeDevSession(payload: DevSessionPayload, secret?: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${signPayload(encodedPayload, secret)}`;
}

export function decodeDevSession(value?: string | null, secret?: string): DevSessionPayload | null {
  if (!value) return null;
  try {
    const [encodedPayload, signature] = value.split(".");
    if (!encodedPayload || !signature) return null;
    if (!signaturesMatch(signature, signPayload(encodedPayload, secret))) return null;

    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<DevSessionPayload>;
    if (!parsed.userId || !parsed.email || !parsed.name || !parsed.role) return null;
    return {
      userId: parsed.userId,
      email: parsed.email,
      name: parsed.name,
      role: parsed.role,
      roles: Array.isArray(parsed.roles) ? parsed.roles.filter((role): role is GlobalRole => typeof role === "string") : undefined,
      teacherId: typeof parsed.teacherId === "string" ? parsed.teacherId : null
    };
  } catch {
    return null;
  }
}

export function devSessionToAuthSession(payload: DevSessionPayload) {
  return {
    user: {
      id: payload.userId,
      role: payload.role,
      roles: payload.roles ?? [payload.role],
      teacherId: payload.teacherId ?? null,
      email: payload.email,
      name: payload.name,
      image: null
    },
    expires: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString()
  };
}
