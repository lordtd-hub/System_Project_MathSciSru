import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ProposalLifecycleActionResult } from "@/lib/proposals/proposalLifecycleActionResult";
import { AdminProposalDecisionForm } from "./AdminProposalDecisionForm";

vi.mock("./ProposalLifecycleActionForm", async () => {
  const { createElement } = await import("react");
  return {
    ProposalLifecycleActionForm: ({ children, className }: { children: ReactNode; className?: string }) =>
      createElement("form", { className }, children)
  };
});

vi.mock("./SubmitButton", async () => {
  const { createElement } = await import("react");
  return {
    SubmitButton: ({ children, disabled, className }: { children: ReactNode; disabled?: boolean; className?: string }) =>
      createElement("button", { type: "submit", disabled, className }, children)
  };
});

const action = async (): Promise<ProposalLifecycleActionResult> => ({ status: "idle" });

function decisionForm(formInstance: "mobile" | "desktop", attemptId: string, missingScoreCount = 0) {
  return createElement(AdminProposalDecisionForm, {
    action,
    attemptId,
    formInstance,
    studentLabel: "6604302001031 นักศึกษาทดสอบ",
    isEditing: false,
    missingScoreCount
  });
}

describe("AdminProposalDecisionForm", () => {
  it("renders unique control IDs for simultaneous mobile and desktop forms", () => {
    const html = renderToStaticMarkup(createElement(
      Fragment,
      null,
      decisionForm("mobile", "attempt-1"),
      decisionForm("desktop", "attempt-1")
    ));

    expect(html).toContain('id="proposal-decision-mobile-attempt-1"');
    expect(html).toContain('id="proposal-decision-desktop-attempt-1"');
    expect(html.match(/id="proposal-decision-mobile-attempt-1"/g)).toHaveLength(1);
    expect(html.match(/id="proposal-decision-desktop-attempt-1"/g)).toHaveLength(1);
  });

  it("starts undecided with submission disabled", () => {
    const html = renderToStaticMarkup(decisionForm("desktop", "attempt-2", 2));

    expect(html).toContain("เลือกมติสุดท้าย");
    expect(html).toContain("คะแนนยังขาด 2 คน");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>ยืนยันมติสุดท้าย<\/button>/);
  });
});
