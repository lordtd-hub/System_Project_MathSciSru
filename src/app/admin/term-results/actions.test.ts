import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), close: vi.fn(), set: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.set }) }));
vi.mock("@/lib/terms/selection", () => ({ COURSE_OFFERING_COOKIE: "selected-course-offering", getCourseOfferingChoices: async () => [{ id: "other-active", status: "ACTIVE", term: { id: "current-term", termType: "SEMESTER_2", academicYear: { yearBe: 2569 } } }] }));
vi.mock("@/lib/security/rateLimit", () => ({ assertRateLimit: vi.fn(), pilotRateLimits: { workflowMutation: {} } }));
vi.mock("@/lib/terms/incomplete", () => ({ closeOfferingWithIncomplete: mocks.close, openIncompleteContinuation: vi.fn(), resolveIncomplete: vi.fn() }));
import { closeAcademicOffering } from "./actions";
function reviewedForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries({ offering_id: "reviewed-old-course", project_ids: '["old-i","completed"]', unfinished_ids: '["old-i"]', result_old_i: "I", "result_old-i": "I", "reason_old-i": "more time", reason: "course close", reference: "confirmed-results", confirmed: "on" })) form.set(key, value);
  return form;
}
describe("course closure keeps the reviewed academic context", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "admin", role: "ADMIN" } }); mocks.close.mockResolvedValue({ unchanged: false }); });
  it("pins the committed old course instead of falling through to another ACTIVE offering", async () => {
    expect((await closeAcademicOffering({ status: "idle", message: "" }, reviewedForm())).status).toBe("success");
    expect(mocks.close).toHaveBeenCalledWith({}, expect.objectContaining({ offeringId: "reviewed-old-course", decisions: [{ projectId: "old-i", grade: "I", reason: "more time" }] }));
    expect(mocks.set).toHaveBeenCalledWith("selected-course-offering", "reviewed-old-course", expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }));
    expect(mocks.close.mock.invocationCallOrder[0]).toBeLessThan(mocks.set.mock.invocationCallOrder[0]);
    expect(mocks.set).toHaveBeenCalledWith("selected-admin-course-anchor", "other-active", expect.objectContaining({ httpOnly: true, sameSite: "lax" }));
  });
  it("does not pin a course after a failed or stale closure", async () => {
    mocks.close.mockRejectedValueOnce(new Error("stale roster"));
    expect((await closeAcademicOffering({ status: "idle", message: "" }, reviewedForm())).status).toBe("error");
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("does not close or select another course for an unauthorized actor", async () => {
    mocks.auth.mockResolvedValueOnce({ user: { id: "teacher", role: "TEACHER" } });
    expect((await closeAcademicOffering({ status: "idle", message: "" }, reviewedForm())).status).toBe("error");
    expect(mocks.close).not.toHaveBeenCalled(); expect(mocks.set).not.toHaveBeenCalled();
  });
});
