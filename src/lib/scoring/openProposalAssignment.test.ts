import { describe, expect, it, vi } from "vitest";
import {
  openProposalAssignment,
  type ProposalAssignmentStore
} from "./openProposalAssignment";

function makeStore(overrides: Partial<ProposalAssignmentStore> = {}): ProposalAssignmentStore {
  return {
    findTeacher: async () => ({
      id: "teacher-1",
      academicPrefix: "อ.",
      firstNameTh: "ทดสอบ",
      lastNameTh: "ระบบ",
      active: true,
      isInternal: true,
      canEvaluateProposal: true
    }),
    findAttempt: async () => ({
      projectId: "project-1",
      assessmentRoundId: "round-1",
      attemptType: "MAIN_PROPOSAL",
      attemptStatus: "SCORING_OPEN",
      projectStatus: "PROPOSAL_REVIEW",
      roundType: "PROPOSAL",
      roundStatus: "SCORING_OPEN",
      hasProposalResult: false,
      isLatestProposalAttempt: true
    }),
    hasOpenLateRoundException: async () => false,
    findAssignment: async () => null,
    createAssignment: async () => ({ id: "assignment-1", status: "IN_PROGRESS" }),
    ...overrides
  };
}

describe("open Proposal assignment", () => {
  it("returns a controlled conflict when the teacher profile is missing", async () => {
    const result = await openProposalAssignment(makeStore({ findTeacher: async () => null }), {
      attemptId: "attempt-1",
      userId: "user-1"
    });
    expect(result).toEqual({ status: "conflict", code: "teacher_profile_missing" });
  });

  it.each([
    { active: false, isInternal: true, canEvaluateProposal: true },
    { active: true, isInternal: false, canEvaluateProposal: true },
    { active: true, isInternal: true, canEvaluateProposal: false }
  ])("rejects a linked teacher who is not currently eligible: %j", async (eligibility) => {
    const result = await openProposalAssignment(makeStore({
      findTeacher: async () => ({
        id: "teacher-1",
        academicPrefix: "อ.",
        firstNameTh: "ทดสอบ",
        lastNameTh: "ระบบ",
        ...eligibility
      })
    }), { attemptId: "attempt-1", userId: "user-1" });

    expect(result).toEqual({ status: "conflict", code: "teacher_not_eligible" });
  });

  it("returns a controlled conflict for a missing or closed attempt", async () => {
    await expect(openProposalAssignment(makeStore({ findAttempt: async () => null }), {
      attemptId: "missing",
      userId: "user-1"
    })).resolves.toEqual({ status: "conflict", code: "proposal_attempt_missing" });

    await expect(openProposalAssignment(makeStore({
      findAttempt: async () => ({
        projectId: "project-1",
        assessmentRoundId: "round-1",
        attemptType: "MAIN_PROPOSAL",
        attemptStatus: "SCORING_OPEN",
        projectStatus: "PROPOSAL_REVIEW",
        roundType: "PROPOSAL",
        roundStatus: "CLOSED",
        hasProposalResult: false,
        isLatestProposalAttempt: true
      })
    }), { attemptId: "attempt-1", userId: "user-1" })).resolves.toEqual({
      status: "conflict",
      code: "proposal_round_not_open"
    });
  });

  it("returns an existing submitted assignment without updating it", async () => {
    const createAssignment = vi.fn();
    const result = await openProposalAssignment(makeStore({
      findAssignment: async () => ({ id: "submitted-assignment", status: "SUBMITTED" }),
      createAssignment
    }), { attemptId: "attempt-1", userId: "user-1" });

    expect(result).toEqual({ status: "ready", assignmentId: "submitted-assignment", unchanged: true });
    expect(createAssignment).not.toHaveBeenCalled();
  });

  it("creates one assignment when none exists", async () => {
    const createAssignment = vi.fn(async () => ({ id: "new-assignment", status: "IN_PROGRESS" as const }));
    const result = await openProposalAssignment(makeStore({ createAssignment }), {
      attemptId: "attempt-1",
      userId: "user-1"
    });

    expect(result).toEqual({ status: "ready", assignmentId: "new-assignment", unchanged: false });
    expect(createAssignment).toHaveBeenCalledOnce();
  });

  it("opens the latest Re-proposal while the shared course round remains closed", async () => {
    const result = await openProposalAssignment(makeStore({
      findAttempt: async () => ({
        projectId: "project-1",
        assessmentRoundId: "round-1",
        attemptType: "REPROPOSAL",
        attemptStatus: "SCORING_OPEN",
        projectStatus: "PROPOSAL_REVIEW",
        roundType: "PROPOSAL",
        roundStatus: "SCORING_CLOSED",
        hasProposalResult: false,
        isLatestProposalAttempt: true
      })
    }), { attemptId: "attempt-2", userId: "user-1" });

    expect(result).toEqual({ status: "ready", assignmentId: "assignment-1", unchanged: false });
  });

  it("recovers the winning assignment after a concurrent unique conflict", async () => {
    let lookupCount = 0;
    const result = await openProposalAssignment(makeStore({
      findAssignment: async () => ++lookupCount === 1 ? null : { id: "winner", status: "IN_PROGRESS" },
      createAssignment: async () => {
        throw { code: "P2002" };
      }
    }), { attemptId: "attempt-1", userId: "user-1" });

    expect(result).toEqual({ status: "ready", assignmentId: "winner", unchanged: true });
  });

  it("does not hide infrastructure failures from the typed action boundary", async () => {
    await expect(openProposalAssignment(makeStore({
      createAssignment: async () => {
        throw new Error("database unavailable");
      }
    }), { attemptId: "attempt-1", userId: "user-1" })).rejects.toThrow("database unavailable");
  });
});
