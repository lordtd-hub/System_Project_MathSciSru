import { RateLimitExceededError } from "@/lib/security/rateLimit";
import { ScorePersistenceConflict } from "./persistPresentationScore";
import { isRetryableScoreTransactionError } from "./transactionRetry";
import type { TeacherScoreActionResult } from "./teacherScoreActionResult";

export function classifyExpectedScoreActionError(
  error: unknown,
  requestId: string
): TeacherScoreActionResult | null {
  if (error instanceof ScorePersistenceConflict) {
    return { status: "conflict", code: error.code, requestId };
  }
  if (error instanceof RateLimitExceededError) {
    return { status: "rate_limit", code: "teacher_score_rate_limited", requestId };
  }
  if (isRetryableScoreTransactionError(error)) {
    return { status: "conflict", code: "score_concurrent_update", requestId };
  }
  if (
    error
    && typeof error === "object"
    && "code" in error
    && error.code === "P2010"
    && "meta" in error
    && error.meta
    && typeof error.meta === "object"
    && "code" in error.meta
    && error.meta.code === "55P03"
  ) {
    return { status: "conflict", code: "score_concurrent_update", requestId };
  }
  return null;
}
