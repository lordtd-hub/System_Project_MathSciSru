import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(join(process.cwd(), "src/app/student/page.tsx"), "utf8");

describe("student dashboard source", () => {
  it("surfaces current date and a compact combined assessment status module", () => {
    const page = source();

    expect(page).toContain("todayText");
    expect(page).toContain("สถานะกรรมการ วันสอบ และผลประเมิน");
    expect(page).not.toContain("รวมข้อมูลกรรมการ การอนุมัติวันสอบ และผลประเมินที่เปิดเผยแล้วไว้ในโมดูลเดียว");
    expect(page).not.toContain("Assessment & Committee Status");
    expect(page).not.toContain("Assessment results");
    expect(page).not.toContain("กรรมการและการนัดสอบ");
    expect(page).toContain("วันสอบล่าสุด:");
    expect(page).toContain("ผลการประเมินรอบสอบ");
    expect(page).toContain("assessmentResultCards");
    expect(page).toContain("/student/feedback?round=progress-1#progress-1");
    expect(page).toContain("/student/feedback?round=progress-2#progress-2");
    expect(page).toContain("/student/feedback?round=final#final");
  });

  it("adds a conservative Figma dashboard renderer while keeping student workflow links", () => {
    const page = source();

    expect(page).toContain("getUiMode");
    expect(page).toContain("figma-student-dashboard");
    expect(page).toContain("FigmaPageHeader");
    expect(page).toContain("FigmaMetricCard");
    expect(page).toContain("FigmaPanel");
    expect(page).toContain("workflowActions.available_now");
    expect(page).toContain("workflowActions.blocked_waiting_for");
    expect(page).toContain("workflowActions.locked_future");
    expect(page).toContain("workflowActions.read_only_history");
    expect(page).toContain("/student/schedule");
    expect(page).toContain("/student/report");
    expect(page).toContain("/student/feedback?round=progress-1#progress-1");
  });

  it("adds a conservative Figma project renderer without changing the advisor request form contract", () => {
    const page = readFileSync(join(process.cwd(), "src/app/student/project/page.tsx"), "utf8");

    expect(page).toContain("getUiMode");
    expect(page).toContain("figma-student-project");
    expect(page).toContain("FigmaReviewLayout");
    expect(page).toContain("FigmaMetricCard");
    expect(page).toContain("DraftPreservingForm action={saveProjectOrigin}");
    expect(page).toContain("projectOriginFields");
    expect(page).toContain('name="initial_project_title_th"');
    expect(page).toContain('name="initial_project_title_en"');
    expect(page).toContain('name="reason_for_topic"');
    expect(page).toContain('name="expected_math_area"');
    expect(page).toContain('name="consultation_summary"');
    expect(page).toContain('name="tentative_advisor_id"');
    expect(page).toContain('name="source_type"');
    expect(page).toContain('name="initial_references"');
    expect(page).toContain('name="student_declaration"');
    expect(page).toContain("MaterialLinkField");
    expect(page).toContain("MarkdownLatexViewer");
  });

  it("adds a conservative Figma proposal renderer while preserving proposal submission fields", () => {
    const page = readFileSync(join(process.cwd(), "src/app/student/proposal/page.tsx"), "utf8");

    expect(page).toContain("getUiMode");
    expect(page).toContain("figma-student-proposal");
    expect(page).toContain("FigmaPageHeader");
    expect(page).toContain("FigmaMetricCard");
    expect(page).toContain("ProposalDraftForm action={saveProposalSubmission}");
    expect(page).toContain('name="project_title_th"');
    expect(page).toContain('name="project_title_en"');
    expect(page).toContain('name="abstract_of_talk"');
    expect(page).toContain('name="motivation_background"');
    expect(page).toContain('name="objectives"');
    expect(page).toContain('name="proposed_methods"');
    expect(page).toContain('name="expected_outcomes"');
    expect(page).toContain("ProposalTimelineBuilder");
    expect(page).toContain('name="questions_for_teachers"');
    expect(page).toContain('name="student_declaration"');
    expect(page).toContain("data-proposal-draft-save");
    expect(page).toContain("ProposalQaRubricPanel");
    expect(page).toContain("MarkdownLatexViewer");
  });
});
