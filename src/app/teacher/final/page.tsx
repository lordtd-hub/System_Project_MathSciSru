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
import { prisma } from "@/lib/db";
import { isQaAunEvidenceAlignmentEnabled } from "@/lib/qa/finalRubricConfig";
import { finalQaRubric, findFinalQaCriterion } from "@/lib/rubrics/finalQaRubric";
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
