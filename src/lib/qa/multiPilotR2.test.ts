import { describe, expect, it } from "vitest";
import {
  getMultiPilotR2ScenarioCounts,
  getMultiPilotR2TeacherRoleSummary,
  getMultiPilotR2Wave2ScenarioCounts,
  multiPilotR2Projects,
  multiPilotR2Students,
  multiPilotR2Teachers,
  multiPilotR2Wave2Projects
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

  it("defines the approved Wave 2 first-cycle scale and exception mix", () => {
    expect(multiPilotR2Wave2Projects).toHaveLength(12);
    expect(getMultiPilotR2Wave2ScenarioCounts()).toEqual({
      "Normal": 8,
      "Late Proposal Recovery": 1,
      "Progress Recovery": 1,
      "Schedule Reject/Resubmit": 1,
      "Report Revision Loop": 1
    });
  });

  it("avoids assigning one teacher to multiple roles in the same project", () => {
    for (const project of multiPilotR2Projects) {
      const roles = [project.advisorLabel, project.headLabel, project.memberLabel];
      expect(new Set(roles).size).toBe(3);
    }
  });

  it("keeps Wave 2 teacher roles distinct per project", () => {
    for (const project of multiPilotR2Wave2Projects) {
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
