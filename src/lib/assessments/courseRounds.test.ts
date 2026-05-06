import { describe, expect, it } from "vitest";
import { courseLevelRoundTypes, defaultCourseRoundName, roundStatusLabelTh } from "./courseRounds";

describe("course-level assessment rounds", () => {
  it("defines the four batch rounds used by a course offering", () => {
    expect(courseLevelRoundTypes).toEqual(["PROPOSAL", "PROGRESS_1", "PROGRESS_2", "FINAL_PRESENTATION"]);
  });

  it("names rounds without project-specific identifiers", () => {
    expect(defaultCourseRoundName("PROPOSAL")).toBe("Proposal Presentation");
    expect(defaultCourseRoundName("PROGRESS_1")).toBe("Progress 1 Presentation");
  });

  it("maps closed statuses to visible Thai closed text", () => {
    expect(roundStatusLabelTh("SCORING_CLOSED")).toBe("ปิดแล้ว");
    expect(roundStatusLabelTh("SUBMISSION_CLOSED")).toBe("ปิดแล้ว");
  });
});
