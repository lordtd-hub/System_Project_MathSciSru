import type { GlobalRole } from "@prisma/client";

export type GoogleIdentity = {
  sub: string;
  email: string;
  name?: string | null;
};

export type RoleResolution =
  | { role: "ADMIN"; emailDomain: string }
  | { role: "STUDENT"; studentCode: string; emailDomain: string }
  | { role: "TEACHER"; emailDomain: string }
  | { role: "PENDING_TEACHER"; emailDomain: string }
  | { role: "DENIED"; reason: string; emailDomain?: string };

export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split("@").at(1) ?? "";
}

export function resolveLoginRole(
  identity: GoogleIdentity,
  options: {
    initialAdminEmail?: string;
    importedStudentCodes?: Set<string>;
    linkedTeacherEmails?: Set<string>;
  } = {}
): RoleResolution {
  const email = identity.email.trim().toLowerCase();
  const domain = emailDomain(email);
  const initialAdminEmail = options.initialAdminEmail?.trim().toLowerCase();

  if (initialAdminEmail && email === initialAdminEmail) {
    return { role: "ADMIN", emailDomain: domain };
  }

  if (domain === "student.sru.ac.th") {
    const studentCode = email.split("@")[0];
    if (options.importedStudentCodes && !options.importedStudentCodes.has(studentCode)) {
      return { role: "DENIED", reason: "ไม่พบรหัสนักศึกษาในข้อมูลนำเข้า", emailDomain: domain };
    }
    return { role: "STUDENT", studentCode, emailDomain: domain };
  }

  if (domain === "sru.ac.th") {
    if (options.linkedTeacherEmails?.has(email)) {
      return { role: "TEACHER", emailDomain: domain };
    }
    return { role: "PENDING_TEACHER", emailDomain: domain };
  }

  return { role: "DENIED", reason: "โดเมนอีเมลไม่ได้รับอนุญาต", emailDomain: domain };
}

export function canAccessRole(userRole: GlobalRole, allowed: GlobalRole[]): boolean {
  return allowed.includes(userRole);
}
