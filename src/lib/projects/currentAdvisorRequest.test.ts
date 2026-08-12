import { describe, expect, it } from "vitest";
import { currentApprovedAdvisorTeacherId, isCurrentAdvisorRequestReviewable } from "./currentAdvisorRequest";

const pending = { id: "request-new", advisorTeacherId: "teacher-1", status: "PENDING" as const };

describe("current advisor request rules", () => {
  it("allows only the latest pending request while the project waits for an advisor", () => {
    expect(isCurrentAdvisorRequestReviewable({
      request: pending,
      latestRequestId: pending.id,
      actorTeacherId: pending.advisorTeacherId,
      projectStatus: "PENDING_ADVISOR"
    })).toBe(true);
  });

  it.each([
    { latestRequestId: "request-other", actorTeacherId: "teacher-1", projectStatus: "PENDING_ADVISOR" as const },
    { latestRequestId: "request-new", actorTeacherId: "teacher-2", projectStatus: "PENDING_ADVISOR" as const },
    { latestRequestId: "request-new", actorTeacherId: "teacher-1", projectStatus: "TOPIC_APPROVED" as const }
  ])("rejects stale advisor request context %#", (context) => {
    expect(isCurrentAdvisorRequestReviewable({ request: pending, ...context })).toBe(false);
  });

  it("uses only the latest request when resolving the committee advisor", () => {
    expect(currentApprovedAdvisorTeacherId({ ...pending, status: "APPROVED" })).toBe("teacher-1");
    expect(currentApprovedAdvisorTeacherId(pending)).toBeNull();
    expect(currentApprovedAdvisorTeacherId(null)).toBeNull();
  });
});
