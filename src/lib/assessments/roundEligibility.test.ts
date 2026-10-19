import { describe, expect, it } from "vitest";
import { buildRoundEligibilityBuckets, getProgress1Readiness, getRoundReadiness, reasonLabelTh } from "./roundEligibility";

const baseProject = {
  id: "project-1",
  status: "IN_PROGRESS" as const,
  proposalResults: [{ finalDecision: "PASS" as const }],
  committeeAssignments: [
    { role: "ADVISOR" as const, active: true },
    { role: "HEAD" as const, active: true },
    { role: "MEMBER" as const, active: true }
  ],
  roundExceptions: []
};

describe("round eligibility", () => {
  it("marks a passed project with full committee eligible for Progress 1", () => {
    expect(getProgress1Readiness(baseProject).eligible).toBe(true);
  });

  it("reports missing committee reasons", () => {
    const readiness = getProgress1Readiness({ ...baseProject, committeeAssignments: [{ role: "ADVISOR", active: true }] });
    expect(readiness.eligible).toBe(false);
    expect(readiness.reasons).toContain("missing HEAD");
    expect(readiness.reasons).toContain("missing MEMBER");
  });

  it("does not let failed or revise proposal enter Progress 1", () => {
    const readiness = getProgress1Readiness({ ...baseProject, proposalResults: [{ finalDecision: "NOT_PASS" }] });
    expect(readiness.eligible).toBe(false);
    expect(reasonLabelTh(readiness.reasons[0])).toBe("ยังไม่ผ่านการเสนอหัวข้อ");
  });

  it("blocks PASS_WITH_REVISION until the advisor locks the revised Proposal", () => {
    const readiness = getProgress1Readiness({
      ...baseProject,
      status: "PROPOSAL_REVISION_REQUIRED",
      proposalResults: [{ finalDecision: "PASS_WITH_REVISION" }],
      attempts: [{
        attemptNo: 1,
        status: "SCORING_CLOSED",
        assessmentRound: { roundType: "PROPOSAL" },
        presentationSubmission: { status: "SUBMITTED" },
        evaluatorAssignments: []
      }]
    });

    expect(readiness.eligible).toBe(false);
    expect(readiness.reasons).toContain("proposal failed/revise");
  });

  it("accepts PASS_WITH_REVISION after advisor certification without a new assessment", () => {
    const readiness = getProgress1Readiness({
      ...baseProject,
      status: "TOPIC_APPROVED",
      proposalResults: [{ finalDecision: "PASS_WITH_REVISION" }],
      attempts: [{
        attemptNo: 1,
        status: "SCORING_CLOSED",
        assessmentRound: { roundType: "PROPOSAL" },
        presentationSubmission: { status: "LOCKED" },
        evaluatorAssignments: []
      }]
    });

    expect(readiness.eligible).toBe(true);
  });

  it("keeps certified PASS_WITH_REVISION eligible after committee appointment moves the project to IN_PROGRESS", () => {
    const readiness = getProgress1Readiness({
      ...baseProject,
      status: "IN_PROGRESS",
      proposalResults: [{ finalDecision: "PASS_WITH_REVISION" }],
      attempts: [{
        attemptNo: 1,
        status: "SCORING_CLOSED",
        assessmentRound: { roundType: "PROPOSAL" },
        presentationSubmission: { status: "LOCKED" },
        evaluatorAssignments: []
      }]
    });

    expect(readiness.eligible).toBe(true);
    expect(readiness.reasons).toEqual([]);
  });

  it("still blocks an uncertified PASS_WITH_REVISION project after its status advances", () => {
    const readiness = getProgress1Readiness({
      ...baseProject,
      status: "IN_PROGRESS",
      proposalResults: [{ finalDecision: "PASS_WITH_REVISION" }],
      attempts: [{
        attemptNo: 1,
        status: "SCORING_CLOSED",
        assessmentRound: { roundType: "PROPOSAL" },
        presentationSubmission: { status: "SUBMITTED" },
        evaluatorAssignments: []
      }]
    });

    expect(readiness.eligible).toBe(false);
    expect(readiness.reasons).toContain("proposal failed/revise");
  });

  it("uses the latest Re-proposal certification instead of an older locked attempt", () => {
    const readiness = getProgress1Readiness({
      ...baseProject,
      status: "IN_PROGRESS",
      proposalResults: [{ finalDecision: "PASS_WITH_REVISION" }],
      attempts: [
        {
          attemptNo: 1,
          status: "SCORING_CLOSED",
          assessmentRound: { roundType: "PROPOSAL" },
          presentationSubmission: { status: "LOCKED" },
          evaluatorAssignments: []
        },
        {
          attemptNo: 2,
          status: "SCORING_CLOSED",
          assessmentRound: { roundType: "PROPOSAL" },
          presentationSubmission: { status: "SUBMITTED" },
          evaluatorAssignments: []
        }
      ]
    });

    expect(readiness.eligible).toBe(false);
    expect(readiness.reasons).toContain("proposal failed/revise");
  });

  it("accepts a certified third Proposal attempt regardless of earlier attempt states", () => {
    const readiness = getProgress1Readiness({
      ...baseProject,
      status: "IN_PROGRESS",
      proposalResults: [{ finalDecision: "PASS_WITH_REVISION" }],
      attempts: [
        {
          attemptNo: 3,
          status: "SCORING_CLOSED",
          assessmentRound: { roundType: "PROPOSAL" },
          presentationSubmission: { status: "LOCKED" },
          evaluatorAssignments: []
        },
        {
          attemptNo: 1,
          status: "SCORING_CLOSED",
          assessmentRound: { roundType: "PROPOSAL" },
          presentationSubmission: { status: "SUBMITTED" },
          evaluatorAssignments: []
        },
        {
          attemptNo: 2,
          status: "SCORING_CLOSED",
          assessmentRound: { roundType: "PROPOSAL" },
          presentationSubmission: { status: "SUBMITTED" },
          evaluatorAssignments: []
        }
      ]
    });

    expect(readiness.eligible).toBe(true);
    expect(readiness.reasons).toEqual([]);
  });

  it("shows exact waiting reason before admin confirmation", () => {
    const readiness = getProgress1Readiness({ ...baseProject, status: "PENDING_ADMIN", proposalResults: [] });
    expect(readiness.reasons).toContain("project still PENDING_ADMIN");
  });

  it("does not count projects that are not yet eligible as current-round incomplete", () => {
    const blockedProject = { ...baseProject, id: "blocked", status: "PROPOSAL_REVIEW" as const, proposalResults: [] };
    const buckets = buildRoundEligibilityBuckets([baseProject, blockedProject], "PROGRESS_1");

    expect(buckets.notReady.map((item) => item.project.id)).toContain("blocked");
    expect(buckets.eligibleButIncomplete.map((item) => item.project.id)).toEqual(["project-1"]);
  });

  it("keeps open late-round exceptions eligible instead of moving them to not-ready", () => {
    const lateRecoveryProject = {
      ...baseProject,
      id: "late-recovery",
      roundExceptions: [{
        status: "OPEN",
        reason: "late Progress 1 recovery",
        exceptionType: "LATE_ASSESSMENT_ROUND"
      }]
    };
    const buckets = buildRoundEligibilityBuckets([lateRecoveryProject], "PROGRESS_1");

    expect(buckets.eligible.map((item) => item.project.id)).toEqual(["late-recovery"]);
    expect(buckets.eligibleButIncomplete.map((item) => item.project.id)).toEqual(["late-recovery"]);
    expect(buckets.notReady).toEqual([]);
  });

  it("still treats non-late open exceptions as readiness blockers", () => {
    const blockedProject = {
      ...baseProject,
      id: "blocked-exception",
      roundExceptions: [{
        status: "OPEN",
        reason: "manual administrative hold",
        exceptionType: "ADMIN_HOLD"
      }]
    };
    const readiness = getProgress1Readiness(blockedProject);

    expect(readiness.eligible).toBe(false);
    expect(readiness.reasons).toContain("manual administrative hold");
  });

  it("marks Progress 2 eligible only after required Progress 1 committee scoring is complete", () => {
    const project = {
      ...baseProject,
      committeeAssignments: [
        { role: "ADVISOR" as const, active: true, teacherId: "advisor" },
        { role: "HEAD" as const, active: true, teacherId: "head" },
        { role: "MEMBER" as const, active: true, teacherId: "member" }
      ],
      attempts: [{
        status: "SCORING_OPEN",
        assessmentRound: { roundType: "PROGRESS_1" as const },
        evaluatorAssignments: [
          { teacherId: "head", scoreSubmission: { status: "SUBMITTED" as const } },
          { teacherId: "member", scoreSubmission: { status: "SUBMITTED" as const } }
        ]
      }]
    };

    expect(getRoundReadiness(project, "PROGRESS_2").eligible).toBe(true);
  });

  it("keeps Progress 2 not eligible while Progress 1 required scoring is incomplete", () => {
    const project = {
      ...baseProject,
      committeeAssignments: [
        { role: "ADVISOR" as const, active: true, teacherId: "advisor" },
        { role: "HEAD" as const, active: true, teacherId: "head" },
        { role: "MEMBER" as const, active: true, teacherId: "member" }
      ],
      attempts: [{
        status: "SCORING_OPEN",
        assessmentRound: { roundType: "PROGRESS_1" as const },
        evaluatorAssignments: [
          { teacherId: "head", scoreSubmission: { status: "SUBMITTED" as const } }
        ]
      }]
    };

    const readiness = getRoundReadiness(project, "PROGRESS_2");
    expect(readiness.eligible).toBe(false);
    expect(readiness.reasons).toContain("progress 1 assessment incomplete");
  });

  it("marks Final eligible only after required Progress 2 scoring is complete", () => {
    const project = {
      ...baseProject,
      committeeAssignments: [
        { role: "ADVISOR" as const, active: true, teacherId: "advisor" },
        { role: "HEAD" as const, active: true, teacherId: "head" },
        { role: "MEMBER" as const, active: true, teacherId: "member" }
      ],
      attempts: [
        {
          status: "SCORING_OPEN",
          assessmentRound: { roundType: "PROGRESS_1" as const },
          evaluatorAssignments: [
            { teacherId: "head", scoreSubmission: { status: "SUBMITTED" as const } },
            { teacherId: "member", scoreSubmission: { status: "SUBMITTED" as const } }
          ]
        },
        {
          status: "SCORING_OPEN",
          assessmentRound: { roundType: "PROGRESS_2" as const },
          evaluatorAssignments: [
            { teacherId: "head", scoreSubmission: { status: "SUBMITTED" as const } },
            { teacherId: "member", scoreSubmission: { status: "SUBMITTED" as const } }
          ]
        }
      ]
    };

    expect(getRoundReadiness(project, "FINAL_PRESENTATION").eligible).toBe(true);
  });

  it("keeps FINAL_DONE projects in Final eligible and completed buckets", () => {
    const project = {
      ...baseProject,
      status: "FINAL_DONE" as const,
      assessmentSubmissions: [{ kind: "FINAL_PRESENT" as const }],
      committeeAssignments: [
        { role: "ADVISOR" as const, active: true, teacherId: "advisor" },
        { role: "HEAD" as const, active: true, teacherId: "head" },
        { role: "MEMBER" as const, active: true, teacherId: "member" }
      ],
      attempts: [
        {
          status: "SCORING_OPEN",
          assessmentRound: { roundType: "PROGRESS_1" as const },
          evaluatorAssignments: [
            { teacherId: "head", scoreSubmission: { status: "SUBMITTED" as const } },
            { teacherId: "member", scoreSubmission: { status: "SUBMITTED" as const } }
          ]
        },
        {
          status: "SCORING_OPEN",
          assessmentRound: { roundType: "PROGRESS_2" as const },
          evaluatorAssignments: [
            { teacherId: "head", scoreSubmission: { status: "SUBMITTED" as const } },
            { teacherId: "member", scoreSubmission: { status: "SUBMITTED" as const } }
          ]
        },
        {
          status: "SCORING_OPEN",
          assessmentRound: { roundType: "FINAL_PRESENTATION" as const },
          evaluatorAssignments: [
            { teacherId: "head", scoreSubmission: { status: "SUBMITTED" as const } },
            { teacherId: "member", scoreSubmission: { status: "SUBMITTED" as const } }
          ]
        }
      ]
    };

    const buckets = buildRoundEligibilityBuckets([project], "FINAL_PRESENTATION");

    expect(buckets.eligible.map((item) => item.project.id)).toEqual(["project-1"]);
    expect(buckets.submitted.map((item) => item.project.id)).toEqual(["project-1"]);
    expect(buckets.completed.map((item) => item.project.id)).toEqual(["project-1"]);
    expect(buckets.eligibleButIncomplete).toEqual([]);
    expect(buckets.notReady).toEqual([]);
  });
});

const advancedStatuses = ["REPORT_REVIEW", "REPORT_APPROVED", "ADVISOR_SCORING", "COMPLETED"] as const;
function advancedProject(status: (typeof advancedStatuses)[number]) {
  return {
    ...baseProject,
    status,
    committeeAssignments: [
      { role: "ADVISOR" as const, active: true, teacherId: "advisor" },
      { role: "HEAD" as const, active: true, teacherId: "head" },
      { role: "MEMBER" as const, active: true, teacherId: "member" }
    ],
    assessmentSubmissions: [{ kind: "PROGRESS_1" as const }, { kind: "PROGRESS_2" as const }, { kind: "FINAL_PRESENT" as const }],
    attempts: (["PROGRESS_1", "PROGRESS_2", "FINAL_PRESENTATION"] as const).map((roundType) => ({
      status: "SCORING_OPEN",
      assessmentRound: { roundType },
      evaluatorAssignments: [
        { teacherId: "head", scoreSubmission: { status: "SUBMITTED" as const } },
        { teacherId: "member", scoreSubmission: { status: "SUBMITTED" as const } }
      ]
    }))
  };
}

describe.each(advancedStatuses)("advanced lifecycle readiness: %s", (status) => {
  it.each(["PROGRESS_1", "PROGRESS_2", "FINAL_PRESENTATION"] as const)("retains actual completed evidence in %s buckets", (roundType) => {
    const buckets = buildRoundEligibilityBuckets([advancedProject(status)], roundType);
    expect(buckets.eligible).toHaveLength(1);
    expect(buckets.submitted).toHaveLength(1);
    expect(buckets.completed).toHaveLength(1);
    expect(buckets.notReady).toEqual([]);
    expect(buckets.eligibleButIncomplete).toEqual([]);
  });

  it("still requires the Proposal decision, committee and absence of an administrative hold", () => {
    const project = advancedProject(status);
    expect(getProgress1Readiness({ ...project, proposalResults: [] }).eligible).toBe(false);
    expect(getProgress1Readiness({ ...project, proposalResults: [{ finalDecision: "NOT_PASS" }] }).eligible).toBe(false);
    expect(getProgress1Readiness({ ...project, proposalResults: [{ finalDecision: "PASS_WITH_REVISION" }] }).eligible).toBe(false);
    expect(getProgress1Readiness({ ...project, committeeAssignments: [] }).eligible).toBe(false);
    expect(getProgress1Readiness({ ...project, roundExceptions: [{ status: "OPEN", reason: "hold", exceptionType: "ADMIN_HOLD" }] }).eligible).toBe(false);
  });

  it("does not substitute advanced status for required Progress scores", () => {
    const project = advancedProject(status);
    expect(getRoundReadiness({ ...project, attempts: [] }, "PROGRESS_2").reasons).toContain("progress 1 assessment incomplete");
    const partialProgressScores = { ...project, attempts: project.attempts.map((attempt) => ({ ...attempt, evaluatorAssignments: attempt.evaluatorAssignments.slice(0, 1) })) };
    expect(getRoundReadiness(partialProgressScores, "PROGRESS_2").reasons).toContain("progress 1 assessment incomplete");
    expect(getRoundReadiness({ ...project, attempts: project.attempts.filter((attempt) => attempt.assessmentRound.roundType !== "PROGRESS_2") }, "FINAL_PRESENTATION").reasons).toContain("progress 2 assessment incomplete");
    const missingFinalScores = { ...project, attempts: project.attempts.filter((attempt) => attempt.assessmentRound.roundType !== "FINAL_PRESENTATION") };
    const buckets = buildRoundEligibilityBuckets([missingFinalScores], "FINAL_PRESENTATION");
    expect(buckets.eligible).toHaveLength(1);
    expect(buckets.completed).toEqual([]);
    expect(buckets.eligibleButIncomplete).toHaveLength(1);
  });
});
