import { describe, expect, it } from "vitest";
import { formatSpreadsheetValue, sanitizeSpreadsheetText } from "./spreadsheet";

describe("spreadsheet export sanitization", () => {
  const dangerous = [
    '=HYPERLINK("http://evil.test")',
    "+SUM(1,1)",
    "-10+20",
    "@cmd",
    "\t=HYPERLINK(\"http://evil.test\")",
    "\n=HYPERLINK(\"http://evil.test\")"
  ];

  it("prefixes formula-like strings with an apostrophe", () => {
    for (const value of dangerous) {
      expect(sanitizeSpreadsheetText(value)).toBe(`'${value}`);
    }
  });

  it("preserves normal text and non-string values", () => {
    expect(sanitizeSpreadsheetText("หัวข้อปกติ")).toBe("หัวข้อปกติ");
    expect(formatSpreadsheetValue(42)).toBe(42);
    expect(formatSpreadsheetValue(new Date("2026-05-09T00:00:00.000Z"))).toBe("2026-05-09T00:00:00.000Z");
  });
});
