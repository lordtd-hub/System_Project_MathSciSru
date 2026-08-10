import { auth } from "@/auth";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { EmptyState } from "@/components/ui/EmptyState";
import { FinalEvidenceContinuityPanel } from "@/components/ui/FinalEvidenceContinuityPanel";
import { FinalQaRubricPanel } from "@/components/ui/FinalQaRubricPanel";
import { MarkdownLatexEditor } from "@/components/ui/MarkdownLatexEditor";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TeacherCompactQueueList, TeacherQueueBadge, TeacherWorkloadSummary } from "@/components/ui/TeacherWorkloadQueue";
import { isRoundOpen } from "@/lib/assessments/courseRounds";
import { LATE_ROUND_EXCEPTION_TYPE, LATE_ROUND_EXCUSED_EXCEPTION_TYPE } from "@/lib/assessments/roundExceptions";
import { prisma } from "@/lib/db";
import { isQaAunEvidenceAlignmentEnabled } from "@/lib/qa/finalRubricConfig";
import { calculateFinalQaCriterionScore, finalQaRubric, findFinalQaCriterion } from "@/lib/rubrics/finalQaRubric";
import { submitFinalPresentationScore } from "../actions";

function conditionCountForSavedScore(criterion: NonNullable<ReturnType<typeof findFinalQaCriterion>>, score: number | undefined) {
  if (score === undefined) return "";
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
          status: { in: ["IN_PROGRESS", "FINAL_DONE"] },
          courseOfferingId: finalRound.courseOfferingId,
          scheduleProposals: { some: { assessmentKind: "FINAL_PRESENT", status: "CONFIRMED" } },
          committeeAssignments: { some: { teacherId: teacher.id, active: true, role: { in: ["HEAD", "MEMBER"] } } },
          ...(isRoundOpen(finalRound.status) ? {} : {
            roundExceptions: {
              some: {
                assessmentRoundId: finalRound.id,
                status: "OPEN",
                exceptionType: { in: [LATE_ROUND_EXCEPTION_TYPE, LATE_ROUND_EXCUSED_EXCEPTION_TYPE] }
              }
            }
          })
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
  const submittedCount = projects.filter((project) => {
    const finalAttempt = project.attempts.find((attempt) => attempt.assessmentRound.roundType === "FINAL_PRESENTATION");
    return finalAttempt?.evaluatorAssignments.some((assignment) => assignment.evaluatorUserId === session.user.id && assignment.scoreSubmission);
  }).length;
  const pendingCount = projects.length - submittedCount;

  return (
    <div className="space-y-6">
      <PageHeader title="บันทึกคะแนนการสอบนำเสนอขั้นสุดท้าย" description="สำหรับประธานหรือกรรมการที่ได้รับแต่งตั้งในโครงงานเท่านั้น" />
      <ActionFeedback success={params.success} error={params.error} />
      {!finalRound ? (
        <EmptyState title="ยังไม่มีรอบสอบนำเสนอขั้นสุดท้าย" description="ผู้ดูแลระบบต้องเปิดรอบสอบนำเสนอขั้นสุดท้ายระดับรายวิชาก่อนจึงจะบันทึกคะแนนได้" />
      ) : null}
      {finalRound ? (
        <>
          <TeacherWorkloadSummary
            metrics={[
              { label: "ต้องดำเนินการ", count: pendingCount, tone: "action", description: "ยังไม่ได้ส่งคะแนน Final" },
              { label: "รอ", count: 0, tone: "waiting", description: "รายการที่ยังไม่พร้อมไม่แสดงในหน้านี้" },
              { label: "แก้ไขได้", count: submittedCount, tone: "completed", description: "คะแนนที่ส่งแล้ว แก้ได้จนปิดรอบ" },
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
              badges: [{
                label: project.attempts.find((attempt) => attempt.assessmentRound.roundType === "FINAL_PRESENTATION")?.evaluatorAssignments.some((assignment) => assignment.evaluatorUserId === session.user.id && assignment.scoreSubmission) ? "แก้ไขคะแนนได้" : "ต้องให้คะแนน",
                tone: project.attempts.find((attempt) => attempt.assessmentRound.roundType === "FINAL_PRESENTATION")?.evaluatorAssignments.some((assignment) => assignment.evaluatorUserId === session.user.id && assignment.scoreSubmission) ? "completed" : "action"
              }, { label: "กรรมการ", tone: "waiting" }]
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
                  {previous ? `แก้ไขได้ ${Number(previous.totalScore).toFixed(2)}/100` : "ยังไม่บันทึก"}
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
                          <select name={`condition_count:${criterion.code}`} defaultValue={conditionCountForSavedScore(criterion, previousItems.get(criterion.code))} required className="mt-1" data-score-control="true">
                            <option value="" disabled>ยังไม่ได้เลือก</option>
                            {Array.from({ length: criterion.conditions.length + 1 }, (_, count) => (
                              <option key={count} value={count} data-score-points={calculateFinalQaCriterionScore(criterion, count)}>
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
                  <SubmitButton pendingText="กำลังส่งคะแนน..." confirmMessage={previous ? "ยืนยันส่งคะแนน Final ที่แก้ไขหรือไม่? ระบบจะเก็บรายการแก้ไขเป็นหลักฐาน" : "ยืนยันส่งคะแนนการสอบนำเสนอขั้นสุดท้ายหรือไม่?"} scoreGuard>
                    {previous ? "ยืนยันส่งคะแนนที่แก้ไข" : "ยืนยันส่งคะแนนการสอบนำเสนอขั้นสุดท้าย"}
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
