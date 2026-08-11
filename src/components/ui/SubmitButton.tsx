"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

export const SUBMIT_AUTO_RECOVERY_DELAY_MS = 15_000;
export const SUBMIT_AUTO_RECOVERY_EVENT = "submit-auto-recovery";

type ScoreSummary = {
  completed: number;
  count: number;
  missing: number;
  total: number;
  firstIncomplete: HTMLInputElement | HTMLSelectElement | null;
};

function readScoreSummary(form: HTMLFormElement): ScoreSummary {
  const controls = Array.from(
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-score-control="true"]')
  );
  let completed = 0;
  let total = 0;
  let firstIncomplete: HTMLInputElement | HTMLSelectElement | null = null;

  for (const control of controls) {
    const incomplete = control.value.trim() === "";
    if (incomplete) {
      firstIncomplete ??= control;
      continue;
    }

    completed += 1;
    if (control instanceof HTMLSelectElement) {
      total += Number(control.selectedOptions[0]?.dataset.scorePoints ?? 0);
    } else if (control.type === "checkbox") {
      total += control.checked ? Number(control.dataset.scorePoints ?? 0) : 0;
    } else {
      total += Number(control.value) || 0;
    }
  }

  return {
    completed,
    count: controls.length,
    missing: controls.length - completed,
    total,
    firstIncomplete
  };
}

function formatScore(score: number) {
  return Number.isInteger(score) ? String(score) : score.toFixed(2).replace(/\.00$/, "");
}

export function SubmitButton({
  children,
  pendingText = "กำลังบันทึก...",
  className = "",
  disabled,
  confirmMessage,
  name,
  value,
  scoreGuard = false,
  scoreMax = 100
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  disabled?: boolean;
  confirmMessage?: string;
  name?: string;
  value?: string;
  scoreGuard?: boolean;
  scoreMax?: number;
}) {
  const { pending } = useFormStatus();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [scoreSummary, setScoreSummary] = useState<ScoreSummary>({
    completed: 0,
    count: 0,
    missing: 0,
    total: 0,
    firstIncomplete: null
  });
  const [showIncompleteError, setShowIncompleteError] = useState(false);

  const refreshScoreSummary = useCallback(() => {
    const form = buttonRef.current?.form;
    if (!form || !scoreGuard) return null;
    const nextSummary = readScoreSummary(form);
    setScoreSummary(nextSummary);
    if (nextSummary.missing === 0) setShowIncompleteError(false);
    return nextSummary;
  }, [scoreGuard]);

  useEffect(() => {
    if (!pending) return;

    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(SUBMIT_AUTO_RECOVERY_EVENT, {
        detail: { form: buttonRef.current?.form ?? null }
      }));
      window.location.reload();
    }, SUBMIT_AUTO_RECOVERY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);

  useEffect(() => {
    const form = buttonRef.current?.form;
    if (!form || !scoreGuard) return;

    refreshScoreSummary();
    form.addEventListener("input", refreshScoreSummary);
    form.addEventListener("change", refreshScoreSummary);
    window.addEventListener("draft-form-restore", refreshScoreSummary);
    return () => {
      form.removeEventListener("input", refreshScoreSummary);
      form.removeEventListener("change", refreshScoreSummary);
      window.removeEventListener("draft-form-restore", refreshScoreSummary);
    };
  }, [refreshScoreSummary, scoreGuard]);

  const button = (
    <button
      ref={buttonRef}
      type="submit"
      name={name}
      value={value}
      className={className}
      disabled={disabled || pending}
      aria-disabled={disabled || pending}
      onClick={(event) => {
        const form = event.currentTarget.form;
        if (!form) return;

        const currentScoreSummary = scoreGuard ? refreshScoreSummary() : null;
        if (currentScoreSummary?.missing) {
          event.preventDefault();
          setShowIncompleteError(true);
          currentScoreSummary.firstIncomplete?.focus({ preventScroll: true });
          currentScoreSummary.firstIncomplete?.scrollIntoView({ behavior: "smooth", block: "center" });
          form.reportValidity();
          return;
        }

        if (!form.noValidate && !form.reportValidity()) {
          event.preventDefault();
          return;
        }

        const scoreConfirmation = currentScoreSummary
          ? `\n\nคะแนนรวม ${formatScore(currentScoreSummary.total)}/${scoreMax}\nกรอกครบ ${currentScoreSummary.completed}/${currentScoreSummary.count} หัวข้อ`
          : "";
        if (confirmMessage && !window.confirm(`${confirmMessage}${scoreConfirmation}`)) {
          event.preventDefault();
        }
      }}
    >
      {pending ? pendingText : children}
    </button>
  );

  if (!scoreGuard) return button;

  return (
    <div className="space-y-2">
      <div
        className={`rounded-md border px-3 py-2 text-sm ${
          scoreSummary.missing > 0 || showIncompleteError
            ? "border-amber-300 bg-amber-50 text-amber-900"
            : "border-emerald-300 bg-emerald-50 text-emerald-900"
        }`}
        role="status"
        aria-live="polite"
      >
        {scoreSummary.count === 0 ? (
          "กำลังตรวจความครบถ้วนของคะแนน..."
        ) : (
          <>
            กรอกแล้ว {scoreSummary.completed}/{scoreSummary.count} หัวข้อ · คะแนนรวม {formatScore(scoreSummary.total)}/{scoreMax}
            {scoreSummary.missing > 0 ? ` · ยังขาด ${scoreSummary.missing} หัวข้อ` : " · พร้อมส่งคะแนน"}
          </>
        )}
      </div>
      {showIncompleteError && scoreSummary.missing > 0 ? (
        <p className="text-sm font-medium text-red-700" role="alert">
          ยังส่งคะแนนไม่ได้ กรุณาให้คะแนนให้ครบทุกหัวข้อ
        </p>
      ) : null}
      {button}
    </div>
  );
}
