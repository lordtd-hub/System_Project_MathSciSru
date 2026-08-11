"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SUBMIT_AUTO_RECOVERY_EVENT } from "./SubmitButton";
import {
  initialTeacherScoreActionResult,
  teacherScoreActionMessage,
  type TeacherScoreActionResult
} from "@/lib/scoring/teacherScoreActionResult";

type FormAction = (formData: FormData) => void | Promise<void>;

type DraftMap = Record<string, string | boolean>;

function readForm(form: HTMLFormElement): DraftMap {
  const data = new FormData(form);
  const values: DraftMap = {};
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
      continue;
    }
    if (!element.name || element.type === "hidden") continue;
    values[element.name] = element instanceof HTMLInputElement && element.type === "checkbox" ? element.checked : String(data.get(element.name) ?? "");
  }
  for (const [key, value] of data.entries()) {
    if (!(key in values)) values[key] = String(value);
  }
  return values;
}

function restoreForm(form: HTMLFormElement, values: DraftMap) {
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
      continue;
    }
    if (!element.name || !(element.name in values)) continue;

    const value = values[element.name];
    if (element instanceof HTMLInputElement && element.type === "checkbox") {
      element.checked = Boolean(value);
    } else if (typeof value === "string") {
      element.value = value;
    }
  }

  window.dispatchEvent(new CustomEvent("draft-form-restore", { detail: values }));
  window.dispatchEvent(new CustomEvent("proposal-draft-restore", { detail: values }));
}

export function DraftPreservingForm({
  action,
  storageKey,
  clearOnSuccess,
  className,
  children
}: {
  action: FormAction;
  storageKey: string;
  clearOnSuccess?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"idle" | "saved" | "restored">("idle");

  const saveDraft = useCallback((nextStatus: "saved" | "idle" = "idle") => {
    const form = formRef.current;
    if (!form) return;
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        values: readForm(form)
      })
    );
    if (nextStatus === "saved") setStatus("saved");
  }, [storageKey]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveDraft(), 80);
  }, [saveDraft]);

  useEffect(() => {
    if (clearOnSuccess) {
      localStorage.removeItem(storageKey);
      return;
    }

    const raw = localStorage.getItem(storageKey);
    if (!raw || !formRef.current) return;
    try {
      const parsed = JSON.parse(raw) as { values?: DraftMap };
      if (parsed.values) {
        restoreForm(formRef.current, parsed.values);
        setStatus("restored");
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [clearOnSuccess, storageKey]);

  useEffect(() => {
    const listener = () => scheduleSave();
    window.addEventListener("draft-form-field-change", listener);
    window.addEventListener("proposal-draft-field-change", listener);
    return () => {
      window.removeEventListener("draft-form-field-change", listener);
      window.removeEventListener("proposal-draft-field-change", listener);
    };
  }, [scheduleSave]);

  return (
    <form
      ref={formRef}
      action={action}
      className={className}
      onInput={scheduleSave}
      onChange={scheduleSave}
      onClickCapture={(event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.closest("[data-draft-save],[data-proposal-draft-save]")) {
          event.preventDefault();
          saveDraft("saved");
        } else if (target instanceof HTMLElement && target.closest('button[type="submit"],input[type="submit"]')) {
          saveDraft();
        }
      }}
      onSubmit={() => saveDraft()}
    >
      {children}
      {status !== "idle" ? (
        <p className="mt-2 text-xs text-muted" aria-live="polite">
          {status === "restored" ? "กู้คืนร่างที่เคยกรอกไว้ในเครื่องนี้แล้ว" : "บันทึกร่างไว้ในเครื่องนี้แล้ว ยังไม่ได้ส่งเข้าระบบ"}
        </p>
      ) : null}
    </form>
  );
}

export const ProposalDraftForm = DraftPreservingForm;

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
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const handledRequestId = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [restored, setRestored] = useState(false);
  const [result, formAction] = useActionState(action, initialTeacherScoreActionResult);
  const message = teacherScoreActionMessage(result);

  const saveRecoverySnapshot = useCallback(() => {
    if (!formRef.current) return;
    sessionStorage.setItem(storageKey, JSON.stringify({ values: readForm(formRef.current) }));
  }, [storageKey]);

  const scheduleRecoverySnapshot = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveRecoverySnapshot, 80);
  }, [saveRecoverySnapshot]);

  useEffect(() => {
    const form = formRef.current;
    const raw = sessionStorage.getItem(storageKey);
    if (!form || !raw) return;
    try {
      const parsed = JSON.parse(raw) as { values?: DraftMap };
      if (parsed.values) {
        restoreForm(form, parsed.values);
        setRestored(true);
      }
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  useEffect(() => {
    if (result.status !== "success" || handledRequestId.current === result.requestId) return;
    handledRequestId.current = result.requestId;
    sessionStorage.removeItem(storageKey);
    router.refresh();
  }, [result, router, storageKey]);

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
  const formRef = useRef<HTMLFormElement>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const raw = sessionStorage.getItem(storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { values?: DraftMap };
        if (parsed.values) {
          restoreForm(form, parsed.values);
          setRestored(true);
        }
      } catch {
        // Ignore a damaged recovery snapshot and keep the server-rendered values.
      } finally {
        sessionStorage.removeItem(storageKey);
      }
    }

    const preserveBeforeRecovery = (event: Event) => {
      const detail = (event as CustomEvent<{ form?: HTMLFormElement | null }>).detail;
      if (detail?.form !== form) return;
      sessionStorage.setItem(storageKey, JSON.stringify({ values: readForm(form) }));
    };

    window.addEventListener(SUBMIT_AUTO_RECOVERY_EVENT, preserveBeforeRecovery);
    return () => window.removeEventListener(SUBMIT_AUTO_RECOVERY_EVENT, preserveBeforeRecovery);
  }, [storageKey]);

  return (
    <form ref={formRef} action={action} className={className}>
      {children}
      {restored ? (
        <p className="mt-2 text-sm font-medium text-amber-800" role="status" aria-live="polite">
          กู้คืนคะแนนและข้อความที่กรอกไว้แล้ว กรุณาตรวจสอบก่อนกดส่งอีกครั้ง
        </p>
      ) : null}
    </form>
  );
}
