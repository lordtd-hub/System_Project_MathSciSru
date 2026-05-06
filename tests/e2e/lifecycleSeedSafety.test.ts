import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { e2eCourseOfferingId } from "../../prisma/demo-data";

describe("lifecycle demo/E2E seed safety", () => {
  const e2eSource = readFileSync(join(process.cwd(), "tests/e2e/lifecycle-v2.ts"), "utf8");
  const demoDataSource = readFileSync(join(process.cwd(), "prisma/demo-data.ts"), "utf8");
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));

  it("uses a stable E2E course offering instead of timestamped offerings", () => {
    expect(e2eCourseOfferingId).toBe("e2e-lifecycle-course-offering");
    expect(e2eSource).not.toContain("const courseOfferingId = `e2e-offering-${stamp}`");
    expect(e2eSource).toContain("cleanKnownDemoData(prisma)");
  });

  it("upserts course-level rounds by course offering and round type", () => {
    expect(e2eSource).toContain("courseOfferingId_roundType");
    expect(e2eSource).toContain("courseLevelRoundTypes");
    expect(e2eSource).toContain("majorRoundCount === courseLevelRoundTypes.length");
  });

  it("refuses demo cleanup on non-local databases", () => {
    expect(demoDataSource).toContain("localhost");
    expect(demoDataSource).toContain("127.0.0.1");
    expect(packageJson.scripts["dev:reset-demo"]).toContain("clean-demo.ts");
  });
});
