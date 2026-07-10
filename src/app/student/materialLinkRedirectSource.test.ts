import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("student material link validation UX", () => {
  it("redirects invalid material links back to the student workflow instead of throwing a Next.js digest", () => {
    const actions = read("src/app/student/actions.ts");

    expect(actions).toContain('redirectWithQuery("/student/project", { error: "material_link_invalid" })');
    expect(actions).toContain('redirectWithQuery("/student/proposal", { error: "material_link_invalid" })');
    expect(actions).toContain('redirectWithQuery("/student/schedule", { error: "material_link_invalid" })');
    expect(actions).toContain('redirectWithQuery("/student/report", { error: "material_link_invalid" })');
    expect(actions).not.toContain("if (!linkResult.ok) throw new Error(linkResult.reason)");
  });

  it("has a user-facing error message for invalid material links", () => {
    const feedback = read("src/components/ui/ActionFeedback.tsx");

    expect(feedback).toContain("material_link_invalid");
    expect(feedback).toContain("Google Drive");
    expect(feedback).toContain("Google Docs");
    expect(feedback).toContain("Google Classroom");
  });
});
