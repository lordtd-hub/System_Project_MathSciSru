import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("teacher score revision source coverage", () => {
  it("keeps submitted Proposal scores editable until the Admin decision", () => {
    const actions = read("src/app/teacher/actions.ts");
    const scoringPage = read("src/app/teacher/scoring/[assignmentId]/page.tsx");

    expect(actions).toContain("isProposalScoreEditable");
    expect(actions).toContain('const isSubmittingScore = submitMode === "submit" || isScoreRevision');
    expect(actions).toContain("isScoreRevision && assignment.scoreSubmission ? Number(assignment.scoreSubmission.totalScore) : null");
    expect(scoringPage).toContain("const isScoreFormUnavailable = !canScoreProposalAttempt");
    expect(scoringPage).toContain('attemptType: assignment.assessmentAttempt.attemptType');
    expect(scoringPage).toContain("ยืนยันส่งคะแนนที่แก้ไข");
  });

  it("shows submitted Progress and Final scores while their rounds remain editable", () => {
    for (const file of [
      "src/app/teacher/progress1/page.tsx",
      "src/app/teacher/progress2/page.tsx",
      "src/app/teacher/final/page.tsx"
    ]) {
      const page = read(file);
      expect(page).toContain("isRoundOpen");
      expect(page).toContain("แก้ไขคะแนนได้");
      expect(page).not.toContain('scoreSubmission: { is: { status: "SUBMITTED" } }');
    }
  });

  it("keeps an audit marker and previous total for every presentation score revision", () => {
    const actions = read("src/app/teacher/actions.ts");
    expect(actions.match(/isRevision: Boolean\(previousSubmission\)/g)).toHaveLength(3);
    expect(actions.match(/previousTotalScore: previousSubmission/g)).toHaveLength(3);
  });

  it("keeps Advisor scoring editable until Admin completes the project", () => {
    const advisorPage = read("src/app/teacher/advisor-score/page.tsx");
    expect(advisorPage).toContain("isAdvisorScoreEditable(project.status)");
    expect(advisorPage).toContain("ยืนยันส่งคะแนนที่แก้ไข");
  });
});
