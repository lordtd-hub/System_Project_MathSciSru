import { describe, expect, it, vi } from "vitest";
import { RateLimitExceededError } from "@/lib/security/rateLimit";
import {
  AdminRoundConflictError,
  AdminRoundValidationError,
  runAdminRoundAction
} from "./adminRoundActionResult";

describe("Admin round action result", () => {
  it("returns typed validation, conflict, and rate-limit results", async () => {
    const validation = await runAdminRoundAction("test.validation", async () => {
      throw new AdminRoundValidationError("REASON_REQUIRED", "กรุณาระบุเหตุผล", ["override_reason"]);
    });
    const conflict = await runAdminRoundAction("test.conflict", async () => {
      throw new AdminRoundConflictError("STALE_STATE", "สถานะรอบเปลี่ยนแล้ว");
    });
    const rateLimit = await runAdminRoundAction("test.rate-limit", async () => {
      throw new RateLimitExceededError();
    });

    expect(validation).toMatchObject({ status: "validation", code: "REASON_REQUIRED", fields: ["override_reason"] });
    expect(conflict).toMatchObject({ status: "conflict", code: "STALE_STATE" });
    expect(rateLimit).toMatchObject({ status: "rate_limit", code: "RATE_LIMIT_EXCEEDED" });
  });

  it("does not expose infrastructure details in unexpected errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await runAdminRoundAction("test.unexpected", async () => {
      throw new Error("private database connection detail");
    });

    expect(result).toMatchObject({ status: "unexpected", code: "UNEXPECTED_ERROR" });
    expect(result.status === "unexpected" ? result.message : "").not.toContain("private database");
    expect(errorSpy).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });
});
