import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("protected route and action guard audit", () => {
  it("keeps admin pages and actions admin-only", () => {
    const adminPages = [
      "src/app/admin/page.tsx",
      "src/app/admin/claims/page.tsx",
      "src/app/admin/closeout/page.tsx",
      "src/app/admin/committee/page.tsx",
      "src/app/admin/evidence/page.tsx",
      "src/app/admin/import-students/page.tsx",
      "src/app/admin/proposals/page.tsx",
      "src/app/admin/rounds/page.tsx",
      "src/app/admin/schedules/page.tsx",
      "src/app/admin/students/page.tsx",
      "src/app/admin/teachers/page.tsx"
    ];

    for (const page of adminPages) {
      const source = read(page);
      expect(source).toContain("auth()");
      expect(source).toContain('session?.user.role !== "ADMIN"');
    }

    const actions = read("src/app/admin/actions.ts");
    expect(actions).toContain("async function requireAdminUserId()");
    expect(actions).toContain('session?.user.role !== "ADMIN"');
    expect(actions.match(/requireAdminUserId\(\)/g)?.length).toBeGreaterThanOrEqual(9);

    const evidenceExport = read("src/app/admin/evidence/exports/[kind]/route.ts");
    expect(evidenceExport).toContain("auth()");
    expect(evidenceExport).toContain('session?.user.role !== "ADMIN"');
  });

  it("keeps teacher work pages and mutations unavailable to pending teacher claims", () => {
    const teacherWorkPages = [
      "src/app/teacher/advisor-requests/page.tsx",
      "src/app/teacher/advisor-score/page.tsx",
      "src/app/teacher/final/page.tsx",
      "src/app/teacher/progress1/page.tsx",
      "src/app/teacher/progress2/page.tsx",
      "src/app/teacher/proposals/page.tsx",
      "src/app/teacher/proposal-revisions/page.tsx",
      "src/app/teacher/reports/page.tsx",
      "src/app/teacher/schedules/page.tsx",
      "src/app/teacher/scoring/[assignmentId]/page.tsx"
    ];

    for (const page of teacherWorkPages) {
      const source = read(page);
      expect(source).toContain("auth()");
      expect(source).toContain("hasApprovedTeacherCapability(session?.user)");
    }

    const teacherPage = read("src/app/teacher/page.tsx");
    expect(teacherPage).toContain("isPendingTeacherClaim(session?.user)");
    expect(teacherPage).toContain("/teacher/claim");

    const teacherActions = read("src/app/teacher/actions.ts");
    expect(teacherActions).toContain("hasApprovedTeacherCapability(user)");
    expect(teacherActions.match(/hasApprovedTeacherCapability\(user\)/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps teacher claim flow separate from approved teacher work pages", () => {
    const claimPage = read("src/app/teacher/claim/page.tsx");
    const claimActions = read("src/app/teacher/actions.ts");

    expect(claimPage).toContain('session.user.role !== "PENDING_TEACHER"');
    expect(claimActions).toContain("claimTeacherProfile");
    expect(claimActions).toContain("requirePendingTeacherClaimUser");
    expect(claimActions).toContain('status: "PENDING"');
  });

  it("keeps student pages roster-gated after role checks", () => {
    const studentPages = [
      "src/app/student/page.tsx",
      "src/app/student/feedback/page.tsx",
      "src/app/student/origin/page.tsx",
      "src/app/student/profile/page.tsx",
      "src/app/student/project/page.tsx",
      "src/app/student/proposal/page.tsx",
      "src/app/student/report/page.tsx",
      "src/app/student/schedule/page.tsx"
    ];

    for (const page of studentPages) {
      const source = read(page);
      expect(source).toContain("auth()");
      expect(source).toContain('session?.user.role !== "STUDENT"');
      expect(source).toContain("generatedEmail: session.user.email.toLowerCase()");
    }

    expect(read("src/app/student/actions.ts")).toContain("findUniqueOrThrow");
    expect(read("src/app/student/origin/page.tsx")).toContain("ยังไม่พบข้อมูลนักศึกษา");
    expect(read("src/app/student/project/page.tsx")).toContain("ยังไม่พบข้อมูลนักศึกษา");
  });

  it("keeps dev login unavailable outside development and uses centralized role resolution", () => {
    const authSource = read("src/auth.ts");
    const devActions = read("src/app/dev-login/actions.ts");
    const devPage = read("src/app/dev-login/page.tsx");
    const homePage = read("src/app/page.tsx");

    expect(authSource).toContain("resolveLoginRole(");
    expect(authSource).toContain("importedStudentCodes");
    expect(authSource).toContain("linkedTeacherEmails");
    expect(authSource).toContain("teacherId");
    expect(authSource).toContain("token.roles");
    expect(authSource).toContain("active: true");
    expect(authSource).toContain("delete token.role");
    expect(authSource).toContain("isDevLoginEnabled()");
    expect(devActions.match(/if \(!isDevLoginEnabled\(\)\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(devPage).toContain("if (!isDevLoginEnabled())");
    expect(homePage).toContain("isDevLoginEnabled()");
    expect(homePage).not.toContain('process.env.NODE_ENV !== "production"');
  });
});
