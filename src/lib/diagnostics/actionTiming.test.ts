import { afterEach, describe, expect, it, vi } from "vitest";
import { createActionTimer } from "./actionTiming";

describe("structured action timing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs only safe timing metadata", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const timer = createActionTimer("teacher.score email@example.test", {
      enabled: true,
      requestId: "request/id with spaces"
    });

    await timer.measure("atomic transaction", async () => "committed");
    timer.end("success");

    const entries = info.mock.calls.map(([entry]) => JSON.parse(String(entry)) as Record<string, unknown>);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      type: "action_timing",
      event: "block",
      action: "teacher.score_redacted",
      requestId: "request_id_with_spaces",
      block: "atomic_transaction"
    });
    expect(entries[1]).toMatchObject({
      type: "action_timing",
      event: "complete",
      result: "success"
    });
    expect(entries.every((entry) => typeof entry.durationMs === "number")).toBe(true);
    expect(JSON.stringify(entries)).not.toContain("comment");
    expect(JSON.stringify(entries)).not.toContain("points");
    expect(JSON.stringify(entries)).not.toContain("secret");
    expect(JSON.stringify(entries)).not.toContain("example.test");
  });

  it("does not log when timing is disabled", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const timer = createActionTimer("teacher.score", { enabled: false });

    await timer.measure("database", async () => undefined);
    timer.end();

    expect(info).not.toHaveBeenCalled();
  });
});
