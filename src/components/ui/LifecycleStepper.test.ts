import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CompactLifecycleBadge, lifecycleStepPosition } from "./LifecycleStepper";

vi.stubGlobal("React", React);

describe("lifecycle step position", () => {
  it("places Proposal revision in the decision/revision phase instead of falling back to step one", () => {
    expect(lifecycleStepPosition("PROPOSAL_REVISION_REQUIRED")).toEqual({ current: 7, total: 10 });
  });

  it("keeps approved and active projects after the Proposal phase", () => {
    expect(lifecycleStepPosition("TOPIC_APPROVED")).toEqual({ current: 8, total: 10 });
    expect(lifecycleStepPosition("IN_PROGRESS")).toEqual({ current: 9, total: 10 });
  });

  it("labels the value as a lifecycle step instead of looking like a score", () => {
    const html = renderToStaticMarkup(React.createElement(CompactLifecycleBadge, { status: "PROPOSAL_REVISION_REQUIRED" }));
    expect(html).toContain("ขั้นที่");
    expect(html).toContain(">7<");
    expect(html).toContain("/ 10");
  });
});
