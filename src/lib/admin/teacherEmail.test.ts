import { describe, expect, it } from "vitest";
import { assertNoDuplicateTeacherEmail, normalizeTeacherEmail } from "@/lib/admin/teacherEmail";

describe("admin teacher email management", () => {
  it("normalizes teacher email with trim and lowercase", () => {
    expect(normalizeTeacherEmail("  Sittichoke.Son@SRU.AC.TH  ")).toBe("sittichoke.son@sru.ac.th");
  });

  it("allows empty teacher email", () => {
    expect(normalizeTeacherEmail("   ")).toBeNull();
  });

  it("rejects duplicate teacher email", () => {
    expect(() =>
      assertNoDuplicateTeacherEmail({
        normalizedEmail: "teacher@sru.ac.th",
        duplicateTeacherId: "teacher-2"
      })
    ).toThrow("อีเมลนี้ถูกใช้กับโปรไฟล์อาจารย์คนอื่นแล้ว");
  });

  it("does not reject duplicate checks when email is empty", () => {
    expect(() => assertNoDuplicateTeacherEmail({ normalizedEmail: null, duplicateTeacherId: "teacher-2" })).not.toThrow();
  });
});

