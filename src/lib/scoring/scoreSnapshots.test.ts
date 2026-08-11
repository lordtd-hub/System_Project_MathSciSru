import { describe, expect, it } from "vitest";
import {
  normalizeTeacherScoreSnapshot,
  readTeacherScoreSnapshot,
  teacherScoreSnapshotsEqual,
  type TeacherScoreSnapshot
} from "./scoreSnapshots";

const snapshot: TeacherScoreSnapshot = {
  totalScore: 70,
  overallComment: " ตรวจแล้ว ",
  items: [
    { rubricItemId: "b", itemKey: "B", checked: false, pointsAwarded: 0, conditionCount: 1 },
    { rubricItemId: "a", itemKey: "A", checked: true, pointsAwarded: 70, conditionCount: 3 }
  ]
};

describe("teacher score snapshots", () => {
  it("normalizes ordering and text before comparing retries", () => {
    const retry = {
      ...snapshot,
      overallComment: "ตรวจแล้ว",
      items: [...snapshot.items].reverse()
    };
    expect(teacherScoreSnapshotsEqual(snapshot, retry)).toBe(true);
  });

  it("treats an altered rubric selection with the same total as a revision", () => {
    const changed = {
      ...snapshot,
      items: snapshot.items.map((item) => item.rubricItemId === "b" ? { ...item, conditionCount: 0 } : item)
    };
    expect(teacherScoreSnapshotsEqual(snapshot, changed)).toBe(false);
  });

  it("reads only complete snapshots from audit JSON", () => {
    expect(readTeacherScoreSnapshot(normalizeTeacherScoreSnapshot(snapshot))).toEqual(normalizeTeacherScoreSnapshot(snapshot));
    expect(readTeacherScoreSnapshot({ totalScore: 70, items: [{ rubricItemId: "a" }] })).toBeNull();
  });
});
