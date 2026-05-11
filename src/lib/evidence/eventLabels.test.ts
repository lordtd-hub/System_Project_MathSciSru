import { describe, expect, it } from "vitest";
import { evidenceEventLabel, evidenceTimelineTitle } from "./eventLabels";

describe("evidence display labels", () => {
  it("maps legacy English evidence labels to Thai display text", () => {
    expect(evidenceEventLabel("report approved")).toBe("รายงานฉบับสมบูรณ์ผ่านการตรวจแล้ว");
    expect(evidenceEventLabel("final presentation done")).toBe("การสอบนำเสนอขั้นสุดท้ายเสร็จสิ้น");
    expect(evidenceEventLabel("final presentation score submitted")).toBe("บันทึกคะแนนสอบนำเสนอขั้นสุดท้ายแล้ว");
    expect(evidenceEventLabel("student import")).toBe("นำเข้ารายชื่อนักศึกษาแล้ว");
    expect(evidenceEventLabel("course offering opened")).toBe("เปิดรายวิชาที่เปิดสอนแล้ว");
  });

  it("uses Thai report version wording for timeline titles", () => {
    expect(evidenceTimelineTitle("ส่งเล่มรายงาน version 2")).toBe("ส่งเล่มรายงาน ฉบับที่ 2");
  });
});
