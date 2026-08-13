import React from "react";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import type { ProposalRevisionView } from "@/lib/proposals/proposalRevisionView";

const contentSections: Array<{ key: keyof ProposalRevisionView; label: string }> = [
  { key: "abstractText", label: "บทคัดย่อการนำเสนอ" },
  { key: "motivationBackground", label: "ที่มาและความสำคัญ" },
  { key: "objectives", label: "วัตถุประสงค์" },
  { key: "proposedMethods", label: "วิธีดำเนินงาน" },
  { key: "expectedOutcomes", label: "ผลที่คาดว่าจะได้รับ" },
  { key: "timeline", label: "แผนการดำเนินงาน 16 สัปดาห์" },
  { key: "questionsForTeachers", label: "คำถามหรือประเด็นที่ต้องการให้อาจารย์ช่วยพิจารณา" }
];

export function ProposalRevisionDetails({ revision }: { revision: ProposalRevisionView }) {
  return (
    <section className="space-y-4" data-testid="proposal-revision-latest-details">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <h3 className="font-semibold">ข้อมูล Proposal ฉบับล่าสุดที่นักศึกษาส่ง</h3>
          <p className="mt-1 text-sm text-muted">ตรวจข้อมูลในระบบให้ครบทุกช่องก่อนรับรองการแก้ไข</p>
        </div>
        <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold">
          ฉบับที่ {revision.versionNo}
        </span>
      </div>

      <dl className="grid gap-3 text-sm md:grid-cols-2">
        <div>
          <dt className="font-medium text-muted">ชื่อเอกสารเสนอหัวข้อภาษาไทย</dt>
          <dd className="mt-1 font-medium">{revision.titleTh || "ยังไม่มีข้อมูล"}</dd>
        </div>
        <div>
          <dt className="font-medium text-muted">ชื่อเอกสารเสนอหัวข้อภาษาอังกฤษ</dt>
          <dd className="mt-1 font-medium">{revision.titleEn || "ยังไม่มีข้อมูล"}</dd>
        </div>
      </dl>

      <div className="divide-y divide-line border-y border-line">
        {contentSections.map(({ key, label }) => (
          <section className="py-4" key={key}>
            <h4 className="text-sm font-semibold">{label}</h4>
            <MarkdownLatexViewer
              className="mt-2 border-0 bg-transparent p-0"
              value={String(revision[key] ?? "")}
              emptyText="ยังไม่มีข้อมูล"
            />
          </section>
        ))}
      </div>

      <div className="space-y-2 text-sm">
        <div className="font-semibold">ลิงก์เอกสารประกอบ</div>
        {revision.materialLink ? (
          <a className="inline-flex text-brand underline" href={revision.materialLink} target="_blank" rel="noreferrer">
            เปิดเอกสารประกอบฉบับล่าสุด
          </a>
        ) : (
          <p className="text-muted">ยังไม่มีลิงก์เอกสารประกอบ</p>
        )}
        <p className="text-muted">
          คำรับรองของนักศึกษา: {revision.declarationAccepted ? "รับรองแล้ว" : "ยังไม่ได้รับรอง"}
        </p>
      </div>
    </section>
  );
}
