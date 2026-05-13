import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("self-scheduling and progress scoring source guards", () => {
  it("keeps student scheduling tied to course-level rounds and student ownership", () => {
    const actions = read("src/app/student/actions.ts");
    expect(actions).toContain("requireStudentContext()");
    expect(actions).toContain("submitExamSchedule");
    expect(actions).toContain("กรุณาเลือกอาจารย์ที่ปรึกษาก่อนส่งคำขอ");
    expect(actions).toContain("proposal_round_not_open");
    expect(actions).toContain("courseOfferingId_roundType");
    expect(actions).toContain("isRoundOpen(round.status)");
    expect(actions).toContain('project.status !== "IN_PROGRESS"');
    expect(actions).toContain("assessmentRoundId: round.id");
    expect(actions).toContain("saveAssessmentEvidence");
    expect(actions).toContain("assessment_evidence_required");
    expect(actions).toContain("schedule_request_locked");
    expect(actions).toContain('existing?.status === "PROPOSED" || existing?.status === "CONFIRMED"');
    expect(actions).toContain("findFirst");
    expect(actions).toContain("examScheduleProposal.update");
    expect(actions).toContain("examScheduleProposal.create");
    expect(actions).toContain('role: { in: ["ADVISOR", "HEAD", "MEMBER"] }');
    expect(actions).toContain("advisorRequest.findMany");
    expect(actions).toContain("requiredApproverIds");
  });

  it("keeps schedule views role guarded", () => {
    expect(read("src/app/admin/schedules/page.tsx")).toContain('session?.user.role !== "ADMIN"');
    expect(read("src/app/teacher/schedules/page.tsx")).toContain("hasApprovedTeacherCapability(session?.user)");
  });

  it("keeps student schedule rubric guidance separated by round", () => {
    const page = read("src/app/student/schedule/page.tsx");
    expect(page).toContain("ProgressQaRubricPanel");
    expect(page).toContain("FinalQaRubricPanel");
    expect(page).toContain("visibleGuidanceRounds.map");
    expect(page).toContain('roundType === "PROGRESS_1" || roundType === "PROGRESS_2"');
    expect(page).toContain('roundType === "FINAL_PRESENTATION"');
    expect(page).toContain("บันทึกเอกสาร/หลักฐานสำหรับรอบสอบ");
    expect(page).toContain("saveAssessmentEvidence");
    expect(page).toContain("schedulableRoundsWithEvidence");
    expect(page).toContain('name="progress_plan_tasks"');
    expect(page).toContain('name="progress_evidence"');
    expect(page).toContain('name="progress_status"');
    expect(page).toContain('name="progress_challenges_next"');
    expect(page).toContain('data-testid="student-schedule-page-content"');
    expect(page).toContain('data-testid="student-schedule-evidence-summary"');
    expect(page).toContain('data-testid={`student-assessment-evidence-form-${kind}`}');
    expect(page).toContain('data-testid="student-schedule-proposal-form-wrapper"');
    expect(page).toContain("ProposalPlanMiniReference");
    expect(page).toContain("normalizeProgressPlanTasks");
    expect(page).toContain("doesTaskOverlapWeekWindow");
    expect(page).toContain("hasCompletedScores");
    expect(page).toContain("activeScheduleByKind");
    expect(page).toContain("lockedScheduleRounds");
    expect(page).toContain("editableEvidenceRounds");
    expect(page).toContain("ส่งขอนัดแล้ว");
    expect(page).toContain("ยืนยันวันสอบแล้ว");
    expect(page).toContain("ตรวจสอบก่อนส่งวันสอบ");
    expect(page).toContain("ส่งข้อเสนอวันสอบ");
    expect(page).toContain("ยังแก้ไขเอกสารได้จนกว่าจะส่งเสนอวันสอบ");
    expect(page).toContain("ส่งเสนอวันสอบแล้ว จึงล็อกชุดหลักฐานรอบนี้ไว้ให้กรรมการตรวจ");
    expect(page).toContain('name="final_objectives_evidence"');
    expect(page).toContain('name="final_methods_results"');
    expect(page).toContain('name="final_timeline_adaptation"');
    expect(page).toContain('name="final_report_readiness"');

    const actions = read("src/app/student/actions.ts");
    expect(actions).toContain("progressPlanTasks");
    expect(actions).toContain("progressEvidence");
    expect(actions).toContain("progressStatus");
    expect(actions).toContain("progressChallengesNext");
    expect(actions).toContain("finalObjectivesEvidence");
    expect(actions).toContain("finalMethodsResults");
    expect(actions).toContain("finalTimelineAdaptation");
    expect(actions).toContain("finalReportReadiness");
    expect(actions).toContain("hasCompletedPresentationScores");
    expect(actions).toContain("assertPreviousPresentationRoundComplete");
    expect(actions).toContain("assessment_evidence_locked");
    expect(actions).toContain("schedule_previous_round_incomplete");
    expect(actions).not.toContain("roundStatus: project.courseOffering.assessmentRounds");
  });

  it("shows assessment evidence to committee teachers before scoring", () => {
    const teacherSchedules = read("src/app/teacher/schedules/page.tsx");
    const progress1 = read("src/app/teacher/progress1/page.tsx");
    const progress2 = read("src/app/teacher/progress2/page.tsx");
    expect(teacherSchedules).toContain("assessmentSubmissions");
    expect(teacherSchedules).toContain("confirmedScheduleCalendar");
    expect(teacherSchedules).toContain("ตารางสอบที่ยืนยันแล้ว");
    expect(teacherSchedules).toContain("ไม่แสดงเอกสารหลักฐานของนักศึกษา");
    expect(teacherSchedules).toContain("reviewExamSchedule");
    expect(teacherSchedules).toContain("อนุมัติวันสอบ");
    expect(teacherSchedules).toContain("ไม่อนุมัติ / ขอเปลี่ยนเวลา");
    expect(teacherSchedules).toContain("เปิดเอกสาร/หลักฐาน");
    expect(progress1).toContain('where: { kind: "PROGRESS_1" }');
    expect(progress2).toContain('where: { kind: "PROGRESS_2" }');
    expect(progress1).toContain('scheduleProposals: { some: { assessmentKind: "PROGRESS_1", status: "CONFIRMED" } }');
    expect(progress2).toContain('scheduleProposals: { some: { assessmentKind: "PROGRESS_2", status: "CONFIRMED" } }');
  });

  it("keeps schedule approval dashboard counts actionable and round-open only", () => {
    const teacherDashboard = read("src/app/teacher/page.tsx");
    const teacherActions = read("src/app/teacher/actions.ts");
    expect(teacherDashboard).toContain('status: "PROPOSED"');
    expect(teacherDashboard).toContain('assessmentRound: { status: { in: ["SUBMISSION_OPEN", "SCORING_OPEN"] } }');
    expect(teacherDashboard).toContain('role: { in: ["ADVISOR", "HEAD", "MEMBER"] }');
    expect(teacherDashboard).toContain('NOT: { approvals: { some: { teacherId, decision: { in: ["APPROVE", "REJECT"] } } } }');
    expect(teacherActions).toContain("reviewExamSchedule");
    expect(teacherActions).toContain("EXAM_SCHEDULE_APPROVED");
    expect(teacherActions).toContain("EXAM_SCHEDULE_REJECTED");
    expect(teacherActions).toContain('nextStatus = decision === "REJECT"');
  });

  it("keeps Progress 1 scoring assigned-teacher only and duplicate-safe", () => {
    const actions = read("src/app/teacher/actions.ts");
    expect(actions).toContain("submitProgress1Score");
    expect(actions).toContain("hasApprovedTeacherCapability(user)");
    expect(actions).toContain('project.status !== "IN_PROGRESS"');
    expect(actions).toContain('["HEAD", "MEMBER"].includes(assignment.role)');
    expect(actions).toContain('assertConfirmedSchedule(project.id, "PROGRESS_1", "การสอบความก้าวหน้าครั้งที่ 1")');
    expect(actions).toContain('assertScoreNotAlreadySubmitted(project.id, round.id, teacher.id, "การสอบความก้าวหน้าครั้งที่ 1")');
    expect(actions).toContain("assessmentAttempt.upsert");
    expect(actions).toContain("evaluatorAssignment.upsert");
    expect(actions).toContain("scoreSubmission.upsert");
  });

  it("keeps Progress 2 scoring assigned-teacher only and duplicate-safe", () => {
    const actions = read("src/app/teacher/actions.ts");
    const page = read("src/app/teacher/progress2/page.tsx");
    expect(actions).toContain("submitProgress2Score");
    expect(actions).toContain('roundType: "PROGRESS_2"');
    expect(actions).toContain('attemptType: "PROGRESS_2"');
    expect(actions).toContain('assertConfirmedSchedule(project.id, "PROGRESS_2", "การสอบความก้าวหน้าครั้งที่ 2")');
    expect(actions).toContain('assertScoreNotAlreadySubmitted(project.id, round.id, teacher.id, "การสอบความก้าวหน้าครั้งที่ 2")');
    expect(actions).toContain("validateProgress2Score");
    expect(actions).toContain("assessmentAttempt.upsert");
    expect(actions).toContain("evaluatorAssignment.upsert");
    expect(actions).toContain("scoreSubmission.upsert");
    expect(page).toContain("hasApprovedTeacherCapability(session?.user)");
    expect(page).toContain("การสอบความก้าวหน้าครั้งที่ 2");
    expect(page).toContain("submitProgress2Score");
  });

  it("keeps Final Presentation scoring assigned-teacher only and duplicate-safe", () => {
    const actions = read("src/app/teacher/actions.ts");
    const page = read("src/app/teacher/final/page.tsx");
    expect(actions).toContain("submitFinalPresentationScore");
    expect(actions).toContain('roundType: "FINAL_PRESENTATION"');
    expect(actions).toContain('attemptType: "FINAL_PRESENTATION"');
    expect(actions).toContain('assertConfirmedSchedule(project.id, "FINAL_PRESENT", "การสอบนำเสนอขั้นสุดท้าย")');
    expect(actions).toContain('assertScoreNotAlreadySubmitted(project.id, round.id, teacher.id, "การสอบนำเสนอขั้นสุดท้าย")');
    expect(actions).toContain("finalQaRubricItems");
    expect(actions).toContain("calculateFinalQaCriterionScore");
    expect(actions).toContain("assessmentAttempt.upsert");
    expect(actions).toContain("evaluatorAssignment.upsert");
    expect(actions).toContain("scoreSubmission.upsert");
    expect(page).toContain("hasApprovedTeacherCapability(session?.user)");
    expect(page).toContain("การสอบนำเสนอขั้นสุดท้าย");
    expect(page).toContain("submitFinalPresentationScore");
  });

  it("keeps /student robust for missing student/project states", () => {
    const studentPage = read("src/app/student/page.tsx");
    expect(studentPage).toContain("if (!student)");
    expect(studentPage).toContain("if (!project)");
    expect(studentPage).toContain("EmptyState");
    expect(studentPage).toContain("generatedEmail: session.user.email.toLowerCase()");
  });

  it("surfaces confirmed schedule timing and removes already-scored teacher work", () => {
    const teacherPage = read("src/app/teacher/page.tsx");
    const studentPage = read("src/app/student/page.tsx");
    expect(teacherPage).toContain("nextConfirmedScoringSchedule");
    expect(teacherPage).toContain("confirmedScheduleCalendarCount");
    expect(teacherPage).toContain("ownConfirmedScheduleAgenda");
    expect(teacherPage).toContain("ตารางสอบของท่าน");
    expect(teacherPage).toContain("ADVISOR");
    expect(teacherPage).toContain("scoreSubmission: { is: { status: submittedScoreStatus } }");
    expect(studentPage).toContain("latestScheduleDateText");
    expect(studentPage).toContain("scheduleAwareStudentNextAction");
    expect(studentPage).toContain("assessmentStates");
    expect(studentPage).toContain("getStudentAvailableActions(project.status, assessmentStates, reportStatus, studentWorkflowContext)");
    expect(studentPage).toContain("nextAssessmentAction");
    expect(studentPage).toContain("studentTrackingTasks");
    expect(studentPage).toContain("displayStudentTrackingTasks");
  });
});
