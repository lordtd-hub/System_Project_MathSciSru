import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("admin teacher email management source", () => {
  it("renders teacher emails with an admin-only inline edit form", () => {
    const page = read("src/app/admin/teachers/page.tsx");
    expect(page).toContain("auth()");
    expect(page).toContain('session?.user.role !== "ADMIN"');
    expect(page).toContain("updateTeacherEmail");
    expect(page).toContain('name="email"');
    expect(page).toContain("บันทึกอีเมล");
    expect(page).toContain("ออกจากระบบแล้วเข้าสู่ระบบใหม่");
  });

  it("keeps teacher email update admin-only and duplicate-safe", () => {
    const actions = read("src/app/admin/actions.ts");
    const emailActionStart = actions.indexOf("export async function updateTeacherEmail");
    const closeRoundStart = actions.indexOf("export async function closeProposalRound");
    const emailAction = actions.slice(emailActionStart, closeRoundStart);

    expect(emailAction).toContain("export async function updateTeacherEmail");
    expect(emailAction).toContain("requireAdminUserId()");
    expect(emailAction).toContain("normalizeTeacherEmail");
    expect(emailAction).toContain('mode: "insensitive"');
    expect(emailAction).toContain("assertNoDuplicateTeacherEmail");
    expect(emailAction).toContain("TEACHER_EMAIL_UPDATED");
    expect(emailAction).not.toContain("globalRole: \"TEACHER\"");
  });

  it("does not change teacher claim flow from email edit UI", () => {
    const actions = read("src/app/admin/actions.ts");
    const emailActionStart = actions.indexOf("export async function updateTeacherEmail");
    const closeRoundStart = actions.indexOf("export async function closeProposalRound");
    const emailAction = actions.slice(emailActionStart, closeRoundStart);

    expect(emailAction).not.toContain("teacherAccountClaim");
    expect(emailAction).not.toContain("user.update");
    expect(emailAction).not.toContain("userId:");
  });
});
