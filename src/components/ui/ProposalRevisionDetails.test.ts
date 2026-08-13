import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProposalRevisionDetails } from "./ProposalRevisionDetails";

describe("ProposalRevisionDetails", () => {
  it("renders every field from the latest student revision", () => {
    const html = renderToStaticMarkup(createElement(ProposalRevisionDetails, {
      revision: {
        versionNo: 2,
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
        declarationAccepted: true
      }
    }));

    for (const expected of [
      "ฉบับที่ 2",
      "ชื่อใหม่",
      "New title",
      "บทคัดย่อใหม่",
      "ที่มาใหม่",
      "วัตถุประสงค์ใหม่",
      "วิธีใหม่",
      "ผลใหม่",
      "แผนใหม่",
      "คำถามใหม่",
      "เปิดเอกสารประกอบฉบับล่าสุด",
      "คำรับรองของนักศึกษา: รับรองแล้ว"
    ]) {
      expect(html).toContain(expected);
    }
  });
});
