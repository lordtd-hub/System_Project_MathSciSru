import { auth } from "@/auth";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { MarkdownLatexEditor } from "@/components/ui/MarkdownLatexEditor";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConditionBasedRubricView } from "@/components/ui/ConditionBasedRubricView";
import { ProgressPlanCheckpointPanel } from "@/components/ui/ProgressPlanCheckpointPanel";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/db";
import { isQaProgressPlanCheckEnabled } from "@/lib/qa/progressPlanCheckConfig";
import { findProgressQaCriterion, progressQaRubric, progressQaRubricItems } from "@/lib/rubrics/progressQaRubric";
import { submitProgress2Score } from "../actions";

function legacyFieldName(itemKey: string) {
  if (itemKey === "problemSolving") return "problem_solving";
  if (itemKey === "researchResults") return "research_results";
  return itemKey;
}

export default async function TeacherProgress2Page({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!hasApprovedTeacherCapability(session?.user) || !session?.user.id) {
    return <div className="panel">หน้านี้สำหรับอาจารย์เท่านั้น</div>;
  }

  const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
  if (!teacher) return <EmptyState title="ยังไม่พบโปรไฟล์อาจารย์" description="กรุณา claim โปรไฟล์ก่อนใช้งาน" />;

  const params = (await searchParams) ?? {};
  const showQaProgressPlanCheck = isQaProgressPlanCheckEnabled();
  const progressRubricItemLabels = new Map(progressQaRubricItems().map((item) => [item.itemKey, item]));
  const [progress2Round, rubric] = await Promise.all([
    prisma.assessmentRound.findFirst({
      where: { roundType: "PROGRESS_2" },
      orderBy: { createdAt: "desc" }
    }),
    prisma.rubric.findFirst({
      where: { roundType: "PROGRESS_2", active: true },
      include: { items: { orderBy: { displayOrder: "asc" } } }
    })
  ]);

  const projects = progress2Round
    ? await prisma.project.findMany({
        where: {
          status: "IN_PROGRESS",
          courseOfferingId: progress2Round.courseOfferingId,
          scheduleProposals: { some: { assessmentKind: "PROGRESS_2", status: "CONFIRMED" } },
          committeeAssignments: { some: { teacherId: teacher.id, active: true, role: { in: ["HEAD", "MEMBER"] } } }
        },
        include: {
          student: true,
          presentationSubmissions: {
            orderBy: { submittedAt: "desc" },
            take: 1,
            select: { contentJson: true }
          },
          assessmentSubmissions: {
            where: { kind: "PROGRESS_2" },
            orderBy: { submittedAt: "desc" },
            take: 1
          },
          attempts: {
            where: { assessmentRound: { roundType: "PROGRESS_2" } },
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
      <PageHeader title="บันทึกคะแนน Progress 2" description="สำหรับ HEAD/MEMBER ที่ได้รับแต่งตั้งในโครงงานเท่านั้น" />
      <ActionFeedback success={params.success} error={params.error} />
      <GuidancePanel
        title="Progress 2 scoring"
        current="ให้คะแนนจาก rubric แบบเงื่อนไข 100 คะแนน โดยเทียบกับหลักฐานและแผนงานที่นักศึกษาส่งไว้"
        next="ระบบบันทึกคะแนนและ comment เป็นหลักฐาน แต่ยังไม่เปลี่ยน lifecycle อัตโนมัติ"
        actor="HEAD หรือ MEMBER ที่ได้รับแต่งตั้ง"
      />
      {!progress2Round ? (
        <EmptyState title="ยังไม่มีรอบ Progress 2" description="ผู้ดูแลระบบต้องเปิดรอบ Progress 2 ระดับรายวิชาก่อนจึงจะบันทึกคะแนนได้" />
      ) : null}

      <div className="space-y-4">
        {projects.length ? projects.map((project) => {
          const previous = project.attempts[0]?.evaluatorAssignments[0]?.scoreSubmission;
          const previousItems = new Map(previous?.scoreItems.map((item) => [item.rubricItem.itemKey, item.pointsAwarded]) ?? []);
          const proposalContent = project.presentationSubmissions[0]?.contentJson as Record<string, unknown> | undefined;
          const evidenceSubmission = project.assessmentSubmissions[0];
          const evidenceSummary = typeof evidenceSubmission?.contentJson === "object" && evidenceSubmission?.contentJson && "summary" in evidenceSubmission.contentJson
            ? String((evidenceSubmission.contentJson as { summary?: unknown }).summary ?? "")
            : "";

          return (
            <section key={project.id} className="panel">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}
                  </p>
                </div>
                <span className="rounded-full border border-line px-3 py-1 text-xs">
                  {previous ? `บันทึกแล้ว ${Number(previous.totalScore)}/100` : "ยังไม่บันทึก"}
                </span>
              </div>

              {showQaProgressPlanCheck ? (
                <div className="mt-4">
                  <ProgressPlanCheckpointPanel roundType="PROGRESS_2" timelineItems={proposalContent?.timelineItems} audience="evaluator" />
                </div>
              ) : null}

              <div className="mt-4 rounded-md border border-line bg-surface p-3 text-sm">
                <div className="font-semibold">เอกสาร/หลักฐานที่นักศึกษาส่งสำหรับ Progress 2</div>
                {evidenceSubmission ? (
                  <div className="mt-2 space-y-2 text-muted">
                    <div>{evidenceSubmission.title ?? "เอกสาร Progress 2"}</div>
                    <a className="inline-flex text-brand hover:underline" href={evidenceSubmission.materialLink} target="_blank" rel="noreferrer">
                      เปิดเอกสาร/หลักฐาน
                    </a>
                    {evidenceSummary ? <MarkdownLatexViewer className="border-0 bg-transparent p-0" value={evidenceSummary} /> : null}
                  </div>
                ) : (
                  <div className="mt-2 text-muted">ยังไม่พบเอกสาร Progress 2 จากนักศึกษา</div>
                )}
              </div>

              <ConditionBasedRubricView
                title="Progress 2 condition-based rubric"
                description="ใช้ rubric นี้เป็นเกณฑ์คะแนนจริงของ Progress 2"
                sections={progressQaRubric}
              />

              <form action={submitProgress2Score} className="mt-4 space-y-4">
                <input type="hidden" name="project_id" value={project.id} />
                {rubric?.items.length ? (
                  <div className="space-y-3">
                    {rubric.items.map((item) => {
                      const progressCriterion = findProgressQaCriterion(item.itemKey);
                      const displayItem = progressRubricItemLabels.get(item.itemKey) ?? item;
                      const previousPoints = previousItems.get(item.itemKey) ?? 0;
                      const previousConditionCount = progressCriterion?.scoreMappings.find((mapping) => mapping.score === previousPoints)?.conditionCount ?? 0;

                      if (progressCriterion) {
                        const conditionMax = progressCriterion.conditions.length;
                        return (
                          <div key={item.id} className="rounded-md border border-line p-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium">{displayItem.itemLabelTh} ({item.points} คะแนน)</div>
                                {displayItem.evidenceHint ? <div className="mt-1 text-xs text-muted">{displayItem.evidenceHint}</div> : null}
                              </div>
                              <label className="min-w-44 text-sm font-medium">
                                เงื่อนไขที่ผ่าน
                                <select name={`condition_count:${item.id}`} defaultValue={previousConditionCount} className="mt-1">
                                  {Array.from({ length: conditionMax + 1 }, (_, count) => (
                                    <option key={count} value={count}>{count}/{conditionMax} เงื่อนไข</option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={item.id}>
                          <label>{displayItem.itemLabelTh} ({item.points})</label>
                          <input name={legacyFieldName(item.itemKey)} type="number" min="0" max={item.points} step="1" defaultValue={previousPoints} required />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState title="ยังไม่มี Rubric สำหรับ Progress 2" description="ผู้ดูแลระบบต้องตั้งค่า rubric baseline ก่อนจึงจะบันทึกคะแนนได้" />
                )}
                <MarkdownLatexEditor name="comment" label="Comment / feedback" defaultValue={previous?.overallComment ?? ""} rows={4} required={false} />
                <SubmitButton disabled={!rubric?.items.length} pendingText="กำลังบันทึกคะแนน..." confirmMessage="ยืนยันการบันทึกคะแนน Progress 2 หรือไม่?">
                  บันทึกคะแนน Progress 2
                </SubmitButton>
              </form>
            </section>
          );
        }) : progress2Round ? (
          <EmptyState title="ยังไม่มีโครงงาน Progress 2 ที่ต้องให้คะแนน" description="รายการจะแสดงเมื่อท่านเป็น HEAD/MEMBER และกรรมการยืนยันวันสอบ Progress 2 ครบแล้ว" />
        ) : null}
      </div>
    </div>
  );
}
