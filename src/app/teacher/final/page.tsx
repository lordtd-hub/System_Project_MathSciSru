import { auth } from "@/auth";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { MarkdownLatexEditor } from "@/components/ui/MarkdownLatexEditor";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/db";
import { finalCriteria, finalRawScoreMax } from "@/lib/scoring/finalScoring";
import { submitFinalPresentationScore } from "../actions";

export default async function TeacherFinalPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!hasApprovedTeacherCapability(session?.user) || !session?.user.id) return <div className="panel">หน้านี้สำหรับอาจารย์เท่านั้น</div>;
  const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
  if (!teacher) return <EmptyState title="ยังไม่พบโปรไฟล์อาจารย์" description="กรุณา claim โปรไฟล์ก่อนใช้งาน" />;
  const params = (await searchParams) ?? {};

  const finalRound = await prisma.assessmentRound.findFirst({
    where: { roundType: "FINAL_PRESENTATION" },
    orderBy: { createdAt: "desc" }
  });

  const projects = finalRound
    ? await prisma.project.findMany({
        where: {
          status: "IN_PROGRESS",
          courseOfferingId: finalRound.courseOfferingId,
          committeeAssignments: { some: { teacherId: teacher.id, active: true, role: { in: ["HEAD", "MEMBER"] } } }
        },
        include: {
          student: true,
          attempts: {
            where: { assessmentRound: { roundType: "FINAL_PRESENTATION" } },
            include: {
              evaluatorAssignments: {
                where: { evaluatorUserId: session.user.id },
                include: { scoreSubmission: { include: { scoreItems: { include: { rubricItem: true } } } } }
              }
            }
          }
        },
        orderBy: { updatedAt: "desc" }
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="บันทึกคะแนน Final Presentation" description="สำหรับ HEAD/MEMBER ที่ได้รับแต่งตั้งในโครงงานเท่านั้น" />
      <ActionFeedback success={params.success} error={params.error} />
      <GuidancePanel
        title="Final Presentation scoring"
        current={`ให้คะแนน 4 หมวด รวม ${finalRawScoreMax} คะแนนดิบ แล้วระบบแปลงเป็นคะแนนเต็ม 100 เพื่อบันทึกในระบบ`}
        next="ระบบบันทึกคะแนนไว้ก่อน ยังไม่เปลี่ยน lifecycle หรือเริ่ม report approval loop อัตโนมัติ"
        actor="HEAD หรือ MEMBER ที่ได้รับแต่งตั้ง"
      />
      {!finalRound ? (
        <EmptyState title="ยังไม่มีรอบ Final Presentation" description="ผู้ดูแลระบบต้องเปิดรอบ Final Presentation ระดับรายวิชาก่อนจึงจะบันทึกคะแนนได้" />
      ) : null}
      <div className="space-y-4">
        {projects.length ? projects.map((project) => {
          const previous = project.attempts[0]?.evaluatorAssignments[0]?.scoreSubmission;
          const previousItems = new Map(previous?.scoreItems.map((item) => [item.rubricItem.itemKey, item.pointsAwarded]) ?? []);
          return (
            <section key={project.id} className="panel">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}
                  </p>
                </div>
                <span className="rounded-full border border-line px-3 py-1 text-xs">{previous ? `บันทึกแล้ว ${Number(previous.totalScore).toFixed(2)}/100` : "ยังไม่บันทึก"}</span>
              </div>
              <form action={submitFinalPresentationScore} className="mt-4 grid gap-4 md:grid-cols-4">
                <input type="hidden" name="project_id" value={project.id} />
                {finalCriteria.map((criterion) => (
                  <div key={criterion.key}>
                    <label>{criterion.label} ({criterion.max})</label>
                    <input
                      name={criterion.key === "researchResults" ? "research_results" : criterion.key === "executionProblemSolving" ? "execution_problem_solving" : criterion.key}
                      type="number"
                      min="0"
                      max={criterion.max}
                      step="1"
                      defaultValue={previousItems.get(criterion.key) ?? 0}
                      required
                    />
                  </div>
                ))}
                <div className="md:col-span-4">
                  <MarkdownLatexEditor name="comment" label="Comment / feedback" defaultValue={previous?.overallComment ?? ""} rows={4} required={false} />
                </div>
                <div className="md:col-span-4">
                  <SubmitButton pendingText="กำลังบันทึกคะแนน..." confirmMessage="ยืนยันการบันทึกคะแนน Final Presentation หรือไม่?">
                    บันทึกคะแนน Final Presentation
                  </SubmitButton>
                </div>
              </form>
            </section>
          );
        }) : finalRound ? (
          <EmptyState title="ยังไม่มีโครงงาน Final Presentation ที่ต้องให้คะแนน" description="รายการจะแสดงเมื่อท่านได้รับแต่งตั้งเป็น HEAD/MEMBER ของโครงงานที่อยู่ใน IN_PROGRESS" />
        ) : null}
      </div>
    </div>
  );
}
