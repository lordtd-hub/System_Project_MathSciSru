"use client";

import React, { useState } from "react";
import {
  proposalDecisionConfirmation,
  proposalDecisionGuidance,
  proposalDecisionRequiresReason,
  type ProposalFinalDecision
} from "@/lib/proposals/proposalDecisionPresentation";
import {
  ProposalLifecycleActionForm,
  type ProposalLifecycleFormAction
} from "./ProposalLifecycleActionForm";
import { SubmitButton } from "./SubmitButton";

export function AdminProposalDecisionForm({
  action,
  attemptId,
  formInstance,
  studentLabel,
  initialDecision,
  initialReason,
  isEditing,
  missingScoreCount
}: {
  action: ProposalLifecycleFormAction;
  attemptId: string;
  formInstance: "mobile" | "desktop";
  studentLabel: string;
  initialDecision?: ProposalFinalDecision | null;
  initialReason?: string | null;
  isEditing: boolean;
  missingScoreCount: number;
}) {
  const [decision, setDecision] = useState<ProposalFinalDecision | "">(initialDecision ?? "");
  const reasonRequired = proposalDecisionRequiresReason(decision);
  const guidance = proposalDecisionGuidance(decision);
  const confirmation = decision
    ? proposalDecisionConfirmation({ decision, studentLabel, isEditing })
    : undefined;
  const fieldSuffix = `${formInstance}-${attemptId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <ProposalLifecycleActionForm action={action} className="space-y-3">
      <input type="hidden" name="attempt_id" value={attemptId} />

      <div>
        <label className="mb-1 block text-sm font-semibold text-ink" htmlFor={`proposal-decision-${fieldSuffix}`}>
          มติสุดท้าย
        </label>
        <select
          id={`proposal-decision-${fieldSuffix}`}
          name="final_decision"
          value={decision}
          onChange={(event) => setDecision(event.target.value as ProposalFinalDecision | "")}
          required
          aria-describedby={`proposal-decision-guidance-${fieldSuffix}`}
        >
          <option value="" disabled>เลือกมติสุดท้าย</option>
          <option value="PASS">ผ่าน</option>
          <option value="PASS_WITH_REVISION">ผ่านโดยให้แก้ไข</option>
          <option value="NOT_PASS">ไม่ผ่าน</option>
        </select>
      </div>

      <p
        id={`proposal-decision-guidance-${fieldSuffix}`}
        className={`rounded-md border px-3 py-2 text-xs leading-5 ${
          decision === "NOT_PASS"
            ? "border-red-200 bg-red-50 text-red-800"
            : decision === "PASS_WITH_REVISION"
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-line bg-paperSoft text-muted"
        }`}
      >
        {guidance}
      </p>

      {missingScoreCount > 0 ? (
        <p className="text-xs leading-5 text-muted">
          คะแนนยังขาด {missingScoreCount} คน แต่บันทึกมติได้ โดยระบบจะไม่นำคะแนนที่ขาดมาคำนวณค่าเฉลี่ย
        </p>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-semibold text-ink" htmlFor={`proposal-decision-reason-${fieldSuffix}`}>
          เหตุผล/มติที่ประชุม {reasonRequired ? <span className="text-red-700">(จำเป็น)</span> : <span className="font-normal text-muted">(ไม่บังคับ)</span>}
        </label>
        <textarea
          id={`proposal-decision-reason-${fieldSuffix}`}
          name="final_decision_reason"
          defaultValue={initialReason ?? ""}
          placeholder={reasonRequired ? "ระบุเหตุผลหรือมติที่ประชุมก่อนยืนยัน" : "บันทึกหมายเหตุเพิ่มเติม (ถ้ามี)"}
          required={reasonRequired}
          rows={3}
        />
      </div>

      <SubmitButton
        className={decision === "NOT_PASS" ? "button-danger w-full" : "w-full"}
        pendingText="กำลังบันทึกมติ..."
        confirmMessage={confirmation}
        disabled={!decision}
        autoRecovery={false}
      >
        {isEditing ? "ยืนยันการแก้ไขมติ" : "ยืนยันมติสุดท้าย"}
      </SubmitButton>
    </ProposalLifecycleActionForm>
  );
}
