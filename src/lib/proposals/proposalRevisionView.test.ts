import { describe, expect, it } from "vitest";
import { buildProposalRevisionView } from "./proposalRevisionView";

const submission = {
  titleTh: "ชื่อเดิม",
  titleEn: "Old title",
  abstractText: "บทคัดย่อเดิม",
  contentJson: {
    motivationBackground: "ที่มาเดิม",
    objectives: "วัตถุประสงค์เดิม",
    proposedMethods: "วิธีเดิม",
    expectedOutcomes: "ผลเดิม",
    timeline: "แผนเดิม",
    questionsForTeachers: "คำถามเดิม"
  },
  materialLink: "https://drive.google.com/old",
  declarationAccepted: true
};

describe("buildProposalRevisionView", () => {
  it("uses every field from the latest revision snapshot", () => {
    const revision = buildProposalRevisionView(submission, {
      versionNo: 3,
      snapshotJson: {
        titleTh: "ชื่อใหม่",
        titleEn: "New title",
        abstractText: "บทคัดย่อใหม่",
        contentJson: {
          motivationBackground: "ที่มาใหม่",
          objectives: "วัตถุประสงค์ใหม่",
          proposedMethods: "วิธีใหม่",
          expectedOutcomes: "ผลใหม่",
          timeline: "แผนใหม่",
          questionsForTeachers: "คำถามใหม่"
        },
        materialLink: "https://drive.google.com/new",
        declarationAccepted: false
      }
    });

    expect(revision).toEqual({
      versionNo: 3,
      titleTh: "ชื่อใหม่",
      titleEn: "New title",
      abstractText: "บทคัดย่อใหม่",
      motivationBackground: "ที่มาใหม่",
      objectives: "วัตถุประสงค์ใหม่",
      proposedMethods: "วิธีใหม่",
      expectedOutcomes: "ผลใหม่",
      timeline: "แผนใหม่",
      questionsForTeachers: "คำถามใหม่",
      materialLink: "https://drive.google.com/new",
      declarationAccepted: false
    });
  });

  it("falls back to the current submission for legacy partial snapshots", () => {
    const revision = buildProposalRevisionView(submission, {
      versionNo: 1,
      snapshotJson: { abstractText: "บทคัดย่อจาก snapshot" }
    });

    expect(revision.abstractText).toBe("บทคัดย่อจาก snapshot");
    expect(revision.objectives).toBe("วัตถุประสงค์เดิม");
    expect(revision.timeline).toBe("แผนเดิม");
    expect(revision.materialLink).toBe("https://drive.google.com/old");
  });
});
