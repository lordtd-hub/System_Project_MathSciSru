"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const STUDENT_FORM_SNAPSHOT_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

export type FormAction = (formData: FormData) => void | Promise<void>;
export type DraftValue = string | boolean | string[];
export type DraftMap = Record<string, DraftValue>;

export type FormSnapshot = {
  updatedAt: string;
  values: DraftMap;
};

export type ParsedFormSnapshot =
  | { status: "valid"; snapshot: FormSnapshot }
  | { status: "expired" | "invalid" };

export function appendCheckboxDraftValue(
  values: DraftMap,
  name: string,
  value: string,
  checked: boolean
) {
  const selected = Array.isArray(values[name]) ? values[name] : [];
  values[name] = checked ? [...selected, value] : selected;
}

export function isCheckboxSelected(draftValue: DraftValue, checkboxValue: string) {
  return Array.isArray(draftValue) ? draftValue.includes(checkboxValue) : Boolean(draftValue);
}

export function createFormSnapshot(values: DraftMap, updatedAtMs = Date.now()): FormSnapshot {
  return {
    updatedAt: new Date(updatedAtMs).toISOString(),
    values
  };
}

function isDraftMap(value: unknown): value is DraftMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((item) =>
    typeof item === "string"
    || typeof item === "boolean"
    || (Array.isArray(item) && item.every((entry) => typeof entry === "string"))
  );
}

export function parseFormSnapshot(
  raw: string,
  nowMs = Date.now(),
  ttlMs: number | null = STUDENT_FORM_SNAPSHOT_TTL_MS
): ParsedFormSnapshot {
  try {
    const parsed = JSON.parse(raw) as Partial<FormSnapshot>;
    const updatedAt = parsed.updatedAt;
    const updatedAtMs = typeof updatedAt === "string" ? Date.parse(updatedAt) : Number.NaN;
    if (typeof updatedAt !== "string" || !Number.isFinite(updatedAtMs) || !isDraftMap(parsed.values)) {
      return { status: "invalid" };
    }
    if (ttlMs !== null && nowMs - updatedAtMs >= ttlMs) return { status: "expired" };
    return {
      status: "valid",
      snapshot: {
        updatedAt,
        values: parsed.values
      }
    };
  } catch {
    return { status: "invalid" };
  }
}

export function reconcileFormValues(renderedValues: DraftMap, snapshotValues: DraftMap): DraftMap {
  return { ...renderedValues, ...snapshotValues };
}

export function readForm(form: HTMLFormElement): DraftMap {
  const values: DraftMap = {};

  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
      continue;
    }
    if (!element.name) continue;

    if (element instanceof HTMLInputElement && element.type === "checkbox") {
      appendCheckboxDraftValue(values, element.name, element.value, element.checked);
    } else if (element instanceof HTMLInputElement && element.type === "radio") {
      if (!(element.name in values)) values[element.name] = "";
      if (element.checked) values[element.name] = element.value;
    } else {
      values[element.name] = element.value;
    }
  }

  return values;
}

export function restoreForm(form: HTMLFormElement, values: DraftMap) {
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
      continue;
    }
    if (!element.name || !(element.name in values)) continue;

    const value = values[element.name];
    if (element instanceof HTMLInputElement && element.type === "checkbox") {
      element.checked = isCheckboxSelected(value, element.value);
    } else if (element instanceof HTMLInputElement && element.type === "radio" && typeof value === "string") {
      element.checked = element.value === value;
    } else if (typeof value === "string") {
      element.value = value;
    }
  }

  window.dispatchEvent(new CustomEvent("draft-form-restore", { detail: values }));
  window.dispatchEvent(new CustomEvent("proposal-draft-restore", { detail: values }));
}

type StorageScope = "local" | "session";

function browserStorage(scope: StorageScope) {
  return scope === "session" ? window.sessionStorage : window.localStorage;
}

export function StudentRecoverableActionForm({
  action,
  storageKey,
  storage = "local",
  className,
  children,
  id,
  ...formProps
}: {
  action: FormAction;
  storageKey: string;
  storage?: StorageScope;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<"form">, "action" | "children" | "className" | "onChange" | "onInput" | "onSubmit">) {
  const formRef = useRef<HTMLFormElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"idle" | "saved" | "restored">("idle");

  const saveDraft = useCallback((nextStatus: "saved" | "idle" = "idle") => {
    const form = formRef.current;
    if (!form) return;
    try {
      browserStorage(storage).setItem(storageKey, JSON.stringify(createFormSnapshot(readForm(form))));
      if (nextStatus === "saved") setStatus("saved");
    } catch {
      // Storage can be unavailable or full. Never block the server action submission.
    }
  }, [storage, storageKey]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveDraft(), 80);
  }, [saveDraft]);

  useEffect(() => {
    const form = formRef.current;
    const store = browserStorage(storage);
    const raw = store.getItem(storageKey);
    if (!raw || !form) return;
    const parsed = parseFormSnapshot(
      raw,
      Date.now(),
      storage === "local" ? STUDENT_FORM_SNAPSHOT_TTL_MS : null
    );
    if (parsed.status !== "valid") {
      store.removeItem(storageKey);
      return;
    }

    restoreForm(form, reconcileFormValues(readForm(form), parsed.snapshot.values));
    setStatus("restored");
  }, [storage, storageKey]);

  useEffect(() => {
    const listener = () => scheduleSave();
    window.addEventListener("draft-form-field-change", listener);
    window.addEventListener("proposal-draft-field-change", listener);
    return () => {
      window.removeEventListener("draft-form-field-change", listener);
      window.removeEventListener("proposal-draft-field-change", listener);
    };
  }, [scheduleSave]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  return (
    <form
      {...formProps}
      id={id}
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
          {status === "restored" ? "กู้คืนข้อมูลที่เคยกรอกไว้ในเครื่องนี้แล้ว" : "บันทึกร่างไว้ในเครื่องนี้แล้ว ยังไม่ได้ส่งเข้าระบบ"}
        </p>
      ) : null}
    </form>
  );
}
