import { describe, expect, it, vi } from "vitest";
import type { TeacherScoreActionResult } from "@/lib/scoring/teacherScoreActionResult";
import {
  appendCheckboxDraftValue,
  isCheckboxSelected,
  reconcileTeacherScoreActionResult,
  type ScoreActionRecoveryState
} from "./ProposalDraftForm";

function createHarness(snapshot: Record<string, string | boolean> | null = { score_1: "2", comment: "draft" }) {
  const effects = {
    cancelPendingSave: vi.fn(),
    readSnapshot: vi.fn(() => snapshot),
    restoreSnapshot: vi.fn(),
    clearSnapshot: vi.fn(),
    refresh: vi.fn()
  };
  const state: ScoreActionRecoveryState = { lastRequestId: null };
  return { effects, state };
}

describe("teacher score action recovery", () => {
  it("serializes and restores mixed checkboxes that share one field name", () => {
    const values: Record<string, string | boolean | string[]> = {};

    appendCheckboxDraftValue(values, "checked_item", "rubric-a", true);
    appendCheckboxDraftValue(values, "checked_item", "rubric-b", false);
    appendCheckboxDraftValue(values, "checked_item", "rubric-c", true);

    expect(values.checked_item).toEqual(["rubric-a", "rubric-c"]);
    expect(isCheckboxSelected(values.checked_item, "rubric-a")).toBe(true);
    expect(isCheckboxSelected(values.checked_item, "rubric-b")).toBe(false);
    expect(isCheckboxSelected(values.checked_item, "rubric-c")).toBe(true);
  });

  it("keeps backward compatibility with boolean checkbox snapshots", () => {
    expect(isCheckboxSelected(true, "legacy")).toBe(true);
    expect(isCheckboxSelected(false, "legacy")).toBe(false);
  });

  it("clears the pending save and snapshot before refreshing server data after a committed success", () => {
    const { effects, state } = createHarness();
    const success: TeacherScoreActionResult = { status: "success", code: "proposal_score_submitted", requestId: "req-1" };

    const next = reconcileTeacherScoreActionResult(success, state, effects);
    const repeated = reconcileTeacherScoreActionResult(
      { status: "success", code: "proposal_score_submitted", requestId: "req-1" },
      next,
      effects
    );

    expect(effects.cancelPendingSave).toHaveBeenCalledTimes(1);
    expect(effects.clearSnapshot).toHaveBeenCalledTimes(1);
    expect(effects.refresh).toHaveBeenCalledTimes(1);
    expect(effects.readSnapshot).not.toHaveBeenCalled();
    expect(effects.restoreSnapshot).not.toHaveBeenCalled();
    expect(repeated).toEqual({ lastRequestId: "req-1" });
  });

  it("handles a later successful save while the form remains mounted", () => {
    const { effects, state } = createHarness();
    const first = reconcileTeacherScoreActionResult(
      { status: "success", code: "proposal_score_draft_saved", requestId: "req-1" },
      state,
      effects
    );

    const second = reconcileTeacherScoreActionResult(
      { status: "success", code: "proposal_score_draft_saved", requestId: "req-2" },
      first,
      effects
    );

    expect(effects.clearSnapshot).toHaveBeenCalledTimes(2);
    expect(effects.refresh).toHaveBeenCalledTimes(2);
    expect(second).toEqual({ lastRequestId: "req-2" });
  });
  it.each(["validation", "conflict", "rate_limit", "unexpected"] as const)(
    "restores every entered value and does not refresh after %s",
    (status) => {
      const snapshot = { score_1: "0", score_2: "2", comment: "keep this" };
      const { effects, state } = createHarness(snapshot);
      const result: TeacherScoreActionResult = {
        status,
        code: status === "validation" ? "score_rubric_incomplete" : `test_${status}`,
        requestId: `req-${status}`,
        missingFields: status === "validation" ? ["score_3"] : undefined
      };

      const next = reconcileTeacherScoreActionResult(result, state, effects);

      expect(effects.cancelPendingSave).toHaveBeenCalledTimes(1);
      expect(effects.readSnapshot).toHaveBeenCalledTimes(1);
      expect(effects.restoreSnapshot).toHaveBeenCalledWith(
        snapshot,
        status === "validation" ? ["score_3"] : []
      );
      expect(effects.clearSnapshot).not.toHaveBeenCalled();
      expect(effects.refresh).not.toHaveBeenCalled();
      expect(next).toEqual({ lastRequestId: `req-${status}` });
    }
  );

  it("does not repeat recovery effects when React renders the same result again", () => {
    const { effects, state } = createHarness();
    const result: TeacherScoreActionResult = {
      status: "validation",
      code: "score_rubric_incomplete",
      requestId: "req-same"
    };

    const next = reconcileTeacherScoreActionResult(result, state, effects);
    reconcileTeacherScoreActionResult(result, next, effects);

    expect(effects.cancelPendingSave).toHaveBeenCalledTimes(1);
    expect(effects.restoreSnapshot).toHaveBeenCalledTimes(1);
    expect(effects.refresh).not.toHaveBeenCalled();
  });
});
