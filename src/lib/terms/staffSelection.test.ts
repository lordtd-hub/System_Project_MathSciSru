import { describe, expect, it } from "vitest";
import { chooseStaffOffering, defaultStaffOffering } from "./staffSelection";
import { filterAcademicChoices, retainSelectedAcademicChoice } from "./academicChoices";
const course = (id: string, yearBe: number, termType: string, status = "ACTIVE") => ({ id, status, term: { id: `${yearBe}-${termType}`, termType, academicYear: { yearBe } } });
const old = course("old", 2569, "SEMESTER_1", "CLOSED");
const current = course("current", 2569, "SEMESTER_2");
describe("staff default and explicit historical context", () => {
  it("defaults to the new active term, including legacy plain-ID cookies", () => {
    expect(chooseStaffOffering([old, current])?.id).toBe("current");
    expect(chooseStaffOffering([old, current], old.id)?.id).toBe("current");
  });
  it("retains an explicitly selected old course during the same current term", () => {
    expect(chooseStaffOffering([old, current], old.id, current.id)?.id).toBe("old");
  });
  it("moves a stale context to a newly opened term, without hiding the old choice", () => {
    const next = course("next", 2570, "SEMESTER_1");
    expect(chooseStaffOffering([old, current, next], old.id, current.id)?.id).toBe("next");
    expect(chooseStaffOffering([old, current, next], old.id, next.id)?.id).toBe("old");
  });
  it("sorts by academic year/term rather than the date an old course was imported", () => {
    expect(defaultStaffOffering([course("z-old-imported-last", 2568, "SUMMER"), current])?.id).toBe("current");
    expect(defaultStaffOffering([current, course("summer", 2569, "SUMMER")])?.id).toBe("summer");
  });
  it("uses the latest closed term only when no offering is active", () => {
    expect(defaultStaffOffering([old, { ...current, status: "CLOSED" }])?.id).toBe("current");
  });
  it("does not honor a foreign/stale view ID and handles an empty list", () => {
    expect(chooseStaffOffering([old, current], "foreign", current.id)?.id).toBe("current");
    expect(chooseStaffOffering([], "foreign", current.id)).toBeNull();
  });
});
describe("many-year context filtering preserves the explicit selection", () => {
  const choices = [
    { id: "old", yearBe: 2568, label: "ภาคเรียนที่ 1 2568 SMA6002 N01" },
    { id: "current", yearBe: 2569, label: "ภาคเรียนที่ 2 2569 SMA6002 P01" },
    { id: "other", yearBe: 2569, label: "ภาคเรียนที่ 2 2569 SMA6003 P02" }
  ];
  it("filters by exact year and all case-insensitive search words", () => {
    expect(filterAcademicChoices(choices, "2569", "sma6002 p01").map(c => c.id)).toEqual(["current"]);
    expect(filterAcademicChoices(choices, "2568", "SMA6002").map(c => c.id)).toEqual(["old"]);
  });
  it("does not silently switch courses when search/year hides the selected item", () => {
    const filtered = filterAcademicChoices(choices, "2568", "");
    expect(retainSelectedAcademicChoice(choices, filtered, "current")?.id).toBe("current");
    expect(retainSelectedAcademicChoice(choices, [], "current")?.id).toBe("current");
  });
  it("never introduces a choice outside the server-authorized list", () => {
    expect(retainSelectedAcademicChoice(choices, [], "foreign")).toBeNull();
    expect(retainSelectedAcademicChoice(choices, choices, "current")).toBeNull();
  });
});
