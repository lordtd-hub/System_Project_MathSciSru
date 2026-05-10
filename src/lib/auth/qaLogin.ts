import { timingSafeEqual } from "node:crypto";
import type { DevSessionPayload } from "./devSession";

export type QaRole = "admin" | "teacher" | "student";
export type QaTeacherOption = {
  key: string;
  label: string;
  email: string;
};

type EnvLike = Record<string, string | undefined>;

function readEnv(env: EnvLike, name: string) {
  const value = env[name]?.trim();
  return value || undefined;
}

export function isQaLoginEnvironmentAllowed(env: EnvLike = process.env) {
  return env.VERCEL_ENV !== "production" || readEnv(env, "QA_LOGIN_ALLOW_PRODUCTION") === "1";
}

export function isQaLoginEnabled(env: EnvLike = process.env) {
  return readEnv(env, "ENABLE_QA_LOGIN") === "1" && isQaLoginEnvironmentAllowed(env);
}

export function hasQaLoginSecret(env: EnvLike = process.env) {
  return Boolean(readEnv(env, "QA_LOGIN_SECRET"));
}

export function verifyQaLoginSecret(submittedSecret: string, env: EnvLike = process.env) {
  const expectedSecret = readEnv(env, "QA_LOGIN_SECRET");
  if (!expectedSecret) return false;

  const submitted = submittedSecret.trim();
  const actual = Buffer.from(submitted);
  const expected = Buffer.from(expectedSecret);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function parseQaRole(value: FormDataEntryValue | null): QaRole | null {
  if (value === "admin" || value === "teacher" || value === "student") return value;
  return null;
}

export function getQaRoleEmail(role: QaRole, env: EnvLike = process.env) {
  const envName = role === "admin" ? "QA_ADMIN_EMAIL" : role === "teacher" ? "QA_TEACHER_EMAIL" : "QA_STUDENT_EMAIL";
  return readEnv(env, envName)?.toLowerCase();
}

function splitEmailList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getQaTeacherOptions(env: EnvLike = process.env): QaTeacherOption[] {
  const entries: QaTeacherOption[] = [];
  const seen = new Set<string>();
  const add = (key: string, label: string, email: string | undefined) => {
    const normalized = email?.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    entries.push({ key, label, email: normalized });
  };

  add("default", "QA Teacher", readEnv(env, "QA_TEACHER_EMAIL"));
  add("advisor", "QA Advisor", readEnv(env, "QA_TEACHER_ADVISOR_EMAIL") ?? readEnv(env, "QA_TEACHER_EMAIL_1"));
  add("committee1", "QA Committee 1", readEnv(env, "QA_TEACHER_COMMITTEE1_EMAIL") ?? readEnv(env, "QA_TEACHER_EMAIL_2"));
  add("committee2", "QA Committee 2", readEnv(env, "QA_TEACHER_COMMITTEE2_EMAIL") ?? readEnv(env, "QA_TEACHER_EMAIL_3"));

  splitEmailList(readEnv(env, "QA_TEACHER_EMAILS")).forEach((email, index) => {
    add(`extra-${index + 1}`, `QA Teacher ${index + 1}`, email);
  });

  return entries;
}

export function getQaTeacherEmail(selection: FormDataEntryValue | null, env: EnvLike = process.env) {
  const options = getQaTeacherOptions(env);
  if (!options.length) return undefined;
  const keyOrEmail = String(selection ?? "").trim().toLowerCase();
  return options.find((option) => option.key === keyOrEmail || option.email === keyOrEmail)?.email ?? options[0].email;
}

export function getQaRoleDashboardPath(role: QaRole) {
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/teacher";
  return "/student";
}

export function buildQaSessionPayload(input: {
  role: QaRole;
  userId: string;
  email: string;
  name: string;
  teacherId?: string | null;
}): DevSessionPayload {
  if (input.role === "admin") {
    return {
      userId: input.userId,
      role: "ADMIN",
      roles: input.teacherId ? ["ADMIN", "TEACHER"] : ["ADMIN"],
      teacherId: input.teacherId ?? null,
      email: input.email,
      name: input.name
    };
  }
  if (input.role === "teacher") {
    return {
      userId: input.userId,
      role: "TEACHER",
      roles: ["TEACHER"],
      teacherId: input.teacherId ?? null,
      email: input.email,
      name: input.name
    };
  }
  return {
    userId: input.userId,
    role: "STUDENT",
    roles: ["STUDENT"],
    teacherId: null,
    email: input.email,
    name: input.name
  };
}
