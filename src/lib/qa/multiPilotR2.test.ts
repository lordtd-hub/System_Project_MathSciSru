import { describe, expect, it } from "vitest";
import {
  getMultiPilotR2ScenarioCounts,
  getMultiPilotR2TeacherRoleSummary,
  multiPilotR2Projects,
  multiPilotR2Students,
  multiPilotR2Teachers
} from "./multiPilotR2";

describe("MULTI-PILOT-R2 QA data design", () => {
  it("generates the expected synthetic user and project counts", () => {
    expect(multiPilotR2Students).toHaveLength(40);
    expect(multiPilotR2Teachers).toHaveLength(11);
    expect(multiPilotR2Projects).toHaveLength(40);
  });

  it("covers all planned scenario categories", () => {
    expect(getMultiPilotR2ScenarioCounts()).toEqual({
      "Happy Path": 10,
      "Delayed Submission": 8,
      "Missing Evidence": 6,
      "Schedule Rejection": 6,
      "Report Revision Loop": 6,
      "Queue/Conflict Stress": 4
    });
  });

  it("avoids assigning one teacher to multiple roles in the same project", () => {
    for (const project of multiPilotR2Projects) {
      const roles = [project.advisorLabel, project.headLabel, project.memberLabel];
      expect(new Set(roles).size).toBe(3);
    }
  });

  it("gives every teacher overlapping advisor/head/member work", () => {
    for (const summary of getMultiPilotR2TeacherRoleSummary()) {
      expect(summary.advisorCount).toBeGreaterThanOrEqual(3);
      expect(summary.headCount).toBeGreaterThanOrEqual(3);
      expect(summary.memberCount).toBeGreaterThanOrEqual(3);
    }
  });
});
