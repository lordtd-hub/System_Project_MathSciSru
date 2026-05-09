import { describe, expect, it } from "vitest";
import { resolveLoginRole } from "./roleResolution";

const identity = (email: string) => ({
  sub: `google-sub-${email}`,
  email,
  name: "Pilot User"
});

describe("pilot Google role resolution", () => {
  it("resolves INITIAL_ADMIN_EMAIL to Admin only by exact configured email", () => {
    const options = {
      initialAdminEmail: " initial.admin@sru.ac.th ",
      importedStudentCodes: new Set<string>(),
      linkedTeacherEmails: new Set<string>()
    };

    expect(resolveLoginRole(identity("initial.admin@sru.ac.th"), options)).toMatchObject({ role: "ADMIN" });
    expect(resolveLoginRole(identity("other.admin@sru.ac.th"), options)).toMatchObject({ role: "PENDING_TEACHER" });
  });

  it("routes non-admin @sru.ac.th users into pending teacher claim flow", () => {
    const result = resolveLoginRole(identity("new.teacher@sru.ac.th"), {
      initialAdminEmail: "initial.admin@sru.ac.th",
      linkedTeacherEmails: new Set<string>()
    });

    expect(result).toMatchObject({ role: "PENDING_TEACHER", emailDomain: "sru.ac.th" });
  });

  it("resolves approved linked teachers to teacher access", () => {
    const result = resolveLoginRole(identity("approved.teacher@sru.ac.th"), {
      initialAdminEmail: "initial.admin@sru.ac.th",
      linkedTeacherEmails: new Set(["approved.teacher@sru.ac.th"])
    });

    expect(result).toMatchObject({ role: "TEACHER" });
  });

  it("keeps initial admin login as ADMIN even when the same account is linked to a teacher profile", () => {
    const result = resolveLoginRole(identity("initial.admin@sru.ac.th"), {
      initialAdminEmail: "initial.admin@sru.ac.th",
      linkedTeacherEmails: new Set(["initial.admin@sru.ac.th"])
    });

    expect(result).toMatchObject({ role: "ADMIN" });
  });

  it("resolves imported student email to that student code", () => {
    const result = resolveLoginRole(identity("65123456789@student.sru.ac.th"), {
      importedStudentCodes: new Set(["65123456789"])
    });

    expect(result).toMatchObject({
      role: "STUDENT",
      studentCode: "65123456789",
      emailDomain: "student.sru.ac.th"
    });
  });

  it("blocks student emails that are not in the imported roster", () => {
    const result = resolveLoginRole(identity("65999999999@student.sru.ac.th"), {
      importedStudentCodes: new Set(["65123456789"])
    });

    expect(result).toMatchObject({ role: "DENIED", emailDomain: "student.sru.ac.th" });
  });
});
