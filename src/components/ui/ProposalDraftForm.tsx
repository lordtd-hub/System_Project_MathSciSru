"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import {
  StudentRecoverableActionForm,
  attemptStorageOperation,
  readForm,
  restoreForm,
  type DraftMap,
  type FormAction
} from "./StudentRecoverableActionForm";
import {
  initialTeacherScoreActionResult,
  teacherScoreActionMessage,
  type TeacherScoreActionResult
} from "@/lib/scoring/teacherScoreActionResult";

export {
  appendCheckboxDraftValue,
  isCheckboxSelected
} from "./StudentRecoverableActionForm";

export type ScoreActionRecoveryState = {
  lastRequestId: string | null;
  reloadStarted: boolean;
};

type ScoreActionRecoveryEffects = {
  cancelPendingSave: () => void;
  readSnapshot: () => DraftMap | null;
  restoreSnapshot: (values: DraftMap, missingFields: string[]) => void;
  clearSnapshot: () => void;
  reload: () => void;
};

export function reconcileTeacherScoreActionResult(
  result: TeacherScoreActionResult,
  state: ScoreActionRecoveryState,
  effects: ScoreActionRecoveryEffects
): ScoreActionRecoveryState {
  if (result.status === "idle" || state.reloadStarted || state.lastRequestId === result.requestId) return state;

  effects.cancelPendingSave();
  if (result.status === "success") {
    effects.clearSnapshot();
    effects.reload();
    return { lastRequestId: result.requestId, reloadStarted: true };
  }

  const values = effects.readSnapshot();
  if (values) effects.restoreSnapshot(values, result.missingFields ?? []);
  return { lastRequestId: result.requestId, reloadStarted: false };
}

export const DraftPreservingForm = StudentRecoverableActionForm;
export const ProposalDraftForm = StudentRecoverableActionForm;

type ResultFormAction = (
  previousState: TeacherScoreActionResult,
  formData: FormData
) => Promise<TeacherScoreActionResult>;

export function RecoverableScoreActionForm({
  action,
  storageKey,
  className,
  children
}: {
  action: ResultFormAction;
  storageKey: string;
  className?: string;
  children: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const recoveryState = useRef<ScoreActionRecoveryState>({ lastRequestId: null, reloadStarted: false });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [restored, setRestored] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [result, formAction] = useActionState(action, initialTeacherScoreActionResult);
  const message = teacherScoreActionMessage(result);

  const saveRecoverySnapshot = useCallback(() => {
    if (!formRef.current) return;
    const result = attemptStorageOperation(() =>
      sessionStorage.setItem(storageKey, JSON.stringify({ values: readForm(formRef.current!) }))
    );
    setStorageUnavailable(!result.ok);
  }, [storageKey]);

  const scheduleRecoverySnapshot = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveRecoverySnapshot, 80);
  }, [saveRecoverySnapshot]);

  useEffect(() => {
    const form = formRef.current;
    const readResult = attemptStorageOperation(() => sessionStorage.getItem(storageKey));
    if (!readResult.ok) {
      setStorageUnavailable(true);
      return;
    }
    const raw = readResult.value;
    if (!form || !raw) return;
    try {
      const parsed = JSON.parse(raw) as { values?: DraftMap };
      if (parsed.values) {
        restoreForm(form, parsed.values);
        setRestored(true);
      }
    } catch {
      const removeResult = attemptStorageOperation(() => sessionStorage.removeItem(storageKey));
      if (!removeResult.ok) setStorageUnavailable(true);
    }
  }, [storageKey]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  useEffect(() => {
    recoveryState.current = reconcileTeacherScoreActionResult(result, recoveryState.current, {
      cancelPendingSave: () => {
        if (saveTimer.current) {
          clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }
      },
      readSnapshot: () => {
        const readResult = attemptStorageOperation(() => sessionStorage.getItem(storageKey));
        if (!readResult.ok) {
          setStorageUnavailable(true);
          return null;
        }
        const raw = readResult.value;
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw) as { values?: DraftMap };
          return parsed.values ?? null;
        } catch {
          const removeResult = attemptStorageOperation(() => sessionStorage.removeItem(storageKey));
          if (!removeResult.ok) setStorageUnavailable(true);
          return null;
        }
      },
      restoreSnapshot: (values, missingFields) => {
        const form = formRef.current;
        if (!form) return;
        restoreForm(form, values);
        setRestored(true);

        const missingElement = Array.from(form.elements).find(
          (element) => element instanceof HTMLElement && "name" in element && missingFields.includes(String(element.name))
        );
        if (missingElement instanceof HTMLElement) {
          missingElement.focus();
          missingElement.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      },
      clearSnapshot: () => {
        const removeResult = attemptStorageOperation(() => sessionStorage.removeItem(storageKey));
        if (!removeResult.ok) setStorageUnavailable(true);
      },
      reload: () => window.location.reload()
    });
  }, [result, storageKey]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={className}
      onInput={scheduleRecoverySnapshot}
      onChange={scheduleRecoverySnapshot}
      onSubmit={saveRecoverySnapshot}
    >
      {children}
      {restored && result.status === "idle" ? (
        <p className="mt-2 text-sm font-medium text-amber-800" role="status" aria-live="polite">
          กู้คืนคะแนนและข้อความที่กรอกไว้แล้ว กรุณาตรวจสอบก่อนกดส่งอีกครั้ง
        </p>
      ) : null}
      {storageUnavailable ? (
        <p className="mt-2 text-sm font-medium text-amber-800" role="status" aria-live="polite">
          เบราว์เซอร์นี้ไม่อนุญาตให้เก็บข้อมูลสำรองในเครื่อง แต่ยังส่งแบบประเมินได้ตามปกติ กรุณาอย่าปิดหรือรีเฟรชหน้านี้ก่อนส่งสำเร็จ
        </p>
      ) : null}
      {message ? (
        <p
          className={`mt-3 rounded-md border px-3 py-2 text-sm font-medium ${
            result.status === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-red-300 bg-red-50 text-red-800"
          }`}
          role={result.status === "success" ? "status" : "alert"}
          aria-live="polite"
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}

export function RecoverableActionForm({
  action,
  storageKey,
  className,
  children
}: {
  action: FormAction;
  storageKey: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <StudentRecoverableActionForm action={action} storageKey={storageKey} storage="session" className={className}>
      {children}
    </StudentRecoverableActionForm>
  );
}
