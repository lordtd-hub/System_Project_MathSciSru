import { auth } from "@/auth";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { EmptyState } from "@/components/ui/EmptyState";
import { FinalEvidenceContinuityPanel } from "@/components/ui/FinalEvidenceContinuityPanel";
import { FinalQaRubricPanel } from "@/components/ui/FinalQaRubricPanel";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { MarkdownLatexEditor } from "@/components/ui/MarkdownLatexEditor";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TeacherCompactQueueList, TeacherQueueBadge, TeacherWorkloadSummary } from "@/components/ui/TeacherWorkloadQueue";
import { FigmaMetricCard, FigmaPageHeader, FigmaPanel, FigmaReviewLayout, FigmaStatusBadge } from "@/components/redesign/VisualSurfaces";
import { prisma } from "@/lib/db";
import { isQaAunEvidenceAlignmentEnabled } from "@/lib/qa/finalRubricConfig";
import { finalQaRubric, findFinalQaCriterion } from "@/lib/rubrics/finalQaRubric";
import { getUiMode } from "@/lib/uiMode";
import { submitFinalPresentationScore } from "../actions";

function conditionCountForSavedScore(criterion: NonNullable<ReturnType<typeof findFinalQaCriterion>>, score: number | undefined) {
  if (score === undefined) return 0;
  return [...criterion.scoreMappings].sort((a, b) => b.conditionCount - a.conditionCount).find((mapping) => mapping.score === score)?.conditionCount ?? 0;
}

export default async function TeacherFinalPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!hasApprovedTeacherCapability(session?.user) || !session?.user.id) return <div className="panel">หน้านี้สำหรับอาจารย์เท่านั้น</div>;
  const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
  if (!teacher) return <EmptyState title="ยังไม่พบโปรไฟล์อาจารย์" description="กรุณาส่งคำขอผูกบัญชีกับโปรไฟล์อาจารย์ก่อนใช้งาน" />;
  const params = (await searchParams) ?? {};
  const showQaEvidenceAlignment = isQaAunEvidenceAlignmentEnabled();

  const finalRound = await prisma.assessmentRound.findFirst({
    where: { roundType: "FINAL_PRESENTATION" },
    orderBy: { createdAt: "desc" }
  });

  const projects = finalRound
    ? await prisma.project.findMany({
        where: {
          status: "IN_PROGRESS",
          courseOfferingId: finalRound.courseOfferingId,
          scheduleProposals: { some: { assessmentKind: "FINAL_PRESENT", status: "CONFIRMED" } },
          committeeAssignments: { some: { teacherId: teacher.id, active: true, role: { in: ["HEAD", "MEMBER"] } } },
          NOT: {
            attempts: {
              some: {
                assessmentRound: { roundType: "FINAL_PRESENTATION" },
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
          assessmentSubmissions: { orderBy: { submittedAt: "desc" } },
          reportVersions: { orderBy: { versionNo: "desc" }, take: 1 },
          presentationSubmissions: {
            orderBy: { submittedAt: "desc" },
            take: 1,
            select: { contentJson: true, materialLink: true, submittedAt: true }
          },
          attempts: {
            where: { assessmentRound: { roundType: { in: ["PROGRESS_1", "PROGRESS_2", "FINAL_PRESENTATION"] } } },
            include: {
              assessmentRound: true,
              evaluatorAssignments: {
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
    const proposalContent = project.presentationSubmissions[0]?.contentJson as Record<string, unknown> | undefined;
    const finalAttempt = project.attempts.find((attempt) => attempt.assessmentRound.roundType === "FINAL_PRESENTATION");
    const previous = finalAttempt?.evaluatorAssignments.find((assignment) => assignment.evaluatorUserId === session.user.id)?.scoreSubmission;
    const previousItems = new Map(previous?.scoreItems.map((item) => [item.rubricItem.itemKey, item.pointsAwarded]) ?? []);
    const progressHistory = (["PROGRESS_1", "PROGRESS_2"] as const).map((roundType) => {
      const attempt = project.attempts.find((item) => item.assessmentRound.roundType === roundType);
      const submission = attempt?.evaluatorAssignments.find((assignment) => assignment.scoreSubmission)?.scoreSubmission;
      return {
        label: roundType === "PROGRESS_1" ? "ความก้าวหน้าครั้งที่ 1" : "ความก้าวหน้าครั้งที่ 2",
        score: submission?.totalScore ? Number(submission.totalScore).toFixed(2) : null,
        submittedAt: submission?.submittedAt ?? null
      };
    });
    const finalArtifacts = [
      {
        label: "วันสอบและหลักฐานการสอบขั้นสุดท้าย",
        value: project.assessmentSubmissions.find((submission) => submission.kind === "FINAL_PRESENT")?.materialLink ?? null
      },
      {
        label: "หลักฐานเอกสารเสนอหัวข้อ",
        value: project.presentationSubmissions[0]?.materialLink ?? null
      }
    ];

    return (
      <section key={`${project.id}-figma`} id={`project-${project.id}`} className="scroll-mt-24 rounded-lg border border-line bg-surface p-4 shadow-sm">
        <FigmaReviewLayout
          context={
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap gap-2">
                  <FigmaStatusBadge tone={previous ? "success" : "action"}>
                    {previous ? `บันทึกแล้ว ${Number(previous.totalScore).toFixed(2)}/100` : "ยังไม่บันทึก"}
                  </FigmaStatusBadge>
                  <FigmaStatusBadge tone="muted">Final</FigmaStatusBadge>
                  <FigmaStatusBadge tone="waiting">กรรมการ</FigmaStatusBadge>
                </div>
                <h2 className="mt-3 text-lg font-semibold text-ink">{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}
                </p>
              </div>

              {showQaEvidenceAlignment ? (
                <FinalEvidenceContinuityPanel
                  proposalObjectives={typeof proposalContent?.objectives === "string" ? proposalContent.objectives : null}
                  proposalTimelineItems={proposalContent?.timelineItems}
                  progressHistory={progressHistory}
                  finalArtifacts={finalArtifacts}
                  reportEvidenceRecorded={project.reportVersions.length > 0}
                />
              ) : null}

              <FinalQaRubricPanel audience="evaluator" />
            </div>
          }
          action={
            <form action={submitFinalPresentationScore} className="space-y-4 rounded-lg border border-line bg-paperSoft p-4">
              <input type="hidden" name="project_id" value={project.id} />
              <div>
                <h3 className="text-sm font-semibold text-ink">บันทึกคะแนน Final</h3>
                <p className="mt-1 text-sm leading-6 text-muted">ใช้ฟอร์มและ server action เดิม เปลี่ยนเฉพาะการจัดวางให้เห็นหลักฐานและฟอร์มประเมินเป็นสองส่วน</p>
              </div>
              {finalQaRubric.flatMap((section) =>
                section.criteria.map((criterion) => (
                  <div key={criterion.code} className="rounded-md border border-line bg-surface p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-ink">{criterion.code}. {criterion.title} ({criterion.maxScore} คะแนน)</div>
                        <ul className="mt-2 space-y-1 text-xs text-muted">
                          {criterion.conditions.map((condition) => (
                            <li key={condition}>- {condition}</li>
                          ))}
                        </ul>
                      </div>
                      <label className="min-w-44 text-sm font-medium text-ink">
                        เงื่อนไขที่ผ่าน
                        <select name={`condition_count:${criterion.code}`} defaultValue={conditionCountForSavedScore(criterion, previousItems.get(criterion.code))} required className="mt-1">
                          {Array.from({ length: criterion.conditions.length + 1 }, (_, count) => (
                            <option key={count} value={count}>
                              {count} เงื่อนไข = {criterion.scoreMappings.find((mapping) => mapping.conditionCount === count)?.score ?? 0} คะแนน
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                ))
              )}
              <MarkdownLatexEditor name="comment" label="ข้อเสนอแนะสำหรับนักศึกษา" defaultValue={previous?.overallComment ?? ""} rows={4} required={false} />
              <SubmitButton pendingText="กำลังบันทึกคะแนน..." confirmMessage="ยืนยันการบันทึกคะแนนการสอบนำเสนอขั้นสุดท้ายหรือไม่?">
                บันทึกคะแนนการสอบนำเสนอขั้นสุดท้าย
              </SubmitButton>
            </form>
          }
        />
      </section>
    );
  };

  if (uiMode === "figma") {
    return (
      <div className="figma-dashboard-page figma-teacher-final">
        <FigmaPageHeader
          eyebrow="Final"
          title="บันทึกคะแนนการสอบนำเสนอขั้นสุดท้าย"
          description="รวมหลักฐานความต่อเนื่องและฟอร์มคะแนน Final โดยคง workflow และสิทธิ์เดิมทั้งหมด"
        />
        <ActionFeedback success={params.success} error={params.error} />

        {!finalRound ? (
          <FigmaPanel title="ยังไม่มีรอบสอบนำเสนอขั้นสุดท้าย" tone="warning">
            <EmptyState title="ยังไม่มีรอบสอบนำเสนอขั้นสุดท้าย" description="ผู้ดูแลระบบต้องเปิดรอบสอบนำเสนอขั้นสุดท้ายระดับรายวิชาก่อนจึงจะบันทึกคะแนนได้" />
          </FigmaPanel>
        ) : (
          <>
            <div className="figma-kpi-grid">
              <FigmaMetricCard label="ต้องดำเนินการ" value={projects.length} description="พร้อมให้คะแนน Final" tone="action" />
              <FigmaMetricCard label="รอ" value={0} description="รายการที่ยังไม่พร้อมไม่แสดงในหน้านี้" tone="warning" />
              <FigmaMetricCard label="เสร็จแล้ว" value={0} description="คะแนนที่ส่งแล้วถูกนำออกจากคิวนี้" tone="success" />
              <FigmaMetricCard label="ส่งกลับ" value={0} description="ไม่ใช้กับการให้คะแนนรอบนี้" tone="muted" />
              <FigmaMetricCard label="ยังไม่เปิด" value={0} description="รอบที่ยังไม่พร้อมไม่แสดง" tone="muted" />
            </div>

            <FigmaPanel
              title="คิว Final ที่ต้องให้คะแนน"
              description="รายการนี้แสดงเฉพาะโครงการที่ยืนยันวันสอบ Final แล้วและยังต้องให้คะแนนโดยอาจารย์คนนี้"
              tone={projects.length ? "action" : "muted"}
            >
              {projects.length ? (
                <div className="figma-action-list">
                  {projects.map((project) => (
                    <a key={`${project.id}-figma-queue`} className="figma-action-row figma-final-row" data-tone="action" href={`#project-${project.id}`}>
                      <div>
                        <strong>{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</strong>
                        <p>
                          {project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}
                        </p>
                        <small>Final</small>
                      </div>
                      <FigmaStatusBadge tone="action">ต้องให้คะแนน</FigmaStatusBadge>
                    </a>
                  ))}
                </div>
              ) : (
                <EmptyState title="ยังไม่มีโครงการสอบนำเสนอขั้นสุดท้ายที่ต้องให้คะแนน" description="รายการจะแสดงเมื่อท่านเป็นประธานกรรมการหรือกรรมการ และกรรมการยืนยันวันสอบนำเสนอขั้นสุดท้ายครบแล้ว" />
              )}
            </FigmaPanel>

            <FigmaPanel
              title="รายละเอียดหลักฐานและฟอร์มประเมิน"
              description="หลักฐานความต่อเนื่องอยู่ซ้าย ฟอร์มบันทึกคะแนนอยู่ขวา เพื่อให้อ่านงาน Final ได้เป็นระบบ"
              tone={projects.length ? "action" : "muted"}
            >
              <div className="space-y-4">
                {projects.length ? projects.map(renderFigmaProject) : (
                  <EmptyState title="ยังไม่มีรายการให้ประเมินในรอบนี้" description="คิวจะว่างเมื่อไม่มีโครงการที่พร้อมให้คะแนน Final สำหรับอาจารย์คนนี้" />
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
      <PageHeader title="บันทึกคะแนนการสอบนำเสนอขั้นสุดท้าย" description="สำหรับประธานหรือกรรมการที่ได้รับแต่งตั้งในโครงงานเท่านั้น" />
      <ActionFeedback success={params.success} error={params.error} />
      <GuidancePanel
        title="การประเมินการสอบนำเสนอขั้นสุดท้าย"
        current="ประเมินการสอบขั้นสุดท้ายด้วยเกณฑ์แบบตรวจเงื่อนไข รวม 100 คะแนน โดยตรวจหลักฐานที่เชื่อมกับเอกสารเสนอหัวข้อ การสอบความก้าวหน้า รายงาน และการตอบคำถาม"
        next="ระบบบันทึกคะแนนไว้ก่อน และจะเข้าสู่ขั้นตอนส่งรายงานฉบับสมบูรณ์เมื่อผลการประเมินของกรรมการครบตามเงื่อนไข"
        actor="ประธานหรือกรรมการที่ได้รับแต่งตั้ง"
      />
      {!finalRound ? (
        <EmptyState title="ยังไม่มีรอบสอบนำเสนอขั้นสุดท้าย" description="ผู้ดูแลระบบต้องเปิดรอบสอบนำเสนอขั้นสุดท้ายระดับรายวิชาก่อนจึงจะบันทึกคะแนนได้" />
      ) : null}
      {finalRound ? (
        <>
          <TeacherWorkloadSummary
            metrics={[
              { label: "ต้องดำเนินการ", count: projects.length, tone: "action", description: "พร้อมให้คะแนน Final" },
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
              meta: "Final",
              badges: [{ label: "ต้องให้คะแนน", tone: "action" }, { label: "กรรมการ", tone: "waiting" }]
            }))}
          />
        </>
      ) : null}
      <div className="space-y-4">
        {projects.length ? projects.map((project) => {
          const proposalContent = project.presentationSubmissions[0]?.contentJson as Record<string, unknown> | undefined;
          const finalAttempt = project.attempts.find((attempt) => attempt.assessmentRound.roundType === "FINAL_PRESENTATION");
          const previous = finalAttempt?.evaluatorAssignments.find((assignment) => assignment.evaluatorUserId === session.user.id)?.scoreSubmission;
          const previousItems = new Map(previous?.scoreItems.map((item) => [item.rubricItem.itemKey, item.pointsAwarded]) ?? []);
          const progressHistory = (["PROGRESS_1", "PROGRESS_2"] as const).map((roundType) => {
            const attempt = project.attempts.find((item) => item.assessmentRound.roundType === roundType);
            const submission = attempt?.evaluatorAssignments.find((assignment) => assignment.scoreSubmission)?.scoreSubmission;
            return {
              label: roundType === "PROGRESS_1" ? "ความก้าวหน้าครั้งที่ 1" : "ความก้าวหน้าครั้งที่ 2",
              score: submission?.totalScore ? Number(submission.totalScore).toFixed(2) : null,
              submittedAt: submission?.submittedAt ?? null
            };
          });
          const finalArtifacts = [
            {
              label: "วันสอบและหลักฐานการสอบขั้นสุดท้าย",
              value: project.assessmentSubmissions.find((submission) => submission.kind === "FINAL_PRESENT")?.materialLink ?? null
            },
            {
              label: "หลักฐานเอกสารเสนอหัวข้อ",
              value: project.presentationSubmissions[0]?.materialLink ?? null
            }
          ];
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
                  {previous ? `บันทึกแล้ว ${Number(previous.totalScore).toFixed(2)}/100` : "ยังไม่บันทึก"}
                </TeacherQueueBadge>
              </div>
              {showQaEvidenceAlignment ? (
                <div className="mt-4">
                  <FinalEvidenceContinuityPanel
                    proposalObjectives={typeof proposalContent?.objectives === "string" ? proposalContent.objectives : null}
                    proposalTimelineItems={proposalContent?.timelineItems}
                    progressHistory={progressHistory}
                    finalArtifacts={finalArtifacts}
                    reportEvidenceRecorded={project.reportVersions.length > 0}
                  />
                </div>
              ) : null}
              <div className="mt-4">
                <FinalQaRubricPanel audience="evaluator" />
              </div>
              <form action={submitFinalPresentationScore} className="mt-4 space-y-4">
                <input type="hidden" name="project_id" value={project.id} />
                {finalQaRubric.flatMap((section) =>
                  section.criteria.map((criterion) => (
                    <div key={criterion.code} className="rounded-md border border-line bg-surface p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{criterion.code}. {criterion.title} ({criterion.maxScore} คะแนน)</div>
                          <ul className="mt-2 space-y-1 text-xs text-muted">
                            {criterion.conditions.map((condition) => (
                              <li key={condition}>- {condition}</li>
                            ))}
                          </ul>
                        </div>
                        <label className="min-w-44 text-sm font-medium">
                          เงื่อนไขที่ผ่าน
                          <select name={`condition_count:${criterion.code}`} defaultValue={conditionCountForSavedScore(criterion, previousItems.get(criterion.code))} required className="mt-1">
                            {Array.from({ length: criterion.conditions.length + 1 }, (_, count) => (
                              <option key={count} value={count}>
                                {count} เงื่อนไข = {criterion.scoreMappings.find((mapping) => mapping.conditionCount === count)?.score ?? 0} คะแนน
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  ))
                )}
                <div>
                  <MarkdownLatexEditor name="comment" label="ข้อเสนอแนะสำหรับนักศึกษา" defaultValue={previous?.overallComment ?? ""} rows={4} required={false} />
                </div>
                <div>
                  <SubmitButton pendingText="กำลังบันทึกคะแนน..." confirmMessage="ยืนยันการบันทึกคะแนนการสอบนำเสนอขั้นสุดท้ายหรือไม่?">
                    บันทึกคะแนนการสอบนำเสนอขั้นสุดท้าย
                  </SubmitButton>
                </div>
              </form>
            </section>
          );
        }) : finalRound ? (
          <EmptyState title="ยังไม่มีโครงงานสอบนำเสนอขั้นสุดท้ายที่ต้องให้คะแนน" description="รายการจะแสดงเมื่อท่านเป็นประธานหรือกรรมการ และกรรมการยืนยันวันสอบนำเสนอขั้นสุดท้ายครบแล้ว" />
        ) : null}
      </div>
    </div>
  );
}
