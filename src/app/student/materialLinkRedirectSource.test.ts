import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("student material link validation UX", () => {
  it("returns typed validation for current-stage forms and preserves redirects for other student workflows", () => {
    const actions = read("src/app/student/actions.ts");

    expect(actions).toContain('"MATERIAL_LINK_INVALID"');
    expect(actions).toContain('new StudentActionValidationError(');
    expect(actions).toContain('redirectWithQuery("/student/schedule", { error: "material_link_invalid" })');
    expect(actions).toContain('redirectWithQuery("/student/report", { error: "material_link_invalid" })');
    expect(actions).not.toContain("if (!linkResult.ok) throw new Error(linkResult.reason)");
  });

  it("keeps expected student input failures recoverable instead of throwing a Next.js digest", () => {
    const actions = read("src/app/student/actions.ts");

    expect(actions).toContain('error: "student_required_field_missing"');
    expect(actions).toContain('error: "student_declaration_missing"');
    expect(actions).toContain('error: "student_text_too_long"');
    expect(actions).toContain('error: "student_markdown_invalid"');
    expect(actions).toContain('"TIMELINE_INVALID"');
    expect(actions).toContain('error: "schedule_time_invalid"');
    expect(actions).toContain('"REQUIRED_FIELD_MISSING"');
    expect(actions).toContain('"STUDENT_DECLARATION_MISSING"');
    expect(actions).not.toContain("throw new Error(`กรุณากรอก");
    expect(actions).not.toContain('throw new Error("กรุณายืนยันคำรับรองของนักศึกษา")');
    expect(actions).not.toContain("throw new Error(markdownErrors.join");
    expect(actions).not.toContain("throw new Error(noteErrors.join");
    expect(actions).not.toContain("assertTextSize(");
  });

  it("has a user-facing error message for invalid material links", () => {
    const feedback = read("src/components/ui/ActionFeedback.tsx");

    expect(feedback).toContain("material_link_invalid");
    expect(feedback).toContain("Google Drive");
    expect(feedback).toContain("Google Docs");
    expect(feedback).toContain("Google Classroom");
  });

  it("has user-facing messages for expected student input validation failures", () => {
    const feedback = read("src/components/ui/ActionFeedback.tsx");

    expect(feedback).toContain("student_required_field_missing");
    expect(feedback).toContain("student_declaration_missing");
    expect(feedback).toContain("student_text_too_long");
    expect(feedback).toContain("student_markdown_invalid");
    expect(feedback).toContain("student_timeline_invalid");
    expect(feedback).toContain("schedule_time_invalid");
  });
});
