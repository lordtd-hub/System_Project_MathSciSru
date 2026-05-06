import type { ProjectStatus } from "@prisma/client";

const steps: Array<{ label: string; statuses: ProjectStatus[] }> = [
  { label: "ข้อมูลนักศึกษา", statuses: ["STUDENT_PROFILE"] },
  { label: "ร่างหัวข้อ", statuses: ["DRAFT"] },
  { label: "รอที่ปรึกษาอนุมัติ", statuses: ["PENDING_ADVISOR"] },
  { label: "รอผู้ดูแลระบบยืนยัน", statuses: ["PENDING_ADMIN"] },
  { label: "รอส่ง Proposal", statuses: ["PROPOSAL_PENDING"] },
  { label: "สอบหัวข้อ", statuses: ["PROPOSAL_REVIEW"] },
  { label: "ผู้ดูแลระบบตัดสินผล", statuses: ["PROPOSAL_ADMIN_DECISION"] },
  { label: "หัวข้อผ่านแล้ว", statuses: ["TOPIC_APPROVED"] },
  { label: "กำลังทำโครงงาน", statuses: ["IN_PROGRESS", "REPORT_REVIEW", "REPORT_APPROVED", "ADVISOR_SCORING"] },
  { label: "สอบ Final เสร็จ", statuses: ["FINAL_DONE", "COMPLETED"] }
];

function currentStepIndex(status: ProjectStatus): number {
  const index = steps.findIndex((step) => step.statuses.includes(status));
  return index >= 0 ? index : 0;
}

export function LifecycleStepper({ status }: { status: ProjectStatus }) {
  const current = currentStepIndex(status);

  return (
    <div className="panel">
      <h2 className="text-lg font-semibold">เส้นทางโครงงาน</h2>
      <div className="mt-4 grid gap-2 md:grid-cols-5">
        {steps.map((step, index) => {
          const state = index < current ? "เสร็จแล้ว" : index === current ? "กำลังดำเนินการ" : "ยังล็อกอยู่";
          const className =
            index < current
              ? "border-emerald-300 bg-emerald-50"
              : index === current
                ? "border-brand bg-red-50"
                : "border-line bg-white text-muted";
          return (
            <div key={step.label} className={`rounded-lg border p-3 ${className}`}>
              <div className="text-xs font-semibold">{state}</div>
              <div className="mt-1 text-sm font-medium">{index + 1}. {step.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
