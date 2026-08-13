import { describe, expect, it } from "vitest";
import {
  proposalDecisionConfirmation,
  proposalDecisionEditBlockReason,
  proposalDecisionGuidance,
  proposalDecisionRequiresReason
} from "./proposalDecisionPresentation";

describe("Admin Proposal decision presentation", () => {
  it("requires a reason only for revision and not-pass decisions", () => {
    expect(proposalDecisionRequiresReason("")).toBe(false);
    expect(proposalDecisionRequiresReason("PASS")).toBe(false);
    expect(proposalDecisionRequiresReason("PASS_WITH_REVISION")).toBe(true);
    expect(proposalDecisionRequiresReason("NOT_PASS")).toBe(true);
  });

  it("explains the distinct lifecycle consequence of each decision", () => {
    expect(proposalDecisionGuidance("PASS")).toContain("แต่งตั้งกรรมการ");
    expect(proposalDecisionGuidance("PASS_WITH_REVISION")).toContain("โดยไม่สอบใหม่");
    expect(proposalDecisionGuidance("NOT_PASS")).toContain("เลือกที่ปรึกษาใหม่");
    expect(proposalDecisionGuidance("")).toContain("เลือกมติ");
  });

  it("names the student and exact consequence in confirmation text", () => {
    const notPass = proposalDecisionConfirmation({
      decision: "NOT_PASS",
      studentLabel: "6604302001031 ภิญโญ สินสัจธรรม",
      isEditing: false
    });
    const revision = proposalDecisionConfirmation({
      decision: "PASS_WITH_REVISION",
      studentLabel: "6604302001031 ภิญโญ สินสัจธรรม",
      isEditing: true
    });

    expect(notPass).toContain("6604302001031");
    expect(notPass).toContain("สอบใหม่");
    expect(revision).toContain("แก้ไขมติ");
    expect(revision).toContain("โดยไม่สอบใหม่");
  });

  it("blocks controls for immutable decisions and active committees", () => {
    expect(proposalDecisionEditBlockReason({
      finalDecision: "NOT_PASS",
      projectStatus: "DRAFT",
      submissionStatus: "LOCKED",
      hasActiveCommittee: false
    })).toContain("มติไม่ผ่านถูกล็อก");
    expect(proposalDecisionEditBlockReason({
      finalDecision: "PASS",
      projectStatus: "TOPIC_APPROVED",
      submissionStatus: "LOCKED",
      hasActiveCommittee: true
    })).toContain("แต่งตั้งกรรมการแล้ว");
  });

  it("keeps valid undecided and editable decision states available", () => {
    expect(proposalDecisionEditBlockReason({
      projectStatus: "PROPOSAL_ADMIN_DECISION",
      submissionStatus: "SUBMITTED",
      hasActiveCommittee: false
    })).toBeNull();
    expect(proposalDecisionEditBlockReason({
      finalDecision: "PASS",
      projectStatus: "TOPIC_APPROVED",
      submissionStatus: "LOCKED",
      hasActiveCommittee: false
    })).toBeNull();
    expect(proposalDecisionEditBlockReason({
      finalDecision: "PASS_WITH_REVISION",
      projectStatus: "PROPOSAL_REVISION_REQUIRED",
      submissionStatus: "RETURNED_FOR_REVISION",
      hasActiveCommittee: false
    })).toBeNull();
  });
});
