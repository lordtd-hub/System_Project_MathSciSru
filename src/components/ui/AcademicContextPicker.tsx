"use client";
import { useState } from "react";
import { filterAcademicChoices, retainSelectedAcademicChoice, type AcademicChoice } from "@/lib/terms/academicChoices";
import { SubmitButton } from "./SubmitButton";

export function AcademicContextPicker({ choices, selectedId, action, contextRole, allowHistoricalSearch = true }: {
  choices: AcademicChoice[]; selectedId: string;
  contextRole: "ADMIN" | "TEACHER" | "STUDENT"; allowHistoricalSearch?: boolean;
  action: (form: FormData) => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
  const [selected, setSelected] = useState(selectedId);
  const years = [...new Set(choices.map(choice => choice.yearBe))].sort((a, b) => b - a);
  const filtered = filterAcademicChoices(choices, year, query);
  const retained = retainSelectedAcademicChoice(choices, filtered, selected);
  return <form action={action} className="flex flex-wrap items-end gap-3">
    <input type="hidden" name="view_role" value={contextRole} />
    {allowHistoricalSearch ? <label>ปีการศึกษา
      <select value={year} onChange={event => setYear(event.target.value)}>
        <option value="">ทุกปี</option>
        {years.map(value => <option key={value} value={value}>{value}</option>)}
      </select>
    </label> : null}
    <label className="min-w-0 flex-1">ค้นหาภาคเรียน / รายวิชา / กลุ่ม
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="เช่น 2569 SMA6002 P01" />
    </label>
    <label className="min-w-0 flex-1">ภาคเรียน / รายวิชา / กลุ่ม
      <select name="context_id" value={selected} onChange={event => setSelected(event.target.value)} required>
        {retained ? <optgroup label="รายการที่เลือกอยู่"><option value={retained.id}>{retained.label}</option></optgroup> : null}
        <optgroup label="ผลการค้นหา">{filtered.map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</optgroup>
      </select>
    </label>
    <SubmitButton pendingText="กำลังเปลี่ยนรายวิชา...">ใช้รายวิชาที่เลือก</SubmitButton>
    <p className="w-full text-sm text-muted" role="status">พบ {filtered.length} รายการ{!filtered.length ? " — ยังไม่เปลี่ยนรายวิชาที่เลือกอยู่" : ""}</p>
  </form>;
}
