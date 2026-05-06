import type { GlobalRole } from "@prisma/client";

export const DEV_SESSION_COOKIE = "project_assessment_dev_session";

export type DevSessionPayload = {
  userId: string;
  role: GlobalRole;
  email: string;
  name: string;
};

export function isDevLoginEnabled(nodeEnv = process.env.NODE_ENV): boolean {
  return nodeEnv === "development";
}

export function encodeDevSession(payload: DevSessionPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeDevSession(value?: string | null): DevSessionPayload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<DevSessionPayload>;
    if (!parsed.userId || !parsed.email || !parsed.name || !parsed.role) return null;
    return {
      userId: parsed.userId,
      email: parsed.email,
      name: parsed.name,
      role: parsed.role
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
      email: payload.email,
      name: payload.name,
      image: null
    },
    expires: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString()
  };
}
