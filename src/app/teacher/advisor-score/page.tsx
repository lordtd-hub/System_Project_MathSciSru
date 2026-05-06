import { auth } from "@/auth";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { submitAdvisorScore } from "@/app/teacher/actions";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { MarkdownLatexEditor } from "@/components/ui/MarkdownLatexEditor";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/db";
import { advisorCriteria } from "@/lib/scoring/advisorScoring";

function fieldName(key: string) {
  if (key === "researchProcess") return "research_process";
  if (key === "problemSolving") return "problem_solving";
  return key;
}

function previousValue(score: {
  responsibilityScore: number | null;
  researchProcessScore: number | null;
  problemSolvingScore: number | null;
  communicationScore: number | null;
  professionalismScore: number | null;
} | null | undefined, key: string) {
  if (!score) return 0;
  if (key === "responsibility") return score.responsibilityScore ?? 0;
  if (key === "researchProcess") return score.researchProcessScore ?? 0;
  if (key === "problemSolving") return score.problemSolvingScore ?? 0;
  if (key === "communication") return score.communicationScore ?? 0;
  if (key === "professionalism") return score.professionalismScore ?? 0;
  return 0;
}

export default async function TeacherAdvisorScorePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!hasApprovedTeacherCapability(session?.user) || !session?.user.id) {
    return <div className="panel">หน้านี้สำหรับอาจารย์เท่านั้น</div>;
  }

  const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
  if (!teacher) {
    return <EmptyState title="ยังไม่พบโปรไฟล์อาจารย์" description="กรุณา claim โปรไฟล์และรอผู้ดูแลระบบอนุมัติก่อนใช้งาน" />;
  }

  const params = (await searchParams) ?? {};
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { advisorRequests: { some: { advisorTeacherId: teacher.id, status: "APPROVED" } } },
        { committeeAssignments: { some: { teacherId: teacher.id, active: true, role: "ADVISOR" } } }
      ],
      status: { in: ["FINAL_DONE", "REPORT_REVIEW", "REPORT_APPROVED", "ADVISOR_SCORING"] }
    },
    include: {
      student: true,
      reportVersions: { include: { reviews: true }, orderBy: { versionNo: "desc" } },
      advisorScore: true
    },
    orderBy: { updatedAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Advisor score 25%"
        description="บันทึกคะแนนอาจารย์ที่ปรึกษาหลังเล่มรายงานผ่านแล้ว ระบบยังไม่ปิดงานเป็น COMPLETED ในขั้นตอนนี้"
      />
      <ActionFeedback success={params.success} error={params.error} />
      <GuidancePanel
        title="Advisor score"
        current="เปิดให้บันทึกเมื่อ project อยู่ที่ REPORT_APPROVED"
        next="เมื่อบันทึกแล้ว project จะอยู่ที่ ADVISOR_SCORING เพื่อรอ final closeout โดย Admin"
        actor="อาจารย์ที่ปรึกษาของโครงงานเท่านั้น"
      />

      <div className="space-y-4">
        {projects.length ? (
          projects.map((project) => {
            const editable = project.status === "REPORT_APPROVED" || project.status === "ADVISOR_SCORING";
            const previous = project.advisorScore;
            const latestReport = project.reportVersions[0];
            return (
              <section key={project.id} className="panel">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}
                    </p>
                  </div>
                  <StatusBadge status={project.status} />
                </div>

                <div className="mt-3 rounded-md border border-line bg-paper p-3 text-sm text-muted">
                  Report: {latestReport ? `version ${latestReport.versionNo}` : "ยังไม่มีเล่มรายงาน"} · Advisor score:{" "}
                  {previous?.status === "SUBMITTED" ? `บันทึกแล้ว ${Number(previous.score ?? 0)}/100` : editable ? "พร้อมบันทึก" : "ยังล็อก"}
                </div>

                {!editable ? (
                  <div className="mt-4 rounded-md border border-line p-3 text-sm text-muted">
                    ยังไม่สามารถให้คะแนน Advisor ได้ ต้องรอให้เล่มรายงานผ่านเป็น REPORT_APPROVED ก่อน
                  </div>
                ) : (
                  <form action={submitAdvisorScore} className="mt-4 grid gap-4 md:grid-cols-5">
                    <input type="hidden" name="project_id" value={project.id} />
                    {advisorCriteria.map((criterion) => (
                      <div key={criterion.key}>
                        <label>
                          {criterion.label} ({criterion.max})
                        </label>
                        <input
                          name={fieldName(criterion.key)}
                          type="number"
                          min="0"
                          max={criterion.max}
                          step="1"
                          defaultValue={previousValue(previous, criterion.key)}
                          required
                        />
                      </div>
                    ))}
                    <div className="md:col-span-5">
                      <MarkdownLatexEditor name="comment" label="Comment / feedback" defaultValue={previous?.comment ?? ""} rows={4} required={false} />
                    </div>
                    <div className="md:col-span-5">
                      <SubmitButton pendingText="กำลังบันทึกคะแนน..." confirmMessage="ยืนยันการบันทึก Advisor score 25% หรือไม่?">
                        บันทึก Advisor score 25%
                      </SubmitButton>
                    </div>
                  </form>
                )}
              </section>
            );
          })
        ) : (
          <EmptyState
            title="ยังไม่มีโครงงานที่เป็นที่ปรึกษา"
            description="รายการจะแสดงเมื่อท่านเป็น advisor ของโครงงานที่เข้าสู่ช่วง report / advisor scoring"
          />
        )}
      </div>
    </div>
  );
}
