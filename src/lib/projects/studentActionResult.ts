import { randomUUID } from "node:crypto";
import { RateLimitExceededError } from "@/lib/security/rateLimit";

type StudentActionBase = { code: string; message: string; requestId: string };

export type StudentActionResult =
  | { status: "idle" }
  | (StudentActionBase & { status: "success"; unchanged: boolean })
  | (StudentActionBase & { status: "validation"; missingFields: string[] })
  | (StudentActionBase & { status: "conflict" })
  | (StudentActionBase & { status: "rate_limit" })
  | (StudentActionBase & { status: "unexpected" });

export const idleStudentActionResult: StudentActionResult = { status: "idle" };

export class StudentActionValidationError extends Error {
  constructor(readonly code: string, message: string, readonly missingFields: string[] = []) {
    super(message);
    this.name = "StudentActionValidationError";
  }
}

export class StudentActionConflictError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "StudentActionConflictError";
  }
}

export function studentActionSuccess(
  requestId: string,
  code: string,
  message: string,
  unchanged: boolean
): StudentActionResult {
  return { status: "success", code, message, requestId, unchanged };
}

export async function runStudentAction(
  action: string,
  operation: (requestId: string) => Promise<StudentActionResult>
): Promise<StudentActionResult> {
  const requestId = randomUUID();
  const startedAt = performance.now();
  try {
    return await operation(requestId);
  } catch (error) {
    if (error instanceof StudentActionValidationError) {
      return { status: "validation", code: error.code, message: error.message, requestId, missingFields: error.missingFields };
    }
    if (error instanceof StudentActionConflictError) {
      return { status: "conflict", code: error.code, message: error.message, requestId };
    }
    if (error instanceof RateLimitExceededError) {
      return {
        status: "rate_limit",
        code: error.code,
        message: "ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่ โดยข้อมูลที่กรอกไว้ยังอยู่ครบ",
        requestId
      };
    }

    const durationMs = Math.round(performance.now() - startedAt);
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error(JSON.stringify({ type: "student_action_unexpected", action, requestId, durationMs, errorName }));
    return {
      status: "unexpected",
      code: "UNEXPECTED_ERROR",
      message: `ระบบยังบันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หากยังพบปัญหาให้แจ้งรหัส ${requestId}`,
      requestId
    };
  }
}
