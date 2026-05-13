import { describe, expect, it } from "vitest";
import { buildCourseGradeExportRows, courseGradeExportCsvRows, buildProjectEvidenceRows, buildRubricEvidenceRows } from "./adminEvidence";

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
        reportVersions: [{ submittedAt: new Date("2026-05-02T00:00:00.000Z"), reviews: [{ decision: "PASS", reviewedAt: new Date("2026-05-03T00:00:00.000Z") }] }],
        advisorScore: null,
        timelineEvents: [{ occurredAt: new Date("2026-05-04T00:00:00.000Z") }],
        statusHistory: [],
        _count: { timelineEvents: 1, statusHistory: 0 }
      }
    ]);

    expect(rows[0].reportApproval).toBe(true);
    expect(rows[0].completed).toBe(false);
    expect(rows[0].missingEvidence).toContain("หลักฐานคะแนนสอบความก้าวหน้าครั้งที่ 1");
    expect(rows[0].missingEvidence).toContain("หลักฐานคะแนนอาจารย์ที่ปรึกษา");
    expect(rows[0].lastEvidenceUpdate?.toISOString()).toBe("2026-05-04T00:00:00.000Z");
  });

  it("attributes score evidence to the rubric version used by score items", () => {
    const rows = buildRubricEvidenceRows(
      [
        { id: "rubric-v1", roundType: "PROGRESS_1", name: "Progress 1", version: 1, items: [{ id: "item-1" }] },
        { id: "rubric-v2", roundType: "PROGRESS_1", name: "Progress 1", version: 2, items: [{ id: "item-2" }] }
      ],
      [
        {
          status: "SUBMITTED",
          totalScore: 8,
          scoreItems: [{ rubricItem: { rubricId: "rubric-v2" } }],
          evaluatorAssignment: {
            evaluatorUserId: "teacher-1",
            assessmentAttempt: { assessmentRound: { roundType: "PROGRESS_1" } }
          }
        }
      ]
    );

    expect(rows.find((row) => row.rubricName === "Progress 1 v1")).toBeUndefined();
    expect(rows.find((row) => row.rubricName === "Progress 1 v2")?.scoreSubmissionCount).toBe(1);
    expect(rows.find((row) => row.rubricName === "Progress 1 v2")?.scoreItemCount).toBe(1);
  });

  it("exports course grade columns as weighted percentage components", () => {
    const rows = buildCourseGradeExportRows(
      [
        {
          id: "project-1",
          currentTitleTh: "Weighted grade export",
          status: "COMPLETED",
          student: { studentCode: "65123456789", firstNameTh: "Somchai", lastNameTh: "Jaidee" },
          attempts: [
            {
              officialScore: null,
              assessmentRound: { roundType: "PROPOSAL" },
              proposalResult: { averageScore: 80 },
              evaluatorAssignments: []
            },
            {
              officialScore: null,
              assessmentRound: { roundType: "PROGRESS_1" },
              evaluatorAssignments: [
                { scoreSubmission: { status: "SUBMITTED", totalScore: 70 } },
                { scoreSubmission: { status: "LOCKED", totalScore: 80 } }
              ]
            },
            {
              officialScore: 90,
              assessmentRound: { roundType: "PROGRESS_2" },
              evaluatorAssignments: []
            },
            {
              officialScore: null,
              assessmentRound: { roundType: "FINAL_PRESENTATION" },
              evaluatorAssignments: [
                { scoreSubmission: { status: "DRAFT", totalScore: 50 } },
                { scoreSubmission: { status: "SUBMITTED", totalScore: 100 } }
              ]
            }
          ],
          advisorScore: { status: "SUBMITTED", score: 88 }
        }
      ],
      [
        { roundType: "PROPOSAL", courseWeight: 10 },
        { roundType: "PROGRESS_1", courseWeight: 10 },
        { roundType: "PROGRESS_2", courseWeight: 10 },
        { roundType: "FINAL_PRESENTATION", courseWeight: 10 }
      ]
    );

    expect(rows[0]).toMatchObject({
      studentCode: "65123456789",
      proposalWeightedScore: 8,
      progress1WeightedScore: 7.5,
      progress2WeightedScore: 9,
      finalWeightedScore: 10,
      presentationTotalScore: 34.5,
      advisorWeightedScore: 22,
      recordedTotalScore: 56.5,
      missingScoreComponents: []
    });
  });

  it("keeps missing grade components visible while totals treat them as zero", () => {
    const rows = buildCourseGradeExportRows(
      [
        {
          id: "project-1",
          currentTitleTh: null,
          status: "FINAL_DONE",
          student: { studentCode: "65123456790", firstNameTh: "Somsri", lastNameTh: "Rakrian" },
          attempts: [
            {
              officialScore: null,
              assessmentRound: { roundType: "PROPOSAL" },
              proposalResult: { averageScore: 75 },
              evaluatorAssignments: []
            }
          ],
          advisorScore: null
        }
      ],
      []
    );

    expect(rows[0].proposalWeightedScore).toBe(7.5);
    expect(rows[0].progress1WeightedScore).toBeNull();
    expect(rows[0].presentationTotalScore).toBe(7.5);
    expect(rows[0].recordedTotalScore).toBe(7.5);
    expect(rows[0].missingScoreComponents).toEqual(["Progress 1", "Progress 2", "Final Presentation", "Advisor 25%"]);
    expect(courseGradeExportCsvRows(rows)[0]).toContain("Progress 1; Progress 2; Final Presentation; Advisor 25%");
  });
});
