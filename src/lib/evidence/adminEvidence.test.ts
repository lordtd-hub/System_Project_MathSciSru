import { describe, expect, it } from "vitest";
import { buildProjectEvidenceRows } from "./adminEvidence";

describe("admin evidence summaries", () => {
  it("marks projects incomplete when required evidence is missing", () => {
    const rows = buildProjectEvidenceRows([
      {
        id: "project-1",
        currentTitleTh: "หัวข้อทดสอบ",
        status: "REPORT_APPROVED",
        updatedAt: new Date("2026-05-01T00:00:00.000Z"),
        student: {
          studentCode: "65123456789",
          firstNameTh: "สมชาย",
          lastNameTh: "ใจดี",
          generatedEmail: "65123456789@student.sru.ac.th"
        },
        advisorRequests: [],
        committeeAssignments: [],
        attempts: [],
        reportVersions: [{ id: "rv1", versionNo: 1, submittedAt: new Date("2026-05-02T00:00:00.000Z"), reviews: [{ decision: "PASS", reviewedAt: new Date("2026-05-03T00:00:00.000Z") }] }],
        advisorScore: null,
        timelineEvents: [{ occurredAt: new Date("2026-05-04T00:00:00.000Z") }],
        statusHistory: [],
        _count: { timelineEvents: 1, statusHistory: 0 }
      }
    ]);

    expect(rows[0].reportApproval).toBe(true);
    expect(rows[0].completed).toBe(false);
    expect(rows[0].missingEvidence).toContain("Progress 1 score");
    expect(rows[0].missingEvidence).toContain("Advisor score");
    expect(rows[0].lastEvidenceUpdate?.toISOString()).toBe("2026-05-04T00:00:00.000Z");
  });
});
