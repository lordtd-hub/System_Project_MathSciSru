import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { chooseStudentProject } from "./selection";

describe("cross-term student selection", () => {
  const projects = [{ id: "new-P01", academicResult: null }, { id: "old-N01", academicResult: { status: "INCOMPLETE" } }, { id: "old-completed", academicResult: null }];
  it("keeps unresolved old-term I discoverable by default after new enrollment", () => {
    expect(chooseStudentProject(projects)?.id).toBe("old-N01");
  });
  it("lets the student explicitly choose each owned historical or new project", () => {
    expect(chooseStudentProject(projects, "new-P01")?.id).toBe("new-P01");
    expect(chooseStudentProject(projects, "old-completed")?.id).toBe("old-completed");
  });
  it("does not expose a foreign ID supplied in a cookie", () => {
    expect(chooseStudentProject(projects, "someone-else")?.id).toBe("old-N01");
    expect(chooseStudentProject([], "someone-else")).toBeNull();
  });
});
