import * as React from "react";
import { ProjectStatus } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { lifecyclePhases } from "@/lib/lifecycle/statusLabels";
import { CompactLifecycleBadge, lifecycleStepPosition } from "./LifecycleStepper";

vi.stubGlobal("React", React);

describe("lifecycle step position", () => {
  it("places Proposal revision in the decision/revision phase instead of falling back to step one", () => {
    expect(lifecycleStepPosition("PROPOSAL_REVISION_REQUIRED")).toEqual({ current: 7, total: 14 });
  });

  it("moves forward through the authoritative Lifecycle v2 happy path", () => {
    const path = [
      "STUDENT_PROFILE",
      "DRAFT",
      "PENDING_ADVISOR",
      "PENDING_ADMIN",
      "PROPOSAL_PENDING",
      "PROPOSAL_REVIEW",
      "PROPOSAL_ADMIN_DECISION",
      "TOPIC_APPROVED",
      "IN_PROGRESS",
      "FINAL_DONE",
      "REPORT_REVIEW",
      "REPORT_APPROVED",
      "ADVISOR_SCORING",
      "COMPLETED"
    ] as const;

    expect(path.map((status) => lifecycleStepPosition(status).current)).toEqual(
      Array.from({ length: 14 }, (_, index) => index + 1)
    );
  });

  it("keeps revision in the decision phase and restarts a failed Proposal at the draft phase", () => {
    expect(lifecycleStepPosition("PROPOSAL_ADMIN_DECISION").current).toBe(7);
    expect(lifecycleStepPosition("PROPOSAL_REVISION_REQUIRED").current).toBe(7);
    expect(lifecycleStepPosition("DRAFT").current).toBe(2);
  });

  it("never falls back to step one for a known legacy status", () => {
    for (const status of Object.values(ProjectStatus)) {
      const position = lifecycleStepPosition(status);
      expect(position.current, status).toBeGreaterThanOrEqual(1);
      expect(position.current, status).toBeLessThanOrEqual(position.total);
    }
    expect(lifecycleStepPosition("REPROPOSAL_UNDER_REVIEW").current).toBe(6);
    expect(lifecycleStepPosition("READY_FOR_FINAL").current).toBe(10);
  });

  it("maps every ProjectStatus to exactly one phase and keeps the number aligned with that phase", () => {
    const mappedStatuses = lifecyclePhases.flatMap((phase) => [...phase.statuses]);
    const knownStatuses = Object.values(ProjectStatus);

    expect(new Set(mappedStatuses).size).toBe(mappedStatuses.length);
    expect([...mappedStatuses].sort()).toEqual([...knownStatuses].sort());
    lifecyclePhases.forEach((phase, index) => {
      phase.statuses.forEach((status) => {
        expect(lifecycleStepPosition(status).current, status).toBe(index + 1);
      });
    });
  });

  it("keeps Re-proposal in the Proposal phases and advances after it passes", () => {
    expect(lifecycleStepPosition("COMMITTEE_ASSIGNED_FOR_REPROPOSAL").current).toBe(5);
    expect(lifecycleStepPosition("REPROPOSAL_SUBMITTED").current).toBe(6);
    expect(lifecycleStepPosition("REPROPOSAL_UNDER_REVIEW").current).toBe(6);
    expect(lifecycleStepPosition("REPROPOSAL_FAILED").current).toBe(7);
    expect(lifecycleStepPosition("REPROPOSAL_PASSED").current).toBe(8);
  });

  it("labels the value as a lifecycle step instead of looking like a score", () => {
    const html = renderToStaticMarkup(React.createElement(CompactLifecycleBadge, { status: "PROPOSAL_REVISION_REQUIRED" }));
    expect(html).toContain("ขั้นที่");
    expect(html).toContain(">7<");
    expect(html).toContain("/ 14");
  });
});
