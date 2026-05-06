import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("production baseline seed source", () => {
  const source = read("prisma/seed-production-baseline.ts");
  const packageJson = JSON.parse(read("package.json"));

  it("adds a dedicated production baseline seed script", () => {
    expect(packageJson.scripts["seed:production-baseline"]).toBe("tsx prisma/seed-production-baseline.ts");
    expect(source).toContain("SEED_TEACHERS.csv");
    expect(source).toContain("INITIAL_ADMIN_EMAIL");
  });

  it("upserts teacher profiles and preserves existing email links", () => {
    expect(source).toContain("prisma.teacher.upsert");
    expect(source).toContain("academicPrefix_firstNameTh_lastNameTh");
    expect(source).toContain("assertTeacherEmailAvailable");
    expect(source).toContain("mode: \"insensitive\"");
    expect(source).toContain("existing?.email ? {} : emailData");
  });

  it("seeds only safe baseline rubrics and avoids demo/student/project data", () => {
    expect(source).toContain("prisma.rubric.upsert");
    expect(source).toContain("prisma.rubricItem.upsert");
    expect(source).toContain("AssessmentRoundType.PROPOSAL");
    expect(source).toContain("AssessmentRoundType.PROGRESS_1");
    expect(source).toContain("AssessmentRoundType.PROGRESS_2");
    expect(source).toContain("AssessmentRoundType.FINAL_PRESENTATION");
    expect(source).not.toMatch(/prisma\.student\.(upsert|create|createMany|update|updateMany)/);
    expect(source).not.toMatch(/prisma\.project\.(upsert|create|createMany|update|updateMany)/);
    expect(source).not.toContain("seed-demo");
    expect(source).not.toContain("cleanKnownDemoData");
  });

  it("detects known E2E rows without deleting them", () => {
    expect(source).toContain("inspectKnownE2eRows");
    expect(source).toContain("Known E2E/demo rows detected but not modified");
    expect(source).not.toContain("deleteMany");
  });

  it("does not create an advisor course-level round or rubric row", () => {
    expect(source).toContain("advisorCriteria");
    expect(source).toContain("no course-level AssessmentRound rubric is created");
    expect(source).not.toContain("ADVISOR_SCORE");
  });
});
