import { timingSafeEqual } from "node:crypto";
import type { DevSessionPayload } from "./devSession";
import { multiPilotR2Admin, multiPilotR2Students, multiPilotR2Teachers } from "@/lib/qa/multiPilotR2";

export type QaRole = "admin" | "teacher" | "student";
export type QaTeacherOption = {
  key: string;
  label: string;
  email: string;
  displayName?: string;
  purpose?: string;
};
export type QaStudentOption = {
  key: string;
  label: string;
  email: string;
  studentCode: string;
  firstNameTh: string;
  lastNameTh: string;
  purpose: string;
};
export type QaPrimaryAccount = {
  role: string;
  displayName: string;
  email: string;
  purpose: string;
};
export type QaAdminOption = QaPrimaryAccount & {
  key: string;
  label: string;
};
export type QaPilotProjectRole = {
  project: string;
  student: string;
  advisor: string;
  head: string;
  member: string;
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
  if (role === "admin") return qaPilotAdmin.email;
  if (role === "student") return getQaStudentOptions(env)[0]?.email;
  return getQaTeacherOptions(env)[0]?.email;
}

export function getQaAdminOptions(): QaAdminOption[] {
  return [
    { ...qaPilotAdmin, key: "qa-admin", label: "QA Admin" },
    { ...multiPilotR2Admin, key: "multi-r2-admin", label: "MULTI-PILOT-R2 Admin" }
  ];
}

function splitEmailList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export const qaPilotAdmin: QaPrimaryAccount = {
  role: "Admin",
  displayName: "QA Admin — ผู้ดูแลระบบทดสอบ",
  email: "qa.admin@sru.test",
  purpose: "จัดการรายวิชา เปิดรอบสอบ แต่งตั้งกรรมการ และตรวจหลักฐาน"
};

export const qaPilotStudents: QaStudentOption[] = [
  {
    key: "student-a",
    label: "QA Student A",
    email: "qa.student.a@sru.test",
    studentCode: "QASTUA",
    firstNameTh: "นักศึกษาทดสอบ",
    lastNameTh: "สายปกติ",
    purpose: "Happy-path full workflow"
  },
  {
    key: "student-b",
    label: "QA Student B",
    email: "qa.student.b@sru.test",
    studentCode: "QASTUB",
    firstNameTh: "นักศึกษาทดสอบ",
    lastNameTh: "ส่งล่าช้า",
    purpose: "Delayed proposal/progress scenario"
  },
  {
    key: "student-c",
    label: "QA Student C",
    email: "qa.student.c@sru.test",
    studentCode: "QASTUC",
    firstNameTh: "นักศึกษาทดสอบ",
    lastNameTh: "หลักฐานไม่ครบ",
    purpose: "Missing evidence / incomplete progress scenario"
  },
  {
    key: "student-d",
    label: "QA Student D",
    email: "qa.student.d@sru.test",
    studentCode: "QASTUD",
    firstNameTh: "นักศึกษาทดสอบ",
    lastNameTh: "แก้รายงาน",
    purpose: "Report revision loop"
  },
  {
    key: "student-e",
    label: "QA Student E",
    email: "qa.student.e@sru.test",
    studentCode: "QASTUE",
    firstNameTh: "นักศึกษาทดสอบ",
    lastNameTh: "รอบสอบซ้อน",
    purpose: "Schedule/committee conflict scenario"
  }
];

export const qaPilotTeachers: QaTeacherOption[] = [
  {
    key: "teacher-alpha",
    label: "QA Teacher Alpha",
    email: "qa.teacher.alpha@sru.test",
    displayName: "อาจารย์ทดสอบหลายบทบาท A",
    purpose: "Advisor for Project A/B, Head for Project C, Member for Project D"
  },
  {
    key: "teacher-beta",
    label: "QA Teacher Beta",
    email: "qa.teacher.beta@sru.test",
    displayName: "อาจารย์ทดสอบหลายบทบาท B",
    purpose: "Advisor for Project C, Head for Project A, Member for Project E"
  },
  {
    key: "teacher-gamma",
    label: "QA Teacher Gamma",
    email: "qa.teacher.gamma@sru.test",
    displayName: "อาจารย์ทดสอบหลายบทบาท C",
    purpose: "Advisor for Project E, Head for Project D, Member for Project B"
  },
  {
    key: "teacher-delta",
    label: "QA Teacher Delta",
    email: "qa.teacher.delta@sru.test",
    displayName: "อาจารย์ทดสอบไม่ได้เป็นกรรมการ",
    purpose: "Permission boundary check"
  }
];

export const qaPilotProjectRoles: QaPilotProjectRole[] = [
  {
    project: "MULTI-PILOT-R1 Project A — Happy Path Workflow",
    student: "QA Student A",
    advisor: "QA Teacher Alpha",
    head: "QA Teacher Beta",
    member: "QA Teacher Gamma"
  },
  {
    project: "MULTI-PILOT-R1 Project B — Delayed Submission",
    student: "QA Student B",
    advisor: "QA Teacher Alpha",
    head: "QA Teacher Gamma",
    member: "QA Teacher Beta"
  },
  {
    project: "MULTI-PILOT-R1 Project C — Missing Progress Evidence",
    student: "QA Student C",
    advisor: "QA Teacher Beta",
    head: "QA Teacher Alpha",
    member: "QA Teacher Gamma"
  },
  {
    project: "MULTI-PILOT-R1 Project D — Report Revision Loop",
    student: "QA Student D",
    advisor: "QA Teacher Gamma",
    head: "QA Teacher Alpha",
    member: "QA Teacher Beta"
  },
  {
    project: "MULTI-PILOT-R1 Project E — Schedule Conflict Test",
    student: "QA Student E",
    advisor: "QA Teacher Gamma",
    head: "QA Teacher Beta",
    member: "QA Teacher Alpha"
  }
];

export function getQaTeacherOptions(env: EnvLike = process.env): QaTeacherOption[] {
  const entries: QaTeacherOption[] = [];
  const seen = new Set<string>();
  const add = (key: string, label: string, email: string | undefined, displayName?: string, purpose?: string) => {
    const normalized = email?.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    entries.push({ key, label, email: normalized, displayName, purpose });
  };

  qaPilotTeachers.forEach((teacher) => add(teacher.key, teacher.label, teacher.email, teacher.displayName, teacher.purpose));
  multiPilotR2Teachers.forEach((teacher) => add(teacher.key, teacher.label, teacher.email, `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}`, "MULTI-PILOT-R2 controlled operational simulation"));

  add("legacy-default", "Legacy QA Teacher", readEnv(env, "QA_TEACHER_EMAIL"), undefined, "Legacy single-teacher QA identity");
  add("legacy-advisor", "Legacy QA Advisor", readEnv(env, "QA_TEACHER_ADVISOR_EMAIL") ?? readEnv(env, "QA_TEACHER_EMAIL_1"), undefined, "Legacy advisor identity");
  add("legacy-committee1", "Legacy QA Committee 1", readEnv(env, "QA_TEACHER_COMMITTEE1_EMAIL") ?? readEnv(env, "QA_TEACHER_EMAIL_2"), undefined, "Legacy committee identity");
  add("legacy-committee2", "Legacy QA Committee 2", readEnv(env, "QA_TEACHER_COMMITTEE2_EMAIL") ?? readEnv(env, "QA_TEACHER_EMAIL_3"), undefined, "Legacy committee identity");

  splitEmailList(readEnv(env, "QA_TEACHER_EMAILS")).forEach((email, index) => {
    add(`legacy-extra-${index + 1}`, `Legacy QA Teacher ${index + 1}`, email, undefined, "Legacy extra QA identity");
  });

  return entries;
}

export function getQaStudentOptions(env: EnvLike = process.env): QaStudentOption[] {
  const entries: QaStudentOption[] = [
    ...qaPilotStudents,
    ...multiPilotR2Students.map((student) => ({
      key: student.key,
      label: student.label,
      email: student.email,
      studentCode: student.studentCode,
      firstNameTh: student.firstNameTh,
      lastNameTh: student.lastNameTh,
      purpose: "MULTI-PILOT-R2 controlled operational simulation"
    }))
  ];
  const configured = readEnv(env, "QA_STUDENT_EMAIL")?.toLowerCase();
  if (configured && !entries.some((student) => student.email === configured)) {
    entries.push({
      key: "legacy-student",
      label: "Legacy QA Student",
      email: configured,
      studentCode: "LEGACYQA",
      firstNameTh: "นักศึกษาทดสอบ",
      lastNameTh: "ชุดเดิม",
      purpose: "Legacy single-student pilot identity"
    });
  }
  return entries;
}

export function getQaStudentEmail(selection: FormDataEntryValue | null, env: EnvLike = process.env) {
  const options = getQaStudentOptions(env);
  const keyOrEmail = String(selection ?? "").trim().toLowerCase();
  return options.find((option) => option.key === keyOrEmail || option.email === keyOrEmail)?.email ?? options[0]?.email;
}

export function getQaTeacherEmail(selection: FormDataEntryValue | null, env: EnvLike = process.env) {
  const options = getQaTeacherOptions(env);
  if (!options.length) return undefined;
  const keyOrEmail = String(selection ?? "").trim().toLowerCase();
  return options.find((option) => option.key === keyOrEmail || option.email === keyOrEmail)?.email ?? options[0].email;
}

export function getQaAdminEmail(selection: FormDataEntryValue | null) {
  const options = getQaAdminOptions();
  const keyOrEmail = String(selection ?? "").trim().toLowerCase();
  return options.find((option) => option.key === keyOrEmail || option.email === keyOrEmail)?.email ?? options[0]?.email;
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
