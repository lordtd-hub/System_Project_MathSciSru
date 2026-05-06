import { describe, expect, it } from "vitest";
import { isAdminTestingToolsEnabled } from "@/lib/admin/testingMode";

describe("admin testing tools gate", () => {
  it("is disabled unless explicitly enabled", () => {
    expect(isAdminTestingToolsEnabled({})).toBe(false);
    expect(isAdminTestingToolsEnabled({ ENABLE_ADMIN_TEST_TOOLS: "0" })).toBe(false);
  });

  it("is enabled only with ENABLE_ADMIN_TEST_TOOLS=1", () => {
    expect(isAdminTestingToolsEnabled({ ENABLE_ADMIN_TEST_TOOLS: "1" })).toBe(true);
  });
});
