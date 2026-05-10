import { describe, expect, it } from "vitest";
import { formatThaiDateTime24, formatThaiScheduleRange } from "./dateTime";

describe("Thai date/time formatting", () => {
  it("formats schedule ranges as 24-hour Thai time without AM/PM", () => {
    const start = new Date(2026, 4, 10, 9, 30);
    const end = new Date(2026, 4, 10, 10, 45);
    const formatted = formatThaiScheduleRange(start, end);

    expect(formatted).toContain("09:30");
    expect(formatted).toContain("10:45");
    expect(formatted).toContain("น.");
    expect(formatted).not.toMatch(/AM|PM|ก่อนเที่ยง|หลังเที่ยง/i);
  });

  it("formats a single timestamp as 24-hour Thai time", () => {
    const formatted = formatThaiDateTime24(new Date(2026, 4, 10, 14, 5));

    expect(formatted).toContain("14:05");
    expect(formatted).toContain("น.");
    expect(formatted).not.toMatch(/AM|PM|ก่อนเที่ยง|หลังเที่ยง/i);
  });
});
