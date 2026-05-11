"use client";

import { useEffect, useMemo, useState } from "react";

type TimelineRow = {
  activity: string;
  startWeek: string;
  endWeek: string;
  deliverable: string;
};

const weekOptions = Array.from({ length: 16 }, (_, index) => String(index + 1));

function escapeCell(value: string) {
  return value.replace(/\|/g, "\\|").trim();
}

function safeSpreadsheetCell(value: string) {
  const trimmed = value.trim();
  return /^[=+\-@\t\r\n]/.test(trimmed) ? `'${trimmed}` : trimmed;
}

function csvCell(value: string | number) {
  const safe = safeSpreadsheetCell(String(value));
  return `"${safe.replace(/"/g, '""')}"`;
}

function normalizeWeek(value: string, fallback = "1") {
  const week = Number.parseInt(value, 10);
  if (!Number.isFinite(week)) return fallback;
  return String(Math.min(16, Math.max(1, week)));
}

function emptyRow(): TimelineRow {
  return { activity: "", startWeek: "1", endWeek: "1", deliverable: "" };
}

function parseTimelineItems(raw?: string | null): TimelineRow[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<Partial<TimelineRow>>;
    return parsed
      .map((item) => ({
        activity: String(item.activity ?? ""),
        startWeek: normalizeWeek(String(item.startWeek ?? "1")),
        endWeek: normalizeWeek(String(item.endWeek ?? item.startWeek ?? "1")),
        deliverable: String(item.deliverable ?? "")
      }))
      .filter((row) => row.activity || row.deliverable);
  } catch {
    return [];
  }
}

function parseTimeline(defaultValue?: string | null, defaultItemsJson?: string | null): TimelineRow[] {
  const structured = parseTimelineItems(defaultItemsJson);
  if (structured.length) return structured;

  const text = defaultValue?.trim();
  if (!text) return [emptyRow()];

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
      startWeek: normalizeWeek(cells[2]?.match(/\d+/)?.[0] ?? "1"),
      endWeek: normalizeWeek(cells[2]?.match(/-\s*(\d+)/)?.[1] ?? cells[2]?.match(/\d+/)?.[0] ?? "1"),
      deliverable: cells[3]?.replace(/\\\|/g, "|") ?? ""
    }))
    .filter((row) => row.activity || row.deliverable);

  if (parsedRows.length) return parsedRows;
  return [{ activity: text, startWeek: "1", endWeek: "1", deliverable: "" }];
}

function filledRows(rows: TimelineRow[]) {
  return rows
    .map((row) => {
      const start = Number.parseInt(row.startWeek, 10);
      const end = Number.parseInt(row.endWeek, 10);
      return {
        ...row,
        startWeek: normalizeWeek(row.startWeek),
        endWeek: normalizeWeek(row.endWeek, row.startWeek),
        duration: Math.max(1, end - start + 1)
      };
    })
    .filter((row) => row.activity.trim() || row.deliverable.trim());
}

function buildTimelineMarkdown(rows: TimelineRow[]) {
  const items = filledRows(rows);
  if (!items.length) return "";

  const lines = [
    "| ลำดับ | งาน | ช่วงสัปดาห์ | ผลลัพธ์/หลักฐานที่คาดว่าจะได้ |",
    "|---:|---|---:|---|"
  ];

  items.forEach((row, index) => {
    const weekRange = row.startWeek === row.endWeek ? `สัปดาห์ ${row.startWeek}` : `สัปดาห์ ${row.startWeek}-${row.endWeek}`;
    lines.push(`| ${index + 1} | ${escapeCell(row.activity)} | ${weekRange} | ${escapeCell(row.deliverable || "ยังไม่ระบุ")} |`);
  });

  return lines.join("\n");
}

function buildCsv(rows: TimelineRow[]) {
  const items = filledRows(rows);
  const lines = [["ลำดับ", "งาน", "สัปดาห์เริ่ม", "สัปดาห์สิ้นสุด", "ระยะเวลา (สัปดาห์)", "ผลลัพธ์/หลักฐาน"].map(csvCell).join(",")];
  items.forEach((row, index) => {
    lines.push([
      csvCell(index + 1),
      csvCell(row.activity),
      csvCell(row.startWeek),
      csvCell(row.endWeek),
      csvCell(row.duration),
      csvCell(row.deliverable)
    ].join(","));
  });
  return `\uFEFF${lines.join("\r\n")}`;
}

export function ProposalTimelineBuilder({
  defaultValue,
  defaultItemsJson,
  showAssessmentHint = false
}: {
  defaultValue?: string | null;
  defaultItemsJson?: string | null;
  showAssessmentHint?: boolean;
}) {
  const [rows, setRows] = useState<TimelineRow[]>(() => parseTimeline(defaultValue, defaultItemsJson));
  const timelineMarkdown = useMemo(() => buildTimelineMarkdown(rows), [rows]);
  const timelineItemsJson = useMemo(() => JSON.stringify(filledRows(rows)), [rows]);
  const hasInvalidRange = rows.some((row) => Number(row.endWeek) < Number(row.startWeek));

  useEffect(() => {
    function restoreDraft(event: Event) {
      const values = (event as CustomEvent<Record<string, string | boolean>>).detail;
      const restoredItems = values?.timeline_items_json;
      const restoredMarkdown = values?.timeline;
      if (typeof restoredItems === "string") setRows(parseTimeline(undefined, restoredItems));
      else if (typeof restoredMarkdown === "string") setRows(parseTimeline(restoredMarkdown));
    }

    window.addEventListener("draft-form-restore", restoreDraft);
    window.addEventListener("proposal-draft-restore", restoreDraft);
    return () => {
      window.removeEventListener("draft-form-restore", restoreDraft);
      window.removeEventListener("proposal-draft-restore", restoreDraft);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("draft-form-field-change"));
    window.dispatchEvent(new CustomEvent("proposal-draft-field-change"));
  }, [timelineMarkdown, timelineItemsJson]);

  function updateRow(index: number, key: keyof TimelineRow, value: string) {
    setRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const next = { ...row, [key]: value };
        if (key === "startWeek" && Number(next.endWeek) < Number(value)) next.endWeek = value;
        return next;
      })
    );
  }

  function addRow() {
    setRows((current) => [...current, emptyRow()]);
  }

  function removeRow(index: number) {
    setRows((current) => {
      const next = current.filter((_, rowIndex) => rowIndex !== index);
      return next.length ? next : [emptyRow()];
    });
  }

  function exportCsv() {
    const blob = new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "proposal-timeline-16-weeks.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div>
        <label>
          แผนการดำเนินงาน 16 สัปดาห์<span className="ml-1 text-brand" aria-label="จำเป็นต้องกรอก">*</span>
        </label>
        <p className="mt-1 text-xs text-muted">
          ระบุช่วงสัปดาห์เริ่ม-สิ้นสุดของแต่ละงาน เพื่อให้เห็นงานที่ทำคาบเกี่ยวกันได้ชัดเจน
        </p>
        {showAssessmentHint ? (
          <div className="mt-3 rounded-md border border-line bg-paper p-3 text-sm text-muted">
            <div className="font-semibold text-ink">Assessment alignment hint</div>
            <p className="mt-1">
              แผนดำเนินงานด้านล่างจะถูกใช้ประกอบการประเมินการสอบความก้าวหน้าครั้งที่ 1 และครั้งที่ 2 แต่ละงานควรเป็นงานที่สังเกตหรือตรวจสอบได้ พร้อมระบุหลักฐานที่คาดว่าจะส่ง ไม่ใช่เพียงกิจกรรมกว้าง ๆ
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <div>
                <div className="font-medium text-ink">Good examples</div>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>Study related fixed point theorems and summarize assumptions used in each theorem.</li>
                  <li>Implement prototype login and role guard, with screenshots or test account evidence.</li>
                  <li>Prove Lemma 1 and prepare the proof draft.</li>
                  <li>Run numerical experiment and record dataset/result table.</li>
                </ul>
              </div>
              <div>
                <div className="font-medium text-ink">Weak examples</div>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>Study more</li>
                  <li>Continue working</li>
                  <li>ปรับปรุงชิ้นงานตามข้อเสนอแนะที่ระบุไว้</li>
                  <li>Prepare presentation</li>
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <input type="hidden" name="timeline" value={timelineMarkdown} />
      <input type="hidden" name="timeline_items_json" value={timelineItemsJson} />
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="grid gap-2 rounded-md border border-line bg-surface p-3 md:grid-cols-[auto_1fr_112px_112px_1fr_auto] md:items-end">
            <div className="text-sm font-semibold text-muted">งานที่ {index + 1}</div>
            <div>
              <label className="text-xs text-muted" htmlFor={`timeline_activity_${index}`}>ทำอะไร</label>
              <input
                id={`timeline_activity_${index}`}
                value={row.activity}
                required={index === 0}
                placeholder="เช่น ศึกษาเอกสารที่เกี่ยวข้อง"
                onChange={(event) => updateRow(index, "activity", event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted" htmlFor={`timeline_start_${index}`}>เริ่มสัปดาห์</label>
              <select id={`timeline_start_${index}`} value={row.startWeek} onChange={(event) => updateRow(index, "startWeek", event.target.value)}>
                {weekOptions.map((week) => <option key={week} value={week}>{week}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted" htmlFor={`timeline_end_${index}`}>จบสัปดาห์</label>
              <select id={`timeline_end_${index}`} value={row.endWeek} onChange={(event) => updateRow(index, "endWeek", event.target.value)}>
                {weekOptions.map((week) => <option key={week} value={week}>{week}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted" htmlFor={`timeline_deliverable_${index}`}>ผลลัพธ์/หลักฐาน</label>
              <input
                id={`timeline_deliverable_${index}`}
                value={row.deliverable}
                placeholder="เช่น สรุปเอกสารอ้างอิงเบื้องต้น"
                onChange={(event) => updateRow(index, "deliverable", event.target.value)}
              />
            </div>
            <button type="button" className="button-secondary h-10 px-3 text-sm" onClick={() => removeRow(index)} disabled={rows.length === 1}>
              ลบ
            </button>
          </div>
        ))}
      </div>
      {hasInvalidRange ? <p className="text-sm text-brand">สัปดาห์สิ้นสุดต้องไม่อยู่ก่อนสัปดาห์เริ่ม</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" className="button-secondary" onClick={addRow}>+ เพิ่มงาน</button>
        <button type="button" className="button-secondary" onClick={exportCsv} disabled={!filledRows(rows).length}>Export แผนงาน CSV</button>
      </div>
      <div className="rounded-md border border-line bg-paper p-3 text-sm">
        <div className="mb-2 font-semibold">ตัวอย่างแผนงาน 16 สัปดาห์ที่จะส่ง</div>
        {timelineMarkdown ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="w-14 py-2">ลำดับ</th>
                  <th className="py-2">งาน</th>
                  {weekOptions.map((week) => <th key={week} className="w-9 py-2 text-center">{week}</th>)}
                  <th className="w-56 py-2">ผลลัพธ์/หลักฐาน</th>
                </tr>
              </thead>
              <tbody>
                {filledRows(rows).map((row, index) => {
                  const start = Number(row.startWeek);
                  const end = Number(row.endWeek);
                  return (
                    <tr key={index} className="border-b border-line last:border-0">
                      <td className="py-2">{index + 1}</td>
                      <td className="py-2">{row.activity || "ยังไม่ระบุ"}</td>
                      {weekOptions.map((week) => {
                        const current = Number(week);
                        const active = current >= start && current <= end;
                        return <td key={week} className="p-1 text-center">{active ? <span className="block rounded-sm bg-brand/80 text-[10px] text-white">&nbsp;</span> : null}</td>;
                      })}
                      <td className="py-2 text-muted">{row.deliverable || "ยังไม่ระบุ"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">เพิ่มงานอย่างน้อย 1 รายการ</p>
        )}
      </div>
    </div>
  );
}
