import { proposalQaRubric } from "@/lib/rubrics/proposalQaRubric";

export function ProposalQaRubricPanel({ audience = "student" }: { audience?: "student" | "evaluator" }) {
  return (
    <section className="panel space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand">Proposal rubric</p>
          <h2 className="mt-1 text-lg font-semibold">View proposal evaluation rubric</h2>
          <p className="mt-1 text-sm text-muted">
            {audience === "student"
              ? "เกณฑ์นี้ช่วยให้นักศึกษาเห็นล่วงหน้าว่า Proposal จะถูกอ่านตรวจจากเงื่อนไขใดบ้างก่อนส่ง"
              : "เกณฑ์แบบ condition-based สำหรับบันทึกคะแนน Proposal ตามจำนวนเงื่อนไขที่ผ่านในแต่ละหัวข้อ"}
          </p>
        </div>
        <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold">100 คะแนน</span>
      </div>
      {audience === "student" ? (
        <div className="rounded-md border border-line bg-paper p-3 text-sm text-muted">
          เขียน Proposal ให้ตอบครบ: ปัญหา/บริบท, วัตถุประสงค์ที่ตรวจสอบได้, วิธีดำเนินงานเป็นขั้นตอน,
          ผลที่คาดว่าจะได้รับ, timeline ครบ 16 สัปดาห์ และเอกสารประกอบ/ทฤษฎี/งานที่เกี่ยวข้องเมื่อจำเป็น
        </div>
      ) : null}
      <div className="space-y-3">
        {proposalQaRubric.map((section) => (
          <details key={section.code} className="rounded-md border border-line bg-surface p-3" open={audience === "evaluator"}>
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{section.code}. {section.title}</h3>
                <span className="text-sm font-semibold text-brand">{section.maxScore} คะแนน</span>
              </div>
            </summary>
            <div className="mt-3 space-y-3">
              {section.criteria.map((criterion) => (
                <div key={criterion.code} className="rounded-md border border-line bg-paper p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{criterion.code}. {criterion.title}</div>
                      <div className="text-xs text-muted">เต็ม {criterion.maxScore} คะแนน</div>
                    </div>
                    <div className="text-xs text-muted">
                      {criterion.scoreMappings.map((mapping) => `${mapping.conditionCount}+ = ${mapping.score}`).join(" / ")}
                    </div>
                  </div>
                  {criterion.requiredSections ? (
                    <div className="mt-2 text-sm">
                      <div className="font-medium">Required sections</div>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                        {criterion.requiredSections.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  {criterion.conditions.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                      {criterion.conditions.map((condition) => <li key={condition}>{condition}</li>)}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
