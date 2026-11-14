import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ user: vi.fn(), teacher: vi.fn(), offerings: vi.fn(), cookie: vi.fn() }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "teacher-user" } }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mock.cookie }) }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: mock.user }, teacher: { findUnique: mock.teacher }, courseOffering: { findMany: mock.offerings } } }));
import { getTeacherOfferingChoices, selectedTeacherOfferingId } from "./teacherSelection";
const current = { id: "current", status: "ACTIVE", courseCode: "SMA6002", section: "P01", term: { id: "new-term", termType: "SEMESTER_2", academicYear: { yearBe: 2569 } }, _count: { projects: 1 } };
describe("teacher work stays in related ACTIVE course", () => {
  beforeEach(() => { vi.clearAllMocks(); mock.user.mockResolvedValue({ active: true, globalRole: "TEACHER" }); mock.teacher.mockResolvedValue({ id: "teacher", active: true }); mock.cookie.mockReturnValue(undefined); });
  it("never falls back to old work when no course is ACTIVE", async () => {
    mock.offerings.mockResolvedValue([]);
    expect((await getTeacherOfferingChoices("teacher-user")).selected).toBeNull();
    expect(await selectedTeacherOfferingId()).toBe("__no_related_active_offering__");
  });
  it("shows current context but no work when the teacher has no current assignment", async () => {
    mock.offerings.mockResolvedValueOnce([current]).mockResolvedValueOnce([]);
    expect(await getTeacherOfferingChoices("teacher-user")).toEqual({ offerings: [], current, selected: null });
  });
  it("ignores old/foreign context cookies and queries only related ACTIVE IDs", async () => {
    mock.cookie.mockReturnValue({ value: "old-closed" });
    mock.offerings.mockResolvedValueOnce([current]).mockResolvedValueOnce([current]);
    expect((await getTeacherOfferingChoices("teacher-user")).selected?.id).toBe(current.id);
    expect(mock.offerings.mock.calls[0][0].where).toEqual({ status: "ACTIVE" });
    expect(mock.offerings.mock.calls[1][0].where.id).toEqual({ in: [current.id] });
    expect(mock.offerings.mock.calls[1][0].where.projects.some.OR).toEqual(expect.arrayContaining([
      { committeeAssignments: { some: { teacherId: "teacher", active: true } } }
    ]));
  });
  it.each([{ active: false, globalRole: "TEACHER" }, { active: true, globalRole: "STUDENT" }])("denies revoked or wrong role: %j", async user => {
    mock.user.mockResolvedValue(user);
    expect((await getTeacherOfferingChoices("teacher-user")).selected).toBeNull(); expect(mock.offerings).not.toHaveBeenCalled();
  });
  it("does not use an inactive teacher profile even with old assignments", async () => {
    mock.teacher.mockResolvedValue({ id: "teacher", active: false }); mock.offerings.mockResolvedValue([current]);
    expect((await getTeacherOfferingChoices("teacher-user")).selected).toBeNull();
  });
});
