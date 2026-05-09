import { describe, expect, it } from "vitest";
import { assertTextSize, textByteLength } from "./requestSize";

describe("request size guards", () => {
  it("accepts normal payloads", () => {
    expect(() => assertTextSize("ข้อความปกติ", 1_000, "comment")).not.toThrow();
  });

  it("rejects oversized payloads", () => {
    expect(() => assertTextSize("x".repeat(11), 10, "comment")).toThrow("comment");
  });

  it("measures UTF-8 byte size for Thai text", () => {
    expect(textByteLength("ก")).toBeGreaterThan(1);
  });
});
