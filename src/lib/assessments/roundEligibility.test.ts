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
