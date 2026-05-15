import { describe, expect, it } from "vitest";
import { isQaAunEvidenceAlignmentEnabled } from "./finalRubricConfig";

describe("final AUN evidence alignment QA flag", () => {
  it("locks AUN alignment out on normal production deployment", () => {
    expect(isQaAunEvidenceAlignmentEnabled({ ENABLE_QA_AUN_EVIDENCE_ALIGNMENT: "1", NODE_ENV: "production", VERCEL_ENV: "production" })).toBe(false);
  });

  it("enables AUN alignment in preview when the flag is set", () => {
    expect(isQaAunEvidenceAlignmentEnabled({ ENABLE_QA_AUN_EVIDENCE_ALIGNMENT: "1", NODE_ENV: "production", VERCEL_ENV: "preview" })).toBe(true);
  });
});
