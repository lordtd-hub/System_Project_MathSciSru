import { describe, expect, it } from "vitest";
import {
  buildQaSessionPayload,
  getQaAdminEmail,
  getQaAdminOptions,
  getQaRoleDashboardPath,
  getQaRoleEmail,
  getQaStudentOptions,
  getQaTeacherEmail,
  getQaTeacherOptions,
  hasQaLoginSecret,
  isQaLoginEnabled,
  isQaLoginEnvironmentAllowed,
  parseQaRole,
  verifyQaLoginSecret
} from "./qaLogin";
import { multiPilotR2Students, multiPilotR2Teachers } from "@/lib/qa/multiPilotR2";

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

    expect(getQaRoleEmail("admin", env)).toBe("manual.demo.admin@sru.test");
    expect(getQaRoleEmail("teacher", env)).toBe("manual.demo.teacher01@sru.test");
    expect(getQaRoleEmail("student", env)).toBe("manual.demo.student01@sru.test");
    expect(getQaRoleDashboardPath("admin")).toBe("/admin");
    expect(getQaRoleDashboardPath("teacher")).toBe("/teacher");
    expect(getQaRoleDashboardPath("student")).toBe("/student");
  });

  it("defaults to manual-guide identities only", () => {
    expect(getQaAdminOptions().map((option) => option.email)).toEqual(["manual.demo.admin@sru.test"]);
    expect(getQaStudentOptions().map((option) => option.email)).toEqual([
      "manual.demo.student01@sru.test",
      "manual.demo.student02@sru.test",
      "manual.demo.student03@sru.test"
    ]);
    expect(getQaTeacherOptions().map((option) => option.email)).toHaveLength(11);
    expect(getQaTeacherOptions().every((option) => option.email.startsWith("manual.demo.teacher"))).toBe(true);
  });

  it("keeps legacy pilot identities behind an explicit flag", () => {
    const env = { QA_LOGIN_SHOW_LEGACY_IDENTITIES: "1" };

    expect(getQaAdminOptions(env).map((option) => option.email)).toContain("multi.pilot.r2.admin@sru.test");
    expect(getQaAdminEmail("multi-r2-admin", env)).toBe("multi.pilot.r2.admin@sru.test");
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

    const emails = getQaTeacherOptions({ ...env, QA_LOGIN_SHOW_LEGACY_IDENTITIES: "1" }).map((option) => option.email);
    expect(emails.slice(0, 11).every((email) => email.startsWith("manual.demo.teacher"))).toBe(true);
    expect(emails.slice(11, 15)).toEqual([
      "qa.teacher.alpha@sru.test",
      "qa.teacher.beta@sru.test",
      "qa.teacher.gamma@sru.test",
      "qa.teacher.delta@sru.test"
    ]);
    expect(emails).toEqual(expect.arrayContaining(multiPilotR2Teachers.map((teacher) => teacher.email)));
    expect(emails.slice(-5)).toEqual([
      "qa.teacher@sru.ac.th",
      "qa.advisor@sru.ac.th",
      "qa.committee1@sru.ac.th",
      "qa.committee2@sru.ac.th",
      "qa.extra@sru.ac.th"
    ]);
    expect(getQaTeacherEmail("teacher-beta", { ...env, QA_LOGIN_SHOW_LEGACY_IDENTITIES: "1" })).toBe("qa.teacher.beta@sru.test");
    expect(getQaTeacherEmail("multi-r2-teacher-11", { ...env, QA_LOGIN_SHOW_LEGACY_IDENTITIES: "1" })).toBe("multi.pilot.r2.teacher11@sru.test");
    expect(getQaTeacherEmail(null, env)).toBe("manual.demo.teacher01@sru.test");
  });

  it("uses designed QA teacher identities even when only one legacy teacher email is configured", () => {
    const env = {
      ENABLE_QA_LOGIN: "1",
      VERCEL_ENV: "preview",
      QA_TEACHER_EMAIL: "qa.teacher@sru.ac.th"
    };

    const emails = getQaTeacherOptions({ ...env, QA_LOGIN_SHOW_LEGACY_IDENTITIES: "1" }).map((option) => option.email);
    expect(emails.slice(0, 11).every((email) => email.startsWith("manual.demo.teacher"))).toBe(true);
    expect(emails.slice(11, 15)).toEqual([
      "qa.teacher.alpha@sru.test",
      "qa.teacher.beta@sru.test",
      "qa.teacher.gamma@sru.test",
      "qa.teacher.delta@sru.test"
    ]);
    expect(emails).toEqual(expect.arrayContaining(multiPilotR2Teachers.map((teacher) => teacher.email)));
    expect(emails.at(-1)).toBe("qa.teacher@sru.ac.th");
    expect(getQaTeacherEmail("teacher-gamma", { ...env, QA_LOGIN_SHOW_LEGACY_IDENTITIES: "1" })).toBe("qa.teacher.gamma@sru.test");
  });

  it("keeps designed QA teacher identities hidden when legacy flag is disabled", () => {
    const emails = getQaTeacherOptions({ QA_TEACHER_EMAIL: "qa.teacher@sru.ac.th" }).map((option) => option.email);
    expect(emails).toHaveLength(11);
    expect(emails.every((email) => email.startsWith("manual.demo.teacher"))).toBe(true);
  });

  it("hides old students by default and exposes them only with legacy flag", () => {
    const students = getQaStudentOptions({ QA_STUDENT_EMAIL: "9999999999@student.sru.ac.th" });

    expect(students.map((student) => student.email)).toEqual([
      "manual.demo.student01@sru.test",
      "manual.demo.student02@sru.test",
      "manual.demo.student03@sru.test"
    ]);

    const legacyStudents = getQaStudentOptions({ QA_STUDENT_EMAIL: "9999999999@student.sru.ac.th", QA_LOGIN_SHOW_LEGACY_IDENTITIES: "1" });
    expect(legacyStudents.slice(3, 8).map((student) => student.email)).toEqual([
      "qa.student.a@sru.test",
      "qa.student.b@sru.test",
      "qa.student.c@sru.test",
      "qa.student.d@sru.test",
      "qa.student.e@sru.test"
    ]);
    expect(legacyStudents.map((student) => student.email)).toEqual(expect.arrayContaining(multiPilotR2Students.map((student) => student.email)));
    expect(legacyStudents.at(-1)?.email).toBe("9999999999@student.sru.ac.th");
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
