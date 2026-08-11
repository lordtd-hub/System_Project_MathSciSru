import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.(ts|tsx)$/.test(entry.name)) return [];
    return [path];
  });
}

describe("production action button contract", () => {
  it("does not bypass React or Next server action submission", () => {
    const files = sourceFiles(join(root, "src"));
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("HTMLFormElement.prototype.submit");
      expect(source, file).not.toMatch(/\.(?:requestSubmit|submit)\s*\(/);
    }
  });

  it("uses the shared pending and recovery button for production mutation forms", () => {
    const roleRoots = ["admin", "student", "teacher"].map((role) => join(root, "src/app", role));

    for (const roleRoot of roleRoots) {
      for (const file of sourceFiles(roleRoot).filter((path) => path.endsWith("page.tsx"))) {
        const source = readFileSync(file, "utf8");
        const mutationForms = source.matchAll(/<form\b[^>]*\baction=\{[^}]+\}[^>]*>([\s\S]*?)<\/form>/g);
        for (const match of mutationForms) {
          expect(match[1], file).toContain("<SubmitButton");
        }
      }
    }
  });

  it("redirects actions that previously completed without visible navigation", () => {
    const teacherActions = readFileSync(join(root, "src/app/teacher/actions.ts"), "utf8");
    const adminActions = readFileSync(join(root, "src/app/admin/actions.ts"), "utf8");
    const claimPage = readFileSync(join(root, "src/app/teacher/claim/page.tsx"), "utf8");

    expect(teacherActions).toContain('redirect("/teacher/claim?success=teacher_claim_submitted")');
    expect(adminActions).toContain('redirect("/admin?success=project_advisor_confirmed")');
    expect(claimPage).toContain("<ActionFeedback");
  });
});
