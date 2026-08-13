import { randomUUID } from "node:crypto";
import { RateLimitExceededError } from "@/lib/security/rateLimit";

type ProposalLifecycleActionBase = {
  code: string;
  message: string;
  requestId: string;
};

export type ProposalLifecycleActionResult =
  | { status: "idle" }
  | (ProposalLifecycleActionBase & { status: "success"; unchanged: boolean })
  | (ProposalLifecycleActionBase & { status: "validation"; fields: string[] })
  | (ProposalLifecycleActionBase & { status: "conflict" })
  | (ProposalLifecycleActionBase & { status: "rate_limit" })
  | (ProposalLifecycleActionBase & { status: "unexpected" });

export const idleProposalLifecycleActionResult: ProposalLifecycleActionResult = { status: "idle" };

export class ProposalLifecycleValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fields: string[] = []
  ) {
    super(message);
    this.name = "ProposalLifecycleValidationError";
  }
}

export class ProposalLifecycleConflictError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "ProposalLifecycleConflictError";
  }
}

export async function runProposalLifecycleAction(
  action: string,
  operation: (requestId: string) => Promise<ProposalLifecycleActionResult>
): Promise<ProposalLifecycleActionResult> {
  const requestId = randomUUID();
  const startedAt = performance.now();

  try {
    return await operation(requestId);
  } catch (error) {
    if (error instanceof ProposalLifecycleValidationError) {
      return {
        status: "validation",
        code: error.code,
        message: error.message,
        requestId,
        fields: error.fields
      };
    }
    if (error instanceof ProposalLifecycleConflictError) {
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
        message: "มีการส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่ โดยข้อมูลที่กรอกไว้ยังอยู่ครบ",
        requestId
      };
    }

    console.error(JSON.stringify({
      type: "proposal_lifecycle_action_unexpected",
      action,
      requestId,
      durationMs: Math.round(performance.now() - startedAt),
      errorName: error instanceof Error ? error.name : "UnknownError"
    }));
    return {
      status: "unexpected",
      code: "UNEXPECTED_ERROR",
      message: `ระบบยังบันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หากยังพบปัญหาให้แจ้งรหัส ${requestId}`,
      requestId
    };
  }
}
