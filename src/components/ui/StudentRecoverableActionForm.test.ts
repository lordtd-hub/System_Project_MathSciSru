import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { StudentActionResult } from "@/lib/projects/studentActionResult";
import {
  STUDENT_FORM_SNAPSHOT_TTL_MS,
  attemptStorageOperation,
  cancelScheduledDraftSave,
  createFormSnapshot,
  parseFormSnapshot,
  reconcileFormValues,
  studentActionFeedbackCopy,
  studentActionRecoveryPlan,
  StudentActionFeedbackView
} from "./StudentRecoverableActionForm";

vi.stubGlobal("React", React);

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

  it("does not throw when the browser blocks storage access", () => {
    const blocked = attemptStorageOperation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });

    expect(blocked).toEqual({ ok: false });
  });

  it("does not throw when saving a draft exceeds the storage quota", () => {
    const quotaExceeded = attemptStorageOperation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    expect(quotaExceeded).toEqual({ ok: false });
  });

  it("returns the storage operation value when storage is available", () => {
    expect(attemptStorageOperation(() => "saved")).toEqual({ ok: true, value: "saved" });
  });

  it("clears the snapshot and refreshes only after typed success", () => {
    expect(studentActionRecoveryPlan({
      status: "success",
      code: "SAVED",
      message: "บันทึกแล้ว",
      requestId: "request-1",
      unchanged: false
    })).toEqual({ clearSnapshot: true, refresh: true, restoreSnapshot: false, focusField: undefined });

    expect(studentActionRecoveryPlan({
      status: "conflict",
      code: "STALE",
      message: "สถานะเปลี่ยนแล้ว",
      requestId: "request-2"
    })).toEqual({ clearSnapshot: false, refresh: false, restoreSnapshot: true, focusField: undefined });
  });

  it("restores the draft and identifies the first missing field after validation", () => {
    expect(studentActionRecoveryPlan({
      status: "validation",
      code: "REQUIRED_FIELD_MISSING",
      message: "กรุณากรอกข้อมูล",
      requestId: "request-3",
      missingFields: ["objectives", "timeline"]
    })).toEqual({ clearSnapshot: false, refresh: false, restoreSnapshot: true, focusField: "objectives" });
  });

  it("cancels a pending autosave before a successful action clears the draft", () => {
    vi.useFakeTimers();
    const writeDraft = vi.fn();
    const timer = {
      current: setTimeout(writeDraft, 80) as unknown as ReturnType<typeof setTimeout> | null
    };

    cancelScheduledDraftSave(timer);
    vi.advanceTimersByTime(100);

    expect(writeDraft).not.toHaveBeenCalled();
    expect(timer.current).toBeNull();
    vi.useRealTimers();
  });

  it.each([
    ["success", "ส่งแล้ว"],
    ["validation", "กรุณาตรวจข้อมูล"],
    ["conflict", "สถานะข้อมูลมีการเปลี่ยนแปลง"],
    ["rate_limit", "กรุณารอสักครู่"]
  ] as const)("builds visible feedback for the %s outcome", (status, title) => {
    const result: StudentActionResult = status === "success"
      ? { status, code: "SAVED", message: "บันทึกแล้ว", requestId: "req-1", unchanged: false }
      : status === "validation"
        ? { status, code: "MISSING", message: "กรุณากรอกข้อมูล", requestId: "req-1", missingFields: ["objectives"] }
        : { status, code: "RETRY", message: "กรุณาลองใหม่", requestId: "req-1" };

    expect(studentActionFeedbackCopy(result)).toMatchObject({ title });
  });

  it("adds the Proposal next step to successful feedback only", () => {
    const result = {
      status: "success",
      code: "PROPOSAL_SUBMISSION_SAVED",
      message: "ส่งเอกสาร Proposal เรียบร้อยแล้ว",
      requestId: "req-2",
      unchanged: false
    } as const;

    expect(studentActionFeedbackCopy(result, "ส่งแล้ว", "รออาจารย์ประเมิน")).toEqual({
      title: "ส่งแล้ว",
      message: "ส่งเอกสาร Proposal เรียบร้อยแล้ว",
      nextStep: "รออาจารย์ประเมิน",
      tone: "success"
    });
  });

  it("renders the successful Proposal outcome and next step in the action feedback", () => {
    const html = renderToStaticMarkup(React.createElement(StudentActionFeedbackView, {
      result: {
        status: "success",
        code: "PROPOSAL_SUBMISSION_SAVED",
        message: "ส่งเอกสาร Proposal เรียบร้อยแล้ว",
        requestId: "req-3",
        unchanged: false
      },
      successTitle: "ส่งแล้ว",
      successNextStep: "รออาจารย์ประเมิน"
    }));

    expect(html).toContain('data-student-action-status="success"');
    expect(html).toContain("ส่งแล้ว");
    expect(html).toContain("ขั้นตอนถัดไป: รออาจารย์ประเมิน");
  });
});
