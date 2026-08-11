import { describe, expect, it } from "vitest";
import {
  proposalDraftConditionCounts,
  readOptionalConditionCount,
  selectedDraftRubricItemIds,
  shouldRestoreProposalDraftItem,
  submittedProposalVotes
} from "./proposalDraftIntegrity";

describe("proposal draft integrity", () => {
  it("keeps omitted and blank condition fields distinct from an explicit zero", () => {
    const form = new FormData();
    form.set("blank", "");
    form.set("zero", "0");

    expect(readOptionalConditionCount(form, "missing")).toBeNull();
    expect(readOptionalConditionCount(form, "blank")).toBeNull();
    expect(readOptionalConditionCount(form, "zero")).toBe(0);

    form.set("malformed", "1e0");
    expect(readOptionalConditionCount(form, "malformed")).toBeNull();
  });

  it("restores the exact condition counts recorded by a draft marker", () => {
    expect(proposalDraftConditionCounts({ conditionCounts: { "item-a": 1, "item-b": 0 } })).toEqual({
      "item-a": 1,
      "item-b": 0
    });
    expect(proposalDraftConditionCounts({ conditionCounts: { "item-a": -1, "item-b": "2" } })).toEqual({});
  });

  it("quarantines legacy zero draft rows but preserves submitted zero rows", () => {
    expect(shouldRestoreProposalDraftItem({ submissionStatus: "DRAFT", hasV2Marker: false, pointsAwarded: 0 })).toBe(false);
    expect(shouldRestoreProposalDraftItem({ submissionStatus: "DRAFT", hasV2Marker: true, pointsAwarded: 0 })).toBe(true);
    expect(shouldRestoreProposalDraftItem({ submissionStatus: "SUBMITTED", hasV2Marker: false, pointsAwarded: 0 })).toBe(true);
  });

  it("keeps positive legacy draft rows while requiring zero rows to be selected again", () => {
    const selected = selectedDraftRubricItemIds([
      { rubricItemId: "positive", pointsAwarded: 5 },
      { rubricItemId: "zero", pointsAwarded: 0 }
    ], "DRAFT", false);

    expect([...selected]).toEqual(["positive"]);
  });

  it("publishes votes only for matching submitted evaluator assignments", () => {
    const votes = [
      { teacherId: "submitted", vote: "PASS" },
      { teacherId: "draft", vote: "FAIL" },
      { teacherId: "assignment-only", vote: "PASS" },
      { teacherId: "submission-only", vote: "FAIL" }
    ];
    const visible = submittedProposalVotes(votes, [
      { teacherId: "submitted", status: "SUBMITTED", scoreSubmission: { status: "SUBMITTED" } },
      { teacherId: "draft", status: "IN_PROGRESS", scoreSubmission: { status: "DRAFT" } },
      { teacherId: "assignment-only", status: "SUBMITTED", scoreSubmission: { status: "DRAFT" } },
      { teacherId: "submission-only", status: "IN_PROGRESS", scoreSubmission: { status: "SUBMITTED" } }
    ]);

    expect(visible).toEqual([{ teacherId: "submitted", vote: "PASS" }]);
  });
});
