import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("test course reset implementation", () => {
  const helperSource = readFileSync(join(process.cwd(), "src/lib/admin/testCourseReset.ts"), "utf8");
  const actionSource = readFileSync(join(process.cwd(), "src/app/admin/actions.ts"), "utf8");

  it("requires the explicit testing tools gate in the server action", () => {
    expect(actionSource).toContain("resetCourseOfferingTestData");
    expect(actionSource).toContain("isAdminTestingToolsEnabled");
    expect(actionSource).toContain("test_tools_disabled");
  });

  it("deletes course offering workflow records before deleting projects and the offering", () => {
    expect(helperSource).toContain("scoreItem.deleteMany");
    expect(helperSource).toContain("presentationSubmissionVersion.deleteMany");
    expect(helperSource).toContain("examScheduleApproval.deleteMany");
    expect(helperSource).toContain("reportReview.deleteMany");
    expect(helperSource).toContain("project.deleteMany");
    expect(helperSource).toContain("courseOffering.delete");
    expect(helperSource).toContain("TEST_COURSE_OFFERING_RESET");
  });
});
