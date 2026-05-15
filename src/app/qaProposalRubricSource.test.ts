import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("proposal rubric source wiring", () => {
  it("renders the condition-based proposal rubric by default on student and evaluator pages", () => {
    const studentPage = readFileSync(join(root, "src/app/student/proposal/page.tsx"), "utf8");
    const scoringPage = readFileSync(join(root, "src/app/teacher/scoring/[assignmentId]/page.tsx"), "utf8");

    expect(studentPage).toContain("<ProposalQaRubricPanel audience=\"student\" />");
    expect(scoringPage).toContain("<ProposalQaRubricPanel audience=\"evaluator\" />");
    expect(studentPage).not.toContain("isQaProposalRubricEnabled");
    expect(scoringPage).not.toContain("isQaProposalRubricEnabled");
  });
});
