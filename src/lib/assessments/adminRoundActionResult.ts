import { randomUUID } from "node:crypto";
import { RateLimitExceededError } from "@/lib/security/rateLimit";

type AdminRoundActionBase = {
  code: string;
  message: string;
  requestId: string;
};

export type AdminRoundActionResult =
  | { status: "idle" }
  | (AdminRoundActionBase & { status: "success"; unchanged: boolean })
  | (AdminRoundActionBase & { status: "validation"; fields: string[] })
  | (AdminRoundActionBase & { status: "conflict" })
  | (AdminRoundActionBase & { status: "rate_limit" })
  | (AdminRoundActionBase & { status: "unexpected" });

export const idleAdminRoundActionResult: AdminRoundActionResult = { status: "idle" };

export class AdminRoundValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fields: string[] = []
  ) {
    super(message);
    this.name = "AdminRoundValidationError";
  }
}

export class AdminRoundConflictError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "AdminRoundConflictError";
  }
}

export async function runAdminRoundAction(
  action: string,
  operation: (requestId: string) => Promise<AdminRoundActionResult>
): Promise<AdminRoundActionResult> {
  const requestId = randomUUID();
  const startedAt = performance.now();

  try {
    return await operation(requestId);
  } catch (error) {
    if (error instanceof AdminRoundValidationError) {
      return {
        status: "validation",
        code: error.code,
        message: error.message,
        requestId,
        fields: error.fields
      };
    }
    if (error instanceof AdminRoundConflictError) {
      return {
        status: "conflict",
        code: error.code,
        message: error.message,
        requestId
      };
    }
    if (error instanceof RateLimitExceededError) {
      return {
        status: "rate_limit",
        code: error.code,
        message: "มีการส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
        requestId
      };
    }

    console.error(JSON.stringify({
      type: "admin_round_action_unexpected",
      action,
      requestId,
      durationMs: Math.round(performance.now() - startedAt),
      errorName: error instanceof Error ? error.name : "UnknownError"
    }));
    return {
      status: "unexpected",
      code: "UNEXPECTED_ERROR",
      message: `ระบบยังเปิดรอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หากยังพบปัญหาให้แจ้งรหัส ${requestId}`,
      requestId
    };
  }
}
