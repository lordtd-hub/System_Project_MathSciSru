import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("student form recovery integration", () => {
  const mutationPages = [
    "src/app/student/profile/page.tsx",
    "src/app/student/origin/page.tsx",
    "src/app/student/project/page.tsx",
    "src/app/student/proposal/page.tsx",
    "src/app/student/schedule/page.tsx",
    "src/app/student/report/page.tsx"
  ];

  it("wraps every requested student mutation workflow with recoverable forms", () => {
    const sources = mutationPages.map(read);

    for (const source of sources) expect(source).toContain("StudentRecoverableActionForm");
    expect(sources[0]).toContain('storage="session"');
    expect(sources[4]).not.toContain('<form key={kind} id={`evidence-form-');
    for (const source of sources) expect(source).not.toContain("clearOnSuccess=");
  });

  it("disables timed reload recovery for every student mutation submit button", () => {
    for (const path of mutationPages) {
      const source = read(path);
      const submitButtonCount = source.match(/<SubmitButton\b/g)?.length ?? 0;
      const disabledRecoveryCount = source.match(/autoRecovery=\{false\}/g)?.length ?? 0;

      expect(submitButtonCount, path).toBeGreaterThan(0);
      expect(disabledRecoveryCount, path).toBe(submitButtonCount);
    }
  });
});
