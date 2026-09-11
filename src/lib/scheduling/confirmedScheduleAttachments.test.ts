import { describe, expect, it } from "vitest";
import {
  confirmedTeacherScheduleWhere,
  latestAllowedAssessmentAttachment,
  teacherScheduleAttachmentSelect,
  teacherVisibleScheduleKinds
} from "./confirmedScheduleAttachments";

const submission = (
  kind: "PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENT",
  submittedAt: string,
  materialLink = "https://drive.google.com/file/d/example"
) => ({ kind, title: `${kind} evidence`, materialLink, submittedAt: new Date(submittedAt) });

describe("confirmed schedule attachments visible to approved teachers", () => {
  it("limits the shared calendar to confirmed assessment schedules in the active offering", () => {
    expect(teacherVisibleScheduleKinds).toEqual(["PROGRESS_1", "PROGRESS_2", "FINAL_PRESENT"]);
    expect(confirmedTeacherScheduleWhere("offering-active")).toEqual({
      status: "CONFIRMED",
      assessmentKind: { in: ["PROGRESS_1", "PROGRESS_2", "FINAL_PRESENT"] },
      OR: [
        { courseOfferingId: "offering-active" },
        { courseOfferingId: null, project: { courseOfferingId: "offering-active" } }
      ]
    });
  });

  it("selects only attachment metadata and never submission content", () => {
    expect(teacherScheduleAttachmentSelect).toEqual({
      kind: true,
      title: true,
      materialLink: true,
      submittedAt: true
    });
    expect(teacherScheduleAttachmentSelect).not.toHaveProperty("contentJson");
  });

  it("returns the latest valid attachment matching the scheduled round", () => {
    const result = latestAllowedAssessmentAttachment("PROGRESS_1", [
      submission("PROGRESS_1", "2026-09-01T08:00:00Z"),
      submission("PROGRESS_2", "2026-09-03T08:00:00Z"),
      submission("PROGRESS_1", "2026-09-02T08:00:00Z", "https://docs.google.com/document/d/latest")
    ]);

    expect(result?.materialLink).toBe("https://docs.google.com/document/d/latest");
  });

  it("does not expose missing, cross-round, or disallowed legacy links", () => {
    expect(latestAllowedAssessmentAttachment("FINAL_PRESENT", [
      submission("PROGRESS_2", "2026-09-03T08:00:00Z")
    ])).toBeNull();
    expect(latestAllowedAssessmentAttachment("FINAL_PRESENT", [
      submission("FINAL_PRESENT", "2026-09-03T08:00:00Z", "https://example.com/private")
    ])).toBeNull();
  });
});