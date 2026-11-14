export function isRetryableScoreTransactionError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  if (error.code === "P2034") return true;
  // Prisma raw row locks surface PostgreSQL transaction aborts as P2010.
  // These SQLSTATEs guarantee the whole transaction was aborted, so replaying
  // the transaction is safe. Never retry arbitrary query or network errors.
  if (error.code !== "P2010" || !("meta" in error) || !error.meta || typeof error.meta !== "object") return false;
  return "code" in error.meta && (error.meta.code === "40001" || error.meta.code === "40P01");
}

export async function retryScoreTransaction<T>(operation: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let attempt = 0;
  while (true) {
    attempt += 1;
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableScoreTransactionError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 25));
    }
  }
}
