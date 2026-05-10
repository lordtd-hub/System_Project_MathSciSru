"use client";

import { useMemo, useState } from "react";

type TimelineRow = {
  activity: string;
  weeks: string;
};

function escapeCell(value: string) {
  return value.replace(/\|/g, "\\|").trim();
}

function parseTimeline(defaultValue?: string | null): TimelineRow[] {
  const text = defaultValue?.trim();
  if (!text) return [{ activity: "", weeks: "" }];

  const tableRows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"))
    .filter((line) => !/^\|\s*-+/.test(line));

  const parsedRows = tableRows
    .slice(1)
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 3)
    .map((cells) => ({
      activity: cells[1]?.replace(/\\\|/g, "|") ?? "",
      weeks: cells[2]?.replace(/สัปดาห์/g, "").trim() ?? ""
    }))
    .filter((row) => row.activity || row.weeks);

  if (parsedRows.length) return parsedRows;
  return [{ activity: text, weeks: "" }];
}

function buildTimelineMarkdown(rows: TimelineRow[]) {
  const filledRows = rows.filter((row) => row.activity.trim() || row.weeks.trim());
  if (!filledRows.length) return "";

  const lines = [
    "| ลำดับ | สิ่งที่จะทำ | ระยะเวลาโดยประมาณ |",
    "|---:|---|---|"
  ];

  filledRows.forEach((row, index) => {
    const weeks = row.weeks.trim();
    lines.push(`| ${index + 1} | ${escapeCell(row.activity)} | ${weeks ? `${escapeCell(weeks)} สัปดาห์` : "ยังไม่ระบุ"} |`);
  });

  return lines.join("\n");
}

export function ProposalTimelineBuilder({
  defaultValue
}: {
  defaultValue?: string | null;
}) {
  const [rows, setRows] = useState<TimelineRow[]>(() => parseTimeline(defaultValue));
  const timelineMarkdown = useMemo(() => buildTimelineMarkdown(rows), [rows]);

  function updateRow(index: number, key: keyof TimelineRow, value: string) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
  }

  function addRow() {
    setRows((current) => [...current, { activity: "", weeks: "" }]);
  }

  function removeRow(index: number) {
    setRows((current) => {
      const next = current.filter((_, rowIndex) => rowIndex !== index);
      return next.length ? next : [{ activity: "", weeks: "" }];
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <label>
          แผนดำเนินงาน<span className="ml-1 text-brand" aria-label="จำเป็นต้องกรอก">*</span>
        </label>
        <p className="mt-1 text-xs text-muted">กรอกเป็นขั้นตอนสั้น ๆ ระบบจะจัดเป็นตาราง timeline ให้อัตโนมัติ</p>
      </div>
      <input type="hidden" name="timeline" value={timelineMarkdown} />
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="grid gap-2 rounded-md border border-line bg-surface p-3 md:grid-cols-[auto_1fr_140px_auto] md:items-end">
            <div className="text-sm font-semibold text-muted">ขั้นที่ {index + 1}</div>
            <div>
              <label className="text-xs text-muted" htmlFor={`timeline_activity_${index}`}>ทำอะไร</label>
              <input
                id={`timeline_activity_${index}`}
                value={row.activity}
                required={index === 0}
                placeholder="เช่น ศึกษาเอกสารและรวบรวมข้อมูล"
                onChange={(event) => updateRow(index, "activity", event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted" htmlFor={`timeline_weeks_${index}`}>กี่สัปดาห์</label>
              <input
                id={`timeline_weeks_${index}`}
                value={row.weeks}
                inputMode="decimal"
                placeholder="เช่น 2"
                onChange={(event) => updateRow(index, "weeks", event.target.value)}
              />
            </div>
            <button
              type="button"
              className="button-secondary h-10 px-3 text-sm"
              onClick={() => removeRow(index)}
              disabled={rows.length === 1}
            >
              ลบ
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="button-secondary" onClick={addRow}>
        + เพิ่มขั้นตอน
      </button>
      <div className="rounded-md border border-line bg-paper p-3 text-sm">
        <div className="mb-2 font-semibold">ตัวอย่าง timeline ที่จะส่ง</div>
        {timelineMarkdown ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="w-16 py-2">ลำดับ</th>
                  <th className="py-2">สิ่งที่จะทำ</th>
                  <th className="w-40 py-2">ระยะเวลา</th>
                </tr>
              </thead>
              <tbody>
                {rows.filter((row) => row.activity.trim() || row.weeks.trim()).map((row, index) => (
                  <tr key={index} className="border-b border-line last:border-0">
                    <td className="py-2">{index + 1}</td>
                    <td className="py-2">{row.activity || "ยังไม่ระบุ"}</td>
                    <td className="py-2">{row.weeks ? `${row.weeks} สัปดาห์` : "ยังไม่ระบุ"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">เพิ่มขั้นตอนอย่างน้อย 1 รายการ</p>
        )}
      </div>
    </div>
  );
}
