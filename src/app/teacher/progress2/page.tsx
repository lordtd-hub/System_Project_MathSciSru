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
import { TeacherCompactQueueList, TeacherQueueBadge, TeacherWorkloadSummary } from "@/components/ui/TeacherWorkloadQueue";
import { FigmaMetricCard, FigmaPageHeader, FigmaPanel, FigmaReviewLayout, FigmaStatusBadge } from "@/components/redesign/VisualSurfaces";
import { prisma } from "@/lib/db";
import { isQaProgressPlanCheckEnabled } from "@/lib/qa/progressPlanCheckConfig";
import { findProgressQaCriterion, progressQaRubric, progressQaRubricItems } from "@/lib/rubrics/progressQaRubric";
import { getUiMode } from "@/lib/uiMode";
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
  if (!teacher) return <EmptyState title="ยังไม่พบโปรไฟล์อาจารย์" description="กรุณาส่งคำขอผูกบัญชีอาจารย์ก่อนใช้งาน" />;

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
          committeeAssignments: { some: { teacherId: teacher.id, active: true, role: { in: ["HEAD", "MEMBER"] } } },
          NOT: {
            attempts: {
              some: {
                assessmentRound: { roundType: "PROGRESS_2" },
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
  const uiMode = await getUiMode();

  const renderFigmaProject = (project: (typeof projects)[number]) => {
    const previous = project.attempts[0]?.evaluatorAssignments[0]?.scoreSubmission;
    const previousItems = new Map(previous?.scoreItems.map((item) => [item.rubricItem.itemKey, item.pointsAwarded]) ?? []);
    const proposalContent = project.presentationSubmissions[0]?.contentJson as Record<string, unknown> | undefined;
    const evidenceSubmission = project.assessmentSubmissions[0];
    const evidenceSummary = typeof evidenceSubmission?.contentJson === "object" && evidenceSubmission?.contentJson && "summary" in evidenceSubmission.contentJson
      ? String((evidenceSubmission.contentJson as { summary?: unknown }).summary ?? "")
      : "";

    return (
      <section key={`${project.id}-figma`} id={`project-${project.id}`} className="scroll-mt-24 rounded-lg border border-line bg-surface p-4 shadow-sm">
        <FigmaReviewLayout
          context={
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap gap-2">
                  <FigmaStatusBadge tone={previous ? "success" : "action"}>
                    {previous ? `บันทึกแล้ว ${Number(previous.totalScore)}/100` : "ยังไม่บันทึก"}
                  </FigmaStatusBadge>
                  <FigmaStatusBadge tone="muted">Progress 2</FigmaStatusBadge>
                  <FigmaStatusBadge tone="waiting">กรรมการ</FigmaStatusBadge>
                </div>
                <h2 className="mt-3 text-lg font-semibold text-ink">{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}
                </p>
              </div>

              {showQaProgressPlanCheck ? (
                <ProgressPlanCheckpointPanel roundType="PROGRESS_2" timelineItems={proposalContent?.timelineItems} audience="evaluator" />
              ) : null}

              <div className="rounded-lg border border-line bg-paperSoft p-3 text-sm">
                <div className="font-semibold text-ink">เอกสาร/หลักฐานที่นักศึกษาส่งสำหรับการสอบความก้าวหน้าครั้งที่ 2</div>
                {evidenceSubmission ? (
                  <div className="mt-2 space-y-2 text-muted">
                    <div>{evidenceSubmission.title ?? "เอกสารการสอบความก้าวหน้าครั้งที่ 2"}</div>
                    <a className="inline-flex text-brand hover:underline" href={evidenceSubmission.materialLink} target="_blank" rel="noreferrer">
                      เปิดเอกสาร/หลักฐาน
                    </a>
                    {evidenceSummary ? <MarkdownLatexViewer className="border-0 bg-transparent p-0" value={evidenceSummary} /> : null}
                  </div>
                ) : (
                  <div className="mt-2 text-muted">ยังไม่พบเอกสารการสอบความก้าวหน้าครั้งที่ 2 จากนักศึกษา</div>
                )}
              </div>

              <ConditionBasedRubricView
                title="เกณฑ์ประเมินการสอบความก้าวหน้าครั้งที่ 2"
                description="ใช้เกณฑ์นี้เป็นเกณฑ์คะแนนจริงของการสอบความก้าวหน้าครั้งที่ 2"
                sections={progressQaRubric}
              />
            </div>
          }
          action={
            <form action={submitProgress2Score} className="space-y-4 rounded-lg border border-line bg-paperSoft p-4">
              <input type="hidden" name="project_id" value={project.id} />
              <div>
                <h3 className="text-sm font-semibold text-ink">บันทึกคะแนน Progress 2</h3>
                <p className="mt-1 text-sm leading-6 text-muted">ใช้ฟอร์มและ server action เดิม เปลี่ยนเฉพาะการจัดวางให้แยกงานที่ต้องทำออกจากรายละเอียดหลักฐาน</p>
              </div>
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
                        <div key={item.id} className="rounded-md border border-line bg-surface p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-ink">{displayItem.itemLabelTh} ({item.points} คะแนน)</div>
                              {displayItem.evidenceHint ? <div className="mt-1 text-xs text-muted">{displayItem.evidenceHint}</div> : null}
                            </div>
                            <label className="min-w-44 text-sm font-medium text-ink">
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
                <EmptyState title="ยังไม่มีเกณฑ์ประเมินสำหรับการสอบความก้าวหน้าครั้งที่ 2" description="ผู้ดูแลระบบต้องตั้งค่าเกณฑ์ประเมินมาตรฐานก่อนจึงจะบันทึกคะแนนได้" />
              )}
              <MarkdownLatexEditor name="comment" label="ข้อเสนอแนะสำหรับนักศึกษา" defaultValue={previous?.overallComment ?? ""} rows={4} required={false} />
              <SubmitButton disabled={!rubric?.items.length} pendingText="กำลังบันทึกคะแนน..." confirmMessage="ยืนยันการบันทึกคะแนนการสอบความก้าวหน้าครั้งที่ 2 หรือไม่?">
                บันทึกคะแนนการสอบความก้าวหน้าครั้งที่ 2
              </SubmitButton>
            </form>
          }
        />
      </section>
    );
  };

  if (uiMode === "figma") {
    return (
      <div className="figma-dashboard-page figma-teacher-progress2">
        <FigmaPageHeader
          eyebrow="Progress 2"
          title="บันทึกคะแนนการสอบความก้าวหน้าครั้งที่ 2"
          description="แสดงเฉพาะงานที่พร้อมให้คะแนน และคงเงื่อนไขเปิดรอบ/สิทธิ์เดิมไว้ทั้งหมด"
        />
        <ActionFeedback success={params.success} error={params.error} />

        {!progress2Round ? (
          <FigmaPanel title="ยังไม่มีรอบสอบความก้าวหน้าครั้งที่ 2" tone="warning">
            <EmptyState title="ยังไม่มีรอบสอบความก้าวหน้าครั้งที่ 2" description="ผู้ดูแลระบบต้องเปิดรอบสอบความก้าวหน้าครั้งที่ 2 ระดับรายวิชาก่อนจึงจะบันทึกคะแนนได้" />
          </FigmaPanel>
        ) : (
          <>
            <div className="figma-kpi-grid">
              <FigmaMetricCard label="ต้องดำเนินการ" value={projects.length} description="พร้อมให้คะแนน Progress 2" tone="action" />
              <FigmaMetricCard label="รอ" value={0} description="รายการที่ยังไม่พร้อมไม่แสดงในหน้านี้" tone="warning" />
              <FigmaMetricCard label="เสร็จแล้ว" value={0} description="คะแนนที่ส่งแล้วถูกนำออกจากคิวนี้" tone="success" />
              <FigmaMetricCard label="ส่งกลับ" value={0} description="ไม่ใช้กับการให้คะแนนรอบนี้" tone="muted" />
              <FigmaMetricCard label="ยังไม่เปิด" value={0} description="รอบที่ยังไม่พร้อมไม่แสดง" tone="muted" />
            </div>

            <FigmaPanel
              title="คิว Progress 2 ที่ต้องให้คะแนน"
              description="รายการนี้แสดงเฉพาะโครงการที่ยืนยันวันสอบแล้วและยังต้องให้คะแนนโดยอาจารย์คนนี้"
              tone={projects.length ? "action" : "muted"}
            >
              {projects.length ? (
                <div className="figma-action-list">
                  {projects.map((project) => (
                    <a key={`${project.id}-figma-queue`} className="figma-action-row figma-progress-row" data-tone="action" href={`#project-${project.id}`}>
                      <div>
                        <strong>{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</strong>
                        <p>
                          {project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}
                        </p>
                        <small>Progress 2</small>
                      </div>
                      <FigmaStatusBadge tone="action">ต้องให้คะแนน</FigmaStatusBadge>
                    </a>
                  ))}
                </div>
              ) : (
                <EmptyState title="ยังไม่มีโครงการการสอบความก้าวหน้าครั้งที่ 2 ที่ต้องให้คะแนน" description="รายการจะแสดงเมื่อท่านเป็นประธานกรรมการหรือกรรมการ และกรรมการยืนยันวันสอบความก้าวหน้าครั้งที่ 2 ครบแล้ว" />
              )}
            </FigmaPanel>

            <FigmaPanel
              title="รายละเอียดและฟอร์มประเมิน"
              description="รายละเอียดหลักฐานอยู่ซ้าย ฟอร์มบันทึกคะแนนอยู่ขวา เพื่อให้สแกนงานหลายโครงการได้ง่ายขึ้น"
              tone={projects.length ? "action" : "muted"}
            >
              <div className="space-y-4">
                {projects.length ? projects.map(renderFigmaProject) : (
                  <EmptyState title="ยังไม่มีรายการให้ประเมินในรอบนี้" description="คิวจะว่างเมื่อไม่มีโครงการที่พร้อมให้คะแนน Progress 2 สำหรับอาจารย์คนนี้" />
                )}
              </div>
            </FigmaPanel>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="บันทึกคะแนนการสอบความก้าวหน้าครั้งที่ 2" description="สำหรับประธานกรรมการหรือกรรมการที่ได้รับแต่งตั้งในโครงงานเท่านั้น" />
      <ActionFeedback success={params.success} error={params.error} />
      <GuidancePanel
        title="การประเมินความก้าวหน้าครั้งที่ 2"
        current="ให้คะแนนจากเกณฑ์แบบตรวจเงื่อนไข 100 คะแนน โดยเทียบกับหลักฐานและแผนงานที่นักศึกษาส่งไว้"
        next="ระบบบันทึกคะแนนและข้อเสนอแนะเป็นหลักฐาน โดยไม่เปลี่ยนขั้นตอนโครงงานอัตโนมัติ"
        actor="ประธานกรรมการหรือกรรมการที่ได้รับแต่งตั้ง"
      />
      {!progress2Round ? (
        <EmptyState title="ยังไม่มีรอบสอบความก้าวหน้าครั้งที่ 2" description="ผู้ดูแลระบบต้องเปิดรอบสอบความก้าวหน้าครั้งที่ 2 ระดับรายวิชาก่อนจึงจะบันทึกคะแนนได้" />
      ) : null}
      {progress2Round ? (
        <>
          <TeacherWorkloadSummary
            metrics={[
              { label: "ต้องดำเนินการ", count: projects.length, tone: "action", description: "พร้อมให้คะแนน Progress 2" },
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
              meta: "Progress 2",
              badges: [{ label: "ต้องให้คะแนน", tone: "action" }, { label: "กรรมการ", tone: "waiting" }]
            }))}
          />
        </>
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
                  <ProgressPlanCheckpointPanel roundType="PROGRESS_2" timelineItems={proposalContent?.timelineItems} audience="evaluator" />
                </div>
              ) : null}

              <div className="mt-4 rounded-md border border-line bg-surface p-3 text-sm">
                <div className="font-semibold">เอกสาร/หลักฐานที่นักศึกษาส่งสำหรับการสอบความก้าวหน้าครั้งที่ 2</div>
                {evidenceSubmission ? (
                  <div className="mt-2 space-y-2 text-muted">
                    <div>{evidenceSubmission.title ?? "เอกสารการสอบความก้าวหน้าครั้งที่ 2"}</div>
                    <a className="inline-flex text-brand hover:underline" href={evidenceSubmission.materialLink} target="_blank" rel="noreferrer">
                      เปิดเอกสาร/หลักฐาน
                    </a>
                    {evidenceSummary ? <MarkdownLatexViewer className="border-0 bg-transparent p-0" value={evidenceSummary} /> : null}
                  </div>
                ) : (
                  <div className="mt-2 text-muted">ยังไม่พบเอกสารการสอบความก้าวหน้าครั้งที่ 2 จากนักศึกษา</div>
                )}
              </div>

              <ConditionBasedRubricView
                title="เกณฑ์ประเมินการสอบความก้าวหน้าครั้งที่ 2"
                description="ใช้เกณฑ์นี้เป็นเกณฑ์คะแนนจริงของการสอบความก้าวหน้าครั้งที่ 2"
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
                  <EmptyState title="ยังไม่มีเกณฑ์ประเมินสำหรับการสอบความก้าวหน้าครั้งที่ 2" description="ผู้ดูแลระบบต้องตั้งค่าเกณฑ์ประเมินมาตรฐานก่อนจึงจะบันทึกคะแนนได้" />
                )}
                <MarkdownLatexEditor name="comment" label="ข้อเสนอแนะสำหรับนักศึกษา" defaultValue={previous?.overallComment ?? ""} rows={4} required={false} />
                <SubmitButton disabled={!rubric?.items.length} pendingText="กำลังบันทึกคะแนน..." confirmMessage="ยืนยันการบันทึกคะแนนการสอบความก้าวหน้าครั้งที่ 2 หรือไม่?">
                  บันทึกคะแนนการสอบความก้าวหน้าครั้งที่ 2
                </SubmitButton>
              </form>
            </section>
          );
        }) : progress2Round ? (
          <EmptyState title="ยังไม่มีโครงงานการสอบความก้าวหน้าครั้งที่ 2 ที่ต้องให้คะแนน" description="รายการจะแสดงเมื่อท่านเป็นประธานกรรมการหรือกรรมการ และกรรมการยืนยันวันสอบความก้าวหน้าครั้งที่ 2 ครบแล้ว" />
        ) : null}
      </div>
    </div>
  );
}
