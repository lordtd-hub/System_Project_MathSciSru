import { describe, expect, it } from "vitest";
import { formatThaiDate, formatThaiDateTime24, formatThaiScheduleRange, THAI_TIME_ZONE } from "./dateTime";

describe("Thai date/time formatting", () => {
  it("uses the Bangkok timezone for stored UTC instants", () => {
    const formatted = formatThaiDateTime24(new Date("2026-05-06T07:00:00.000Z"));

    expect(THAI_TIME_ZONE).toBe("Asia/Bangkok");
    expect(formatted).toContain("14:00");
    expect(formatted).toContain("\u0e19.");
  });

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
  it("formats date-only values in the Bangkok timezone", () => {
    const formatted = formatThaiDate(new Date("2026-05-06T17:30:00.000Z"));

    expect(formatted).toContain("07");
  });
});
