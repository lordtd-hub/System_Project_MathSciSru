export function isRetryableScoreTransactionError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2034");
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
