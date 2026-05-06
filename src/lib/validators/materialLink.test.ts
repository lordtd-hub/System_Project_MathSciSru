import { describe, expect, it } from "vitest";
import { isAllowedMaterialLink, validateMaterialLink } from "./materialLink";

describe("validateMaterialLink", () => {
  it("allows approved Google domains over https", () => {
    expect(isAllowedMaterialLink("https://drive.google.com/file/d/123")).toBe(true);
    expect(isAllowedMaterialLink("https://docs.google.com/document/d/123")).toBe(true);
    expect(isAllowedMaterialLink("https://classroom.google.com/c/123")).toBe(true);
  });

  it("rejects non-approved domains and non-https links", () => {
    expect(validateMaterialLink("https://example.com/doc").ok).toBe(false);
    expect(validateMaterialLink("http://drive.google.com/file/d/123").ok).toBe(false);
  });
});
