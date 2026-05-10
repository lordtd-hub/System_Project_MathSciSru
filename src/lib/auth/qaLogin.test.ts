import { describe, expect, it } from "vitest";
import {
  buildQaSessionPayload,
  getQaRoleDashboardPath,
  getQaRoleEmail,
  getQaTeacherEmail,
  getQaTeacherOptions,
  hasQaLoginSecret,
  isQaLoginEnabled,
  isQaLoginEnvironmentAllowed,
  parseQaRole,
  verifyQaLoginSecret
} from "./qaLogin";

describe("QA login gate", () => {
  it("is disabled by default", () => {
    expect(isQaLoginEnabled({})).toBe(false);
  });

  it("is enabled for preview when explicitly flagged", () => {
    expect(isQaLoginEnabled({ ENABLE_QA_LOGIN: "1", VERCEL_ENV: "preview" })).toBe(true);
  });

  it("is disabled in production without explicit override", () => {
    expect(isQaLoginEnvironmentAllowed({ VERCEL_ENV: "production" })).toBe(false);
    expect(isQaLoginEnabled({ ENABLE_QA_LOGIN: "1", VERCEL_ENV: "production" })).toBe(false);
  });

  it("allows production only with deliberate override flag", () => {
    expect(isQaLoginEnabled({
      ENABLE_QA_LOGIN: "1",
      VERCEL_ENV: "production",
      QA_LOGIN_ALLOW_PRODUCTION: "1"
    })).toBe(true);
  });

  it("requires and verifies the QA login secret", () => {
    expect(hasQaLoginSecret({})).toBe(false);
    expect(hasQaLoginSecret({ QA_LOGIN_SECRET: "secret" })).toBe(true);
    expect(verifyQaLoginSecret("wrong", { QA_LOGIN_SECRET: "secret" })).toBe(false);
    expect(verifyQaLoginSecret("secret", { QA_LOGIN_SECRET: "secret" })).toBe(true);
  });

  it("maps QA roles to configured emails and dashboards", () => {
    const env = {
      QA_ADMIN_EMAIL: "qa.admin@sru.ac.th",
      QA_TEACHER_EMAIL: "qa.teacher@sru.ac.th",
      QA_STUDENT_EMAIL: "9999999999@student.sru.ac.th"
    };

    expect(getQaRoleEmail("admin", env)).toBe("qa.admin@sru.ac.th");
    expect(getQaRoleEmail("teacher", env)).toBe("qa.teacher@sru.ac.th");
    expect(getQaRoleEmail("student", env)).toBe("9999999999@student.sru.ac.th");
    expect(getQaRoleDashboardPath("admin")).toBe("/admin");
    expect(getQaRoleDashboardPath("teacher")).toBe("/teacher");
    expect(getQaRoleDashboardPath("student")).toBe("/student");
  });

  it("rejects unknown role values", () => {
    expect(parseQaRole("admin")).toBe("admin");
    expect(parseQaRole("teacher")).toBe("teacher");
    expect(parseQaRole("student")).toBe("student");
    expect(parseQaRole("owner")).toBeNull();
    expect(parseQaRole(null)).toBeNull();
  });

  it("supports multiple QA teacher identities for committee testing", () => {
    const env = {
      QA_TEACHER_EMAIL: "qa.teacher@sru.ac.th",
      QA_TEACHER_ADVISOR_EMAIL: "qa.advisor@sru.ac.th",
      QA_TEACHER_COMMITTEE1_EMAIL: "qa.committee1@sru.ac.th",
      QA_TEACHER_COMMITTEE2_EMAIL: "qa.committee2@sru.ac.th",
      QA_TEACHER_EMAILS: "qa.extra@sru.ac.th"
    };

    expect(getQaTeacherOptions(env).map((option) => option.email)).toEqual([
      "qa.teacher@sru.ac.th",
      "qa.advisor@sru.ac.th",
      "qa.committee1@sru.ac.th",
      "qa.committee2@sru.ac.th",
      "qa.extra@sru.ac.th"
    ]);
    expect(getQaTeacherEmail("committee1", env)).toBe("qa.committee1@sru.ac.th");
    expect(getQaTeacherEmail(null, env)).toBe("qa.teacher@sru.ac.th");
  });

  it("adds synthetic QA teacher identities in enabled preview when only one teacher email is configured", () => {
    const env = {
      ENABLE_QA_LOGIN: "1",
      VERCEL_ENV: "preview",
      QA_TEACHER_EMAIL: "qa.teacher@sru.ac.th"
    };

    expect(getQaTeacherOptions(env).map((option) => option.email)).toEqual([
      "qa.teacher@sru.ac.th",
      "qa.advisor@sru.ac.th",
      "qa.committee1@sru.ac.th",
      "qa.committee2@sru.ac.th"
    ]);
    expect(getQaTeacherEmail("synthetic-committee1", env)).toBe("qa.committee1@sru.ac.th");
  });

  it("does not add synthetic teacher identities when QA login is disabled", () => {
    expect(getQaTeacherOptions({ QA_TEACHER_EMAIL: "qa.teacher@sru.ac.th" }).map((option) => option.email)).toEqual([
      "qa.teacher@sru.ac.th"
    ]);
  });
});

describe("QA session payloads", () => {
  it("builds an admin payload with optional teacher capability", () => {
    expect(buildQaSessionPayload({
      role: "admin",
      userId: "user-1",
      email: "qa.admin@sru.ac.th",
      name: "QA Admin",
      teacherId: "teacher-1"
    })).toMatchObject({
      role: "ADMIN",
      roles: ["ADMIN", "TEACHER"],
      teacherId: "teacher-1"
    });
  });

  it("builds a teacher payload", () => {
    expect(buildQaSessionPayload({
      role: "teacher",
      userId: "user-2",
      email: "qa.teacher@sru.ac.th",
      name: "QA Teacher",
      teacherId: "teacher-2"
    })).toMatchObject({
      role: "TEACHER",
      roles: ["TEACHER"],
      teacherId: "teacher-2"
    });
  });

  it("builds a student payload without teacher capability", () => {
    expect(buildQaSessionPayload({
      role: "student",
      userId: "user-3",
      email: "9999999999@student.sru.ac.th",
      name: "QA Student"
    })).toMatchObject({
      role: "STUDENT",
      roles: ["STUDENT"],
      teacherId: null
    });
  });
});
