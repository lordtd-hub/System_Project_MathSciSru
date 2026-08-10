import { describe, expect, it } from "vitest";
import { openProposalScoringAttemptWhere, pendingProposalScoringAttemptWhere } from "./proposalWorkload";

describe("proposal workload queries", () => {
  it("uses the same open Proposal scope for lists and dashboard counts", () => {
    const openWhere = openProposalScoringAttemptWhere();
    const pendingWhere = pendingProposalScoringAttemptWhere("teacher-user-id");

    expect(pendingWhere).toEqual({
      AND: [
        openWhere,
        {
          NOT: {
            evaluatorAssignments: {
              some: {
                evaluatorUserId: "teacher-user-id",
                scoreSubmission: { is: { status: "SUBMITTED" } }
              }
            }
          }
        }
      ]
    });
  });
});
