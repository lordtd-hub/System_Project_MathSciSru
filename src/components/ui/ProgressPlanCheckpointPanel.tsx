import type { AssessmentRoundType } from "@prisma/client";
import {
  classifyPlanTaskForRound,
  doesTaskOverlapWeekWindow,
  getProgressRoundWeekWindow,
  normalizeProgressPlanTasks,
  type PlanTaskClassification,
  type ProgressPlanTask
} from "@/lib/qa/progressPlanCheckConfig";

function classificationLabel(classification: PlanTaskClassification) {
  switch (classification) {
    case "due_in_this_round":
      return "ควรเสร็จในรอบนี้";
    case "ongoing_in_this_round":
      return "กำลังดำเนินต่อเนื่อง";
    case "previous_task":
      return "งานก่อนรอบนี้";
    case "future_task":
      return "งานหลังรอบนี้";
  }
}

function taskKey(task: ProgressPlanTask, index: number) {
  return `${index}-${task.startWeek}-${task.endWeek}-${task.activity}`;
}

export function ProgressPlanCheckpointPanel({
  roundType,
  timelineItems,
  audience = "evaluator"
}: {
  roundType: AssessmentRoundType | "PROGRESS_1" | "PROGRESS_2";
  timelineItems: unknown;
  audience?: "student" | "evaluator";
}) {
  const weekWindow = getProgressRoundWeekWindow(roundType);
  const tasks = normalizeProgressPlanTasks(timelineItems);
  if (!weekWindow) return null;

  const classifiedTasks = tasks.map((task) => ({
    task,
    classification: classifyPlanTaskForRound(task, weekWindow),
    relevant: doesTaskOverlapWeekWindow(task, weekWindow)
  }));
  const relevantTasks = classifiedTasks.filter((item) => item.relevant);
  const roundName = roundType === "PROGRESS_1" ? "การสอบความก้าวหน้าครั้งที่ 1" : "การสอบความก้าวหน้าครั้งที่ 2";

  return (
    <section className="panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">ตรวจแผนดำเนินงานสำหรับ{roundName}</h2>
          <p className="mt-1 text-sm text-muted">
            ตรวจเทียบงานความก้าวหน้ากับแผน 16 สัปดาห์ในเอกสารเสนอหัวข้อ ช่วงสัปดาห์ที่ {weekWindow.startWeek}-{weekWindow.endWeek}
          </p>
        </div>
        <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold">
          {relevantTasks.length}/{tasks.length} งานเกี่ยวข้อง
        </span>
      </div>

      {audience === "student" ? (
        <div className="mt-3 rounded-md border border-line bg-paper p-3 text-sm text-muted">
          รายงานความก้าวหน้าจะถูกตรวจเทียบกับแผนงานที่ส่งไว้ในเอกสารเสนอหัวข้อ สำหรับงานที่เกี่ยวข้องแต่ละรายการ ให้ระบุว่างานใดเสร็จแล้ว มีหลักฐานใดรองรับ และมีความล่าช้าหรือการปรับแผนหรือไม่
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-line bg-paper p-3 text-sm text-muted">
          ใช้ส่วนนี้เป็นตัวช่วยอ่านตรวจเท่านั้น ยังไม่เปลี่ยนสูตรคะแนนหรือการบันทึกคะแนนเดิม
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">แผนดำเนินงานจากเอกสารเสนอหัวข้อที่ได้รับอนุมัติ</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="py-2">งาน</th>
                  <th className="w-24 py-2">สัปดาห์</th>
                  <th className="py-2">หลักฐานที่คาดหวัง</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length ? (
                  tasks.map((task, index) => (
                    <tr key={taskKey(task, index)} className="border-b border-line last:border-0">
                      <td className="py-2">{task.activity || "ยังไม่ระบุงาน"}</td>
                      <td className="py-2">
                        {task.startWeek}-{task.endWeek}
                      </td>
                      <td className="py-2 text-muted">{task.deliverable || "ยังไม่ระบุหลักฐาน"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-3 text-muted" colSpan={3}>
                      ยังไม่มีแผนดำเนินงานแบบเป็นรายการจากเอกสารเสนอหัวข้อ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold">รายการตรวจสำหรับรอบสอบความก้าวหน้าปัจจุบัน</h3>
          <div className="mt-2 space-y-2">
            {relevantTasks.length ? (
              relevantTasks.map(({ task, classification }, index) => (
                <div key={taskKey(task, index)} className="rounded-md border border-line bg-surface p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="font-medium">{task.activity || "ยังไม่ระบุงาน"}</div>
                    <span className="rounded-full border border-line px-2 py-1 text-xs">{classificationLabel(classification)}</span>
                  </div>
                  <div className="mt-1 text-muted">
                    สัปดาห์ {task.startWeek}-{task.endWeek} · หลักฐาน: {task.deliverable || "ยังไม่ระบุ"}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-md border border-line bg-surface p-3 text-sm text-muted">ยังไม่พบงานในแผนที่คาบเกี่ยวกับรอบนี้</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
