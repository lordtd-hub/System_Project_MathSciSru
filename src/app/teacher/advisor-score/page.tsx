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
    return <EmptyState title="ยังไม่พบโปรไฟล์อาจารย์" description="กรุณาส่งคำขอผูกบัญชีกับโปรไฟล์อาจารย์และรอผู้ดูแลระบบอนุมัติก่อนใช้งาน" />;
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
        title="คะแนนสรุปของอาจารย์ที่ปรึกษา 25%"
        description="บันทึกคะแนนสรุปของอาจารย์ที่ปรึกษาหลังเล่มรายงานผ่านการตรวจแล้ว ระบบยังไม่ยืนยันจบโครงงานในขั้นตอนนี้"
      />
      <ActionFeedback success={params.success} error={params.error} />
      <GuidancePanel
        title="คะแนนสรุปของอาจารย์ที่ปรึกษา"
        current="เปิดให้บันทึกเมื่อรายงานฉบับสมบูรณ์ผ่านการตรวจแล้ว"
        next="เมื่อบันทึกแล้ว โครงงานจะรอผู้ดูแลระบบตรวจเงื่อนไขและยืนยันจบโครงงาน"
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
                  รายงาน: {latestReport ? `ฉบับที่ ${latestReport.versionNo}` : "ยังไม่มีเล่มรายงาน"} · คะแนนที่ปรึกษา:{" "}
                  {previous?.status === "SUBMITTED" ? `บันทึกแล้ว ${Number(previous.score ?? 0)}/100` : editable ? "พร้อมบันทึก" : "ยังล็อก"}
                </div>

                {!editable ? (
                  <div className="mt-4 rounded-md border border-line p-3 text-sm text-muted">
                    ยังไม่สามารถบันทึกคะแนนสรุปของอาจารย์ที่ปรึกษาได้ ต้องรอให้เล่มรายงานผ่านการตรวจก่อน
                  </div>
                ) : (
                  <form action={submitAdvisorScore} className="mt-4 space-y-4">
                    <input type="hidden" name="project_id" value={project.id} />
                    <div className="rounded-md border border-line bg-paper p-3">
                      <h3 className="text-sm font-semibold">เกณฑ์คะแนนสรุปของอาจารย์ที่ปรึกษา</h3>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {advisorCriteria.map((criterion) => (
                          <label key={criterion.key} className="rounded-md border border-line bg-surface p-3 text-sm">
                            <span className="font-medium">{criterion.label}</span>
                            <span className="ml-2 text-muted">เต็ม {criterion.max}</span>
                            <input
                              className="mt-2"
                              name={fieldName(criterion.key)}
                              type="number"
                              min="0"
                              max={criterion.max}
                              step="1"
                              defaultValue={previousValue(previous, criterion.key)}
                              required
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                    <MarkdownLatexEditor name="comment" label="ข้อเสนอแนะสำหรับนักศึกษา" defaultValue={previous?.comment ?? ""} rows={4} required={false} />
                    <div>
                      <SubmitButton pendingText="กำลังบันทึกคะแนน..." confirmMessage="ยืนยันการบันทึกคะแนนสรุปของอาจารย์ที่ปรึกษา 25% หรือไม่?">
                        บันทึกคะแนนสรุป 25%
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
            description="รายการจะแสดงเมื่อท่านเป็นอาจารย์ที่ปรึกษาของโครงงานที่เข้าสู่ช่วงตรวจรายงานหรือบันทึกคะแนนสรุป"
          />
        )}
      </div>
    </div>
  );
}
