import { describe, expect, it, vi } from "vitest";
import { retryScoreTransaction } from "./transactionRetry";

describe("score transaction retry", () => {
  it.each(["40001", "40P01"])("retries an aborted raw-query transaction (%s)", async code => {
    const operation = vi.fn().mockRejectedValueOnce({ code: "P2010", meta: { code } }).mockResolvedValueOnce("committed");
    await expect(retryScoreTransaction(operation)).resolves.toBe("committed");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not replay a raw query with an unrelated SQLSTATE", async () => {
    const failure = { code: "P2010", meta: { code: "42501" } };
    const operation = vi.fn().mockRejectedValue(failure);
    await expect(retryScoreTransaction(operation)).rejects.toEqual(failure);
    expect(operation).toHaveBeenCalledTimes(1);
  });
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
