import { auth } from "@/auth";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { EmptyState } from "@/components/ui/EmptyState";
import { MarkdownLatexEditor } from "@/components/ui/MarkdownLatexEditor";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConditionBasedRubricView } from "@/components/ui/ConditionBasedRubricView";
import { ProgressPlanCheckpointPanel } from "@/components/ui/ProgressPlanCheckpointPanel";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TeacherCompactQueueList, TeacherQueueBadge, TeacherWorkloadSummary } from "@/components/ui/TeacherWorkloadQueue";
import { prisma } from "@/lib/db";
import { isQaProgressPlanCheckEnabled } from "@/lib/qa/progressPlanCheckConfig";
import { findProgressQaCriterion, progressQaRubric, progressQaRubricItems } from "@/lib/rubrics/progressQaRubric";
import { submitProgress1Score } from "../actions";

function legacyFieldName(itemKey: string) {
  if (itemKey === "problemSolving") return "problem_solving";
  if (itemKey === "researchResults") return "research_results";
  return itemKey;
}

export default async function TeacherProgress1Page({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!hasApprovedTeacherCapability(session?.user) || !session?.user.id) {
    return <div className="panel">หน้านี้สำหรับอาจารย์เท่านั้น</div>;
  }

  const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
  if (!teacher) return <EmptyState title="ยังไม่พบโปรไฟล์อาจารย์" description="กรุณาส่งคำขอผูกบัญชีอาจารย์ก่อนใช้งาน" />;

  const params = (await searchParams) ?? {};
  const showQaProgressPlanCheck = isQaProgressPlanCheckEnabled();
  const progressRubricItemLabels = new Map(progressQaRubricItems().map((item) => [item.itemKey, item]));
  const [rubric, projects] = await Promise.all([
    prisma.rubric.findFirst({
      where: { roundType: "PROGRESS_1", active: true },
      include: { items: { orderBy: { displayOrder: "asc" } } }
    }),
    prisma.project.findMany({
      where: {
        status: "IN_PROGRESS",
        scheduleProposals: { some: { assessmentKind: "PROGRESS_1", status: "CONFIRMED" } },
        committeeAssignments: { some: { teacherId: teacher.id, active: true, role: { in: ["HEAD", "MEMBER"] } } },
        NOT: {
          attempts: {
            some: {
              assessmentRound: { roundType: "PROGRESS_1" },
              evaluatorAssignments: {
                some: {
                  teacherId: teacher.id,
                  scoreSubmission: { is: { status: "SUBMITTED" } }
                }
              }
            }
          }
        }
      },
      include: {
        student: true,
        presentationSubmissions: {
          orderBy: { submittedAt: "desc" },
          take: 1,
          select: { contentJson: true }
        },
        assessmentSubmissions: {
          where: { kind: "PROGRESS_1" },
          orderBy: { submittedAt: "desc" },
          take: 1
        },
        attempts: {
          where: { assessmentRound: { roundType: "PROGRESS_1" } },
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
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="บันทึกคะแนนการสอบความก้าวหน้าครั้งที่ 1" description="สำหรับประธานกรรมการหรือกรรมการที่ได้รับแต่งตั้งในโครงงานเท่านั้น" />
      <ActionFeedback success={params.success} error={params.error} />
      <TeacherWorkloadSummary
        metrics={[
          { label: "ต้องดำเนินการ", count: projects.length, tone: "action", description: "พร้อมให้คะแนน Progress 1" },
          { label: "รอ", count: 0, tone: "waiting", description: "รายการที่ยังไม่พร้อมไม่แสดงในหน้านี้" },
          { label: "เสร็จแล้ว", count: 0, tone: "completed", description: "คะแนนที่ส่งแล้วถูกนำออกจากคิวนี้" },
          { label: "ส่งกลับ", count: 0, tone: "returned", description: "ไม่ใช้กับการให้คะแนนรอบนี้" },
          { label: "ยังไม่เปิด", count: 0, tone: "locked", description: "รอบที่ยังไม่พร้อมไม่แสดง" }
        ]}
      />
      <TeacherCompactQueueList
        items={projects.map((project) => ({
          id: project.id,
          href: `#project-${project.id}`,
          title: project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ",
          description: `${project.student.studentCode} ${project.student.firstNameTh} ${project.student.lastNameTh}`,
          meta: "Progress 1",
          badges: [{ label: "ต้องให้คะแนน", tone: "action" }, { label: "กรรมการ", tone: "waiting" }]
        }))}
      />

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
            <section key={project.id} id={`project-${project.id}`} className="panel teacher-review-card scroll-mt-24">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}
                  </p>
                </div>
                <TeacherQueueBadge tone={previous ? "completed" : "action"}>
                  {previous ? `บันทึกแล้ว ${Number(previous.totalScore)}/100` : "ยังไม่บันทึก"}
                </TeacherQueueBadge>
              </div>

              {showQaProgressPlanCheck ? (
                <div className="mt-4">
                  <ProgressPlanCheckpointPanel roundType="PROGRESS_1" timelineItems={proposalContent?.timelineItems} audience="evaluator" />
                </div>
              ) : null}

              <div className="mt-4 rounded-md border border-line bg-surface p-3 text-sm">
                <div className="font-semibold">เอกสาร/หลักฐานที่นักศึกษาส่งสำหรับการสอบความก้าวหน้าครั้งที่ 1</div>
                {evidenceSubmission ? (
                  <div className="mt-2 space-y-2 text-muted">
                    <div>{evidenceSubmission.title ?? "เอกสารการสอบความก้าวหน้าครั้งที่ 1"}</div>
                    <a className="inline-flex text-brand hover:underline" href={evidenceSubmission.materialLink} target="_blank" rel="noreferrer">
                      เปิดเอกสาร/หลักฐาน
                    </a>
                    {evidenceSummary ? <MarkdownLatexViewer className="border-0 bg-transparent p-0" value={evidenceSummary} /> : null}
                  </div>
                ) : (
                  <div className="mt-2 text-muted">ยังไม่พบเอกสารการสอบความก้าวหน้าครั้งที่ 1 จากนักศึกษา</div>
                )}
              </div>

              <ConditionBasedRubricView
                title="เกณฑ์ประเมินการสอบความก้าวหน้าครั้งที่ 1"
                description="ใช้เกณฑ์นี้เป็นเกณฑ์คะแนนจริงของการสอบความก้าวหน้าครั้งที่ 1"
                sections={progressQaRubric}
              />

              <form action={submitProgress1Score} className="mt-4 space-y-4">
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
                  <EmptyState title="ยังไม่มีเกณฑ์ประเมินสำหรับการสอบความก้าวหน้าครั้งที่ 1" description="ผู้ดูแลระบบต้องตั้งค่าเกณฑ์ประเมินมาตรฐานก่อนจึงจะบันทึกคะแนนได้" />
                )}
                <MarkdownLatexEditor name="comment" label="ข้อเสนอแนะสำหรับนักศึกษา" defaultValue={previous?.overallComment ?? ""} rows={4} required={false} />
                <SubmitButton disabled={!rubric?.items.length} pendingText="กำลังบันทึกคะแนน..." confirmMessage="ยืนยันการบันทึกคะแนนการสอบความก้าวหน้าครั้งที่ 1 หรือไม่?">
                  บันทึกคะแนนการสอบความก้าวหน้าครั้งที่ 1
                </SubmitButton>
              </form>
            </section>
          );
        }) : (
          <EmptyState title="ยังไม่มีโครงงานการสอบความก้าวหน้าครั้งที่ 1 ที่ต้องให้คะแนน" description="รายการจะแสดงเมื่อท่านเป็นประธานกรรมการหรือกรรมการ และกรรมการยืนยันวันสอบความก้าวหน้าครั้งที่ 1 ครบแล้ว" />
        )}
      </div>
    </div>
  );
}
