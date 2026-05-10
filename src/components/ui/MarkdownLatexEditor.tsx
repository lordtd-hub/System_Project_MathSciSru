"use client";

import { useEffect, useState } from "react";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";

export function MarkdownLatexEditor({
  name,
  label,
  value,
  onChange,
  defaultValue,
  placeholder,
  helpText,
  minRows,
  rows = 6,
  required = true,
  disabled = false,
  readOnly = false
}: {
  name: string;
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  defaultValue?: string | null;
  placeholder?: string;
  helpText?: string;
  minRows?: number;
  rows?: number;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState(value ?? defaultValue ?? "");

  useEffect(() => {
    if (value !== undefined) setDraft(value);
  }, [value]);

  useEffect(() => {
    function restoreDraft(event: Event) {
      const values = (event as CustomEvent<Record<string, string | boolean>>).detail;
      const restored = values?.[name];
      if (typeof restored === "string") setDraft(restored);
    }

    window.addEventListener("draft-form-restore", restoreDraft);
    window.addEventListener("proposal-draft-restore", restoreDraft);
    return () => {
      window.removeEventListener("draft-form-restore", restoreDraft);
      window.removeEventListener("proposal-draft-restore", restoreDraft);
    };
  }, [name]);

  const helper = helpText ?? "ใช้ `$...$` สำหรับสมการในบรรทัด และใช้ `$$...$$` สำหรับสมการแยกบรรทัด ไม่อนุญาต raw HTML";

  return (
    <div className="markdown-latex-editor grid gap-3 lg:grid-cols-2">
      <div className="space-y-1.5">
        <label htmlFor={name}>
          {label}
          {required ? <span className="ml-1 text-brand" aria-label="จำเป็นต้องกรอก">*</span> : null}
        </label>
        <div className="rounded-t-md border border-b-0 border-line bg-paper px-3 py-2 text-xs font-medium">เขียน</div>
        <textarea
          id={name}
          name={name}
          rows={minRows ?? rows}
          required={required}
          value={draft}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          onChange={(event) => {
            setDraft(event.target.value);
            onChange?.(event.target.value);
          }}
        />
        <p className="text-xs text-muted">{helper}</p>
      </div>
      <div className="space-y-1.5">
        <div className="text-sm font-medium">แสดงตัวอย่าง</div>
        <div className="rounded-t-md border border-b-0 border-line bg-paper px-3 py-2 text-xs font-medium">Preview</div>
        <MarkdownLatexViewer value={draft} emptyText="ตัวอย่าง Markdown และ LaTeX จะแสดงที่นี่" />
      </div>
    </div>
  );
}
