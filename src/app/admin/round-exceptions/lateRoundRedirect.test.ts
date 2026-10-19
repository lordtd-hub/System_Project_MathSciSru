import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
  project: { findUniqueOrThrow: vi.fn() },
  assessmentRound: { findUniqueOrThrow: vi.fn() },
  projectRoundException: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  projectTimelineEvent: { create: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn()
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ prisma: mocks }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/security/rateLimit", () => ({ assertRateLimit: vi.fn(), pilotRateLimits: { workflowMutation: {} } }));
import { openLateRoundSubmissionForProject } from "../actions";

function form(roundType: string, returnTo = "/admin/round-exceptions") {
  const data = new FormData();
  data.set("project_id", "project-1");
  data.set("round_type", roundType);
  data.set("return_to", returnTo);
  data.set("reason", "Approved recovery");
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
  mocks.project.findUniqueOrThrow.mockResolvedValue({ id: "project-1", courseOfferingId: "course-1", student: { studentCode: "test" } });
  mocks.projectRoundException.findFirst.mockResolvedValue(null);
  mocks.projectRoundException.create.mockResolvedValue({ id: "exception-1" });
});

describe.each(["PROPOSAL", "PROGRESS_1", "PROGRESS_2", "FINAL_PRESENTATION"])("late exception redirect: %s", (roundType) => {
  it("preserves the round after saving only the requested project's exception", async () => {
    mocks.assessmentRound.findUniqueOrThrow.mockResolvedValue({ id: "round-1", roundType, status: "SCORING_CLOSED" });
    await expect(openLateRoundSubmissionForProject(form(roundType))).rejects.toThrow(`REDIRECT:/admin/round-exceptions?round_type=${roundType}&success=late_round_opened`);
    expect(mocks.projectRoundException.create).toHaveBeenCalledTimes(1);
    expect(mocks.projectRoundException.create).toHaveBeenCalledWith({ data: expect.objectContaining({ projectId: "project-1", assessmentRoundId: "round-1", exceptionType: "LATE_ASSESSMENT_ROUND" }) });
  });
  it("preserves the round on the closed-round validation error without writing", async () => {
    mocks.assessmentRound.findUniqueOrThrow.mockResolvedValue({ id: "round-1", roundType, status: "SCORING_OPEN" });
    await expect(openLateRoundSubmissionForProject(form(roundType))).rejects.toThrow(`REDIRECT:/admin/round-exceptions?round_type=${roundType}&error=late_round_requires_closed_round`);
    expect(mocks.projectRoundException.create).not.toHaveBeenCalled();
    expect(mocks.projectRoundException.update).not.toHaveBeenCalled();
  });
});

it("rejects non-Admin callers before database access", async () => {
  mocks.auth.mockResolvedValue({ user: { id: "student-1", role: "STUDENT" } });
  await expect(openLateRoundSubmissionForProject(form("PROGRESS_2"))).rejects.toThrow("ไม่อนุญาตให้เข้าถึง");
  expect(mocks.project.findUniqueOrThrow).not.toHaveBeenCalled();
});

it("keeps arbitrary return destinations on the allowed rounds overview", async () => {
  mocks.assessmentRound.findUniqueOrThrow.mockResolvedValue({ id: "round-1", roundType: "PROGRESS_2", status: "SCORING_OPEN" });
  await expect(openLateRoundSubmissionForProject(form("PROGRESS_2", "https://example.com"))).rejects.toThrow("REDIRECT:/admin/rounds?error=late_round_requires_closed_round");
});
