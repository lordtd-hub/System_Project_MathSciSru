import { afterEach, describe, expect, it, vi } from "vitest";
import { RateLimitExceededError } from "@/lib/security/rateLimit";
import {
  runStudentAction,
  StudentActionConflictError,
  StudentActionValidationError,
  studentActionSuccess
} from "./studentActionResult";

afterEach(() => {
  vi.restoreAllMocks();
});

function readRecord(spy: ReturnType<typeof vi.spyOn>) {
  expect(spy).toHaveBeenCalledTimes(1);
  return JSON.parse(String(spy.mock.calls[0]?.[0])) as Record<string, unknown>;
}

describe("runStudentAction outcome logging", () => {
  it("logs success without form content or personal data", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const result = await runStudentAction("saveProposalSubmission", async (requestId) =>
      studentActionSuccess(requestId, "PROPOSAL_SUBMISSION_SAVED", "ส่งแล้ว", false)
    );

    expect(result.status).toBe("success");
    expect(readRecord(info)).toMatchObject({
      type: "student_action_outcome",
      action: "saveProposalSubmission",
      status: "success",
      code: "PROPOSAL_SUBMISSION_SAVED"
    });
    expect(Object.keys(readRecord(info))).toEqual(["type", "action", "requestId", "status", "code", "durationMs"]);
  });

  it.each([
    ["validation", () => { throw new StudentActionValidationError("MISSING", "กรุณากรอก", ["objectives"]); }, "MISSING"],
    ["conflict", () => { throw new StudentActionConflictError("STALE", "สถานะเปลี่ยน"); }, "STALE"],
    ["rate_limit", () => { throw new RateLimitExceededError(); }, "RATE_LIMIT_EXCEEDED"]
  ] as const)("logs the %s outcome returned as HTTP-safe typed state", async (status, operation, code) => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const result = await runStudentAction("saveProposalSubmission", async () => operation());

    expect(result).toMatchObject({ status, code });
    expect(readRecord(info)).toMatchObject({ action: "saveProposalSubmission", status, code });
  });

  it("logs unexpected failures at error level with only safe diagnostic fields", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await runStudentAction("saveProposalSubmission", async () => {
      throw new TypeError("private form content must not be logged");
    });

    expect(result.status).toBe("unexpected");
    expect(readRecord(error)).toMatchObject({
      action: "saveProposalSubmission",
      status: "unexpected",
      code: "UNEXPECTED_ERROR",
      errorName: "TypeError"
    });
    expect(String(error.mock.calls[0]?.[0])).not.toContain("private form content");
  });
});
