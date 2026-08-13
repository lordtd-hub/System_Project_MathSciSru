import { describe, expect, it, vi } from "vitest";
import { RateLimitExceededError } from "@/lib/security/rateLimit";
import {
  ProposalLifecycleConflictError,
  ProposalLifecycleValidationError,
  idleProposalLifecycleActionResult,
  runProposalLifecycleAction
} from "./proposalLifecycleActionResult";

describe("Proposal lifecycle action result", () => {
  it("exports the stable idle state and preserves a success result", async () => {
    expect(idleProposalLifecycleActionResult).toEqual({ status: "idle" });

    const result = await runProposalLifecycleAction("test.success", async (requestId) => ({
      status: "success",
      code: "PROPOSAL_LIFECYCLE_SAVED",
      message: "บันทึกเรียบร้อยแล้ว",
      requestId,
      unchanged: false
    }));

    expect(result).toMatchObject({
      status: "success",
      code: "PROPOSAL_LIFECYCLE_SAVED",
      unchanged: false
    });
  });

  it("maps expected validation, conflict, and rate-limit failures to typed results", async () => {
    const validation = await runProposalLifecycleAction("test.validation", async () => {
      throw new ProposalLifecycleValidationError("REASON_REQUIRED", "กรุณาระบุเหตุผล", ["reason"]);
    });
    const conflict = await runProposalLifecycleAction("test.conflict", async () => {
      throw new ProposalLifecycleConflictError("STALE_STATE", "สถานะเปลี่ยนแล้ว");
    });
    const rateLimit = await runProposalLifecycleAction("test.rate-limit", async () => {
      throw new RateLimitExceededError();
    });

    expect(validation).toMatchObject({ status: "validation", code: "REASON_REQUIRED", fields: ["reason"] });
    expect(conflict).toMatchObject({ status: "conflict", code: "STALE_STATE" });
    expect(rateLimit).toMatchObject({ status: "rate_limit", code: "RATE_LIMIT_EXCEEDED" });
  });

  it("returns a non-sensitive reference for unexpected failures", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await runProposalLifecycleAction("test.unexpected", async () => {
      throw new Error("database connection contains private detail");
    });

    expect(result).toMatchObject({ status: "unexpected", code: "UNEXPECTED_ERROR" });
    expect(result.status === "unexpected" ? result.message : "").not.toContain("private detail");
    expect(errorSpy).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });
});
