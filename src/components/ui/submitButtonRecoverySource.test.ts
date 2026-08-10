import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("submit button recovery source", () => {
  it("automatically reloads a long-running pending submit without resubmitting", () => {
    const source = readFileSync(join(process.cwd(), "src/components/ui/SubmitButton.tsx"), "utf8");

    expect(source).toContain("SUBMIT_AUTO_RECOVERY_DELAY_MS = 15_000");
    expect(source).toContain("window.setTimeout(() => window.location.reload(), SUBMIT_AUTO_RECOVERY_DELAY_MS)");
    expect(source).toContain('type="submit"');
    expect(source).toContain("disabled={disabled || pending}");
    expect(source).not.toContain("ตรวจสอบสถานะล่าสุด");
  });
});
