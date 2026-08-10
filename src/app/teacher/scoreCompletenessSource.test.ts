import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("teacher score completeness safeguards", () => {
  const scoringPages = [
    "src/app/teacher/scoring/[assignmentId]/page.tsx",
    "src/app/teacher/progress1/page.tsx",
    "src/app/teacher/progress2/page.tsx",
    "src/app/teacher/final/page.tsx",
    "src/app/teacher/advisor-score/page.tsx"
  ];

  it("marks every score form for live completeness checks", () => {
    for (const file of scoringPages) {
      const page = read(file);
      expect(page).toContain('data-score-control="true"');
      expect(page).toContain("scoreGuard");
      expect(page).toContain("ยืนยันส่งคะแนน");
    }
  });

  it("uses an unselected placeholder for condition-based rubric controls", () => {
    for (const file of scoringPages.slice(0, 4)) {
      expect(read(file)).toContain('<option value="" disabled>ยังไม่ได้เลือก</option>');
    }
  });

  it("rejects incomplete score fields on the server", () => {
    const actions = read("src/app/teacher/actions.ts");
    const feedback = read("src/components/ui/ActionFeedback.tsx");

    expect(actions.match(/redirectIfScoreFieldsIncomplete\(/g)?.length).toBeGreaterThanOrEqual(6);
    expect(feedback).toContain("score_rubric_incomplete");
  });
});

