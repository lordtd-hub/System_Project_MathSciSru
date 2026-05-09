import { describe, expect, it } from "vitest";
import { buildPathWithQuery } from "./redirectWithQuery";

describe("buildPathWithQuery", () => {
  it("encodes dynamic query parameter values", () => {
    expect(buildPathWithQuery("/admin/rounds", { error: "bad reason&next=/admin" })).toBe(
      "/admin/rounds?error=bad+reason%26next%3D%2Fadmin"
    );
  });

  it("preserves existing simple redirect destinations", () => {
    expect(buildPathWithQuery("/admin/import-students", { success: "students_imported", course_offering_id: "course-1" })).toBe(
      "/admin/import-students?success=students_imported&course_offering_id=course-1"
    );
  });
});
