import { describe, expect, it, vi } from "vitest";
import { prepareScheduleRecoveryReload } from "./StudentSchedulePostSubmitGuard";

describe("student schedule post-submit recovery", () => {
  it("reloads only after it saves a one-time marker", () => {
    const writeMarker = vi.fn();
    expect(prepareScheduleRecoveryReload({
      contentPresent: false,
      clearMarker: vi.fn(),
      readMarker: () => null,
      writeMarker
    })).toBe(true);
    expect(writeMarker).toHaveBeenCalledOnce();
  });

  it("does not reload when storage access is blocked", () => {
    expect(prepareScheduleRecoveryReload({
      contentPresent: false,
      clearMarker: vi.fn(),
      readMarker: () => {
        throw new DOMException("Blocked", "SecurityError");
      },
      writeMarker: vi.fn()
    })).toBe(false);
  });

  it("does not reload when the recovery marker cannot be saved", () => {
    expect(prepareScheduleRecoveryReload({
      contentPresent: false,
      clearMarker: vi.fn(),
      readMarker: () => null,
      writeMarker: () => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      }
    })).toBe(false);
  });

  it("does not reload again when a marker already exists", () => {
    expect(prepareScheduleRecoveryReload({
      contentPresent: false,
      clearMarker: vi.fn(),
      readMarker: () => "1",
      writeMarker: vi.fn()
    })).toBe(false);
  });
});
