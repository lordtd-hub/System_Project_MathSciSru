import { describe, expect, it, vi } from "vitest";
import { retryScoreTransaction } from "./transactionRetry";

describe("score transaction retry", () => {
  it("retries a serialization conflict and returns the committed result", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce({ code: "P2034" })
      .mockResolvedValueOnce("committed");
    await expect(retryScoreTransaction(operation)).resolves.toBe("committed");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry unrelated infrastructure errors", async () => {
    const operation = vi.fn().mockRejectedValue({ code: "P1001" });
    await expect(retryScoreTransaction(operation)).rejects.toEqual({ code: "P1001" });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("stops after the bounded retry count", async () => {
    const operation = vi.fn().mockRejectedValue({ code: "P2034" });
    await expect(retryScoreTransaction(operation, 3)).rejects.toEqual({ code: "P2034" });
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
