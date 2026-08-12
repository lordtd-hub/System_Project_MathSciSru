import { describe, expect, it } from "vitest";
import {
  STUDENT_FORM_SNAPSHOT_TTL_MS,
  createFormSnapshot,
  parseFormSnapshot,
  reconcileFormValues
} from "./StudentRecoverableActionForm";

describe("student recoverable action form snapshots", () => {
  it("round-trips native, controlled, hidden timeline, radio, and same-name checkbox values", () => {
    const now = Date.UTC(2026, 7, 12, 10, 0, 0);
    const snapshot = createFormSnapshot({
      project_title_th: "ทฤษฎีจุดตรึง",
      abstract_of_talk: "รายละเอียด **Markdown**",
      source_type: "RESEARCH_EXTENSION",
      presentation_mode: "onsite",
      evidence_type: ["proof", "dataset"],
      timeline: "| งาน | สัปดาห์ |",
      timeline_items_json: '[{"activity":"พิสูจน์บทตั้ง"}]'
    }, now);

    const parsed = parseFormSnapshot(JSON.stringify(snapshot), now + 1_000, STUDENT_FORM_SNAPSHOT_TTL_MS);

    expect(parsed).toEqual({ status: "valid", snapshot });
  });

  it("expires local snapshots at the seven-day boundary", () => {
    const now = Date.UTC(2026, 7, 12, 10, 0, 0);
    const raw = JSON.stringify(createFormSnapshot({ report_note: "ร่างคำตอบผู้ตรวจ" }, now));

    expect(parseFormSnapshot(raw, now + STUDENT_FORM_SNAPSHOT_TTL_MS - 1, STUDENT_FORM_SNAPSHOT_TTL_MS).status).toBe("valid");
    expect(parseFormSnapshot(raw, now + STUDENT_FORM_SNAPSHOT_TTL_MS, STUDENT_FORM_SNAPSHOT_TTL_MS)).toEqual({ status: "expired" });
  });

  it("rejects damaged snapshots without manufacturing form values", () => {
    expect(parseFormSnapshot("not-json", Date.now(), STUDENT_FORM_SNAPSHOT_TTL_MS)).toEqual({ status: "invalid" });
    expect(parseFormSnapshot(JSON.stringify({ updatedAt: "bad", values: { title: 42 } }), Date.now(), STUDENT_FORM_SNAPSHOT_TTL_MS)).toEqual({ status: "invalid" });
  });

  it("reconciles a snapshot over server defaults while retaining fields absent from the snapshot", () => {
    expect(reconcileFormValues(
      {
        project_title_th: "ค่าจากระบบ",
        student_declaration: ["on"],
        server_only: "เก็บไว้"
      },
      {
        project_title_th: "",
        student_declaration: [],
        timeline_items_json: "[]"
      }
    )).toEqual({
      project_title_th: "",
      student_declaration: [],
      server_only: "เก็บไว้",
      timeline_items_json: "[]"
    });
  });
});
