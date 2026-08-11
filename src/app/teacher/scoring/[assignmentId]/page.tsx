import { auth } from "@/auth";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { InfoAlert, WarningAlert } from "@/components/ui/Alert";
import { MarkdownLatexEditor } from "@/components/ui/MarkdownLatexEditor";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProposalQaRubricPanel } from "@/components/ui/ProposalQaRubricPanel";
import { RecoverableActionForm } from "@/components/ui/ProposalDraftForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/db";
import { hasOpenLateRoundException, requiresLateRoundPenalty } from "@/lib/assessments/roundExceptions";
import { ensureProposalConditionRubric } from "@/lib/rubrics/ensureProposalConditionRubric";
import { calculateCriterionScore, findProposalQaCriterion } from "@/lib/rubrics/proposalQaRubric";
import { isProposalScoreEditable } from "@/lib/scoring/scoreEditability";
import { submitProposalScore } from "../../actions";

export default async function ProposalScoringPage({
  params,
  searchParams
}: {
  params: Promise<{ assignmentId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { assignmentId } = await params;
  const query = (await searchParams) ?? {};
  const session = await auth();
  if (!hasApprovedTeacherCapability(session?.user) || !session?.user.id) return <div className="panel">หน้านี้สำหรับอาจารย์เท่านั้น</div>;

  const [assignment, rubric] = await Promise.all([
    prisma.evaluatorAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: {
        assessmentAttempt: {
          include: {
            assessmentRound: true,
            proposalResult: true,
            presentationSubmission: true,
            project: { include: { student: true } }
          }
        },
        scoreSubmission: { include: { scoreItems: true, proposalDecision: true } }
      }
    }),
    ensureProposalConditionRubric(prisma)
  ]);

  if (assignment.evaluatorUserId !== session.user.id) return <div className="panel">ไม่สามารถประเมินงานของผู้อื่นได้</div>;

  const submission = assignment.assessmentAttempt.presentationSubmission;
  const content = submission?.contentJson as Record<string, string> | undefined;
  const student = assignment.assessmentAttempt.project.student;
  const lateRoundExceptions = await prisma.projectRoundException.findMany({
    where: {
      projectId: assignment.assessmentAttempt.projectId,
      assessmentRoundId: assignment.assessmentAttempt.assessmentRoundId,
      status: "OPEN"
    },
    select: { exceptionType: true, status: true }
  });
  const hasLateRoundOverride = hasOpenLateRoundException(lateRoundExceptions);
  const latePenaltyRequired = requiresLateRoundPenalty(lateRoundExceptions);

  if (!rubric || rubric.items.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="ประเมินการเสนอหัวข้อ"
          description={`${student.studentCode} ${student.firstNameTh} ${student.lastNameTh}`}
        />
        <ActionFeedback success={query.success} error={query.error ?? "proposal_rubric_missing"} />
        <ProposalQaRubricPanel audience="evaluator" />
        <WarningAlert title="ยังไม่มีเกณฑ์ประเมินสำหรับการเสนอหัวข้อ">
          ผู้ดูแลระบบต้องตั้งค่าเกณฑ์ประเมินมาตรฐานสำหรับการเสนอหัวข้อก่อน อาจารย์จึงจะประเมินได้
          หน้านี้แสดงข้อมูลที่นักศึกษาส่งไว้เพื่ออ่านตรวจเท่านั้น และยังไม่บันทึกคะแนนหรือเปลี่ยนสถานะงาน
        </WarningAlert>
        <section className="panel">
          <h2 className="text-lg font-semibold">{submission?.titleTh ?? "ยังไม่มีชื่อหัวข้อ"}</h2>
          {submission?.titleEn ? <p className="mt-1 text-sm text-muted">{submission.titleEn}</p> : null}
          {submission?.materialLink ? (
            <a className="mt-3 inline-block text-sm font-medium text-brand" href={submission.materialLink} target="_blank" rel="noreferrer">
              เปิดเอกสารแนบ
            </a>
          ) : null}
          <div className="mt-4">
            <div className="mb-2 text-sm font-semibold">Abstract</div>
            <MarkdownLatexViewer value={submission?.abstractText} emptyText="ยังไม่มี abstract" />
          </div>
          <div className="mt-4 grid gap-3">
            {[
              { label: "ที่มาและความสำคัญ", value: content?.motivationBackground },
              { label: "วัตถุประสงค์", value: content?.objectives },
              { label: "วิธีดำเนินงาน", value: content?.proposedMethods },
              { label: "ผลที่คาดว่าจะได้รับ", value: content?.expectedOutcomes },
              { label: "แผนดำเนินงาน", value: content?.timeline },
              { label: "คำถามถึงอาจารย์", value: content?.questionsForTeachers }
            ].map((section) => (
              <details key={section.label} className="rounded-md border border-line p-3" open={section.label === "ที่มาและความสำคัญ"}>
                <summary className="cursor-pointer text-sm font-semibold">{section.label}</summary>
                <MarkdownLatexViewer className="mt-2" value={section.value} emptyText="ยังไม่มีข้อมูล" />
              </details>
            ))}
          </div>
        </section>
      </div>
    );
  }

  const previousScoreItems = new Map(assignment.scoreSubmission?.scoreItems.map((item) => [item.rubricItemId, item]) ?? []);
  const checked = new Set(assignment.scoreSubmission?.scoreItems.filter((item) => item.checked).map((item) => item.rubricItemId));
  const currentTotal = rubric.items.reduce((sum, item) => sum + (previousScoreItems.get(item.id)?.pointsAwarded ?? (checked.has(item.id) ? item.points : 0)), 0);
  const hasSubmittedScore = assignment.status === "SUBMITTED" || assignment.scoreSubmission?.status === "SUBMITTED";
  const hasAdminProposalDecision = Boolean(assignment.assessmentAttempt.proposalResult);
  const isProposalRoundClosed = assignment.assessmentAttempt.assessmentRound.status !== "SCORING_OPEN" && !hasLateRoundOverride;
  const isLateProposalOverride = assignment.assessmentAttempt.assessmentRound.status !== "SCORING_OPEN" && hasLateRoundOverride;
  const isScoreFormUnavailable = !isProposalScoreEditable({
    roundStatus: assignment.assessmentAttempt.assessmentRound.status,
    hasAdminDecision: hasAdminProposalDecision,
    roundExceptions: lateRoundExceptions
  });
  const groupedRubric = rubric.items.reduce<Record<string, typeof rubric.items>>((groups, item) => {
    const key = item.groupLabelTh;
    groups[key] = groups[key] ?? [];
    groups[key].push(item);
    return groups;
  }, {});
  const rubricGroupSummaries = Object.entries(groupedRubric).map(([groupLabel, items]) => ({
    groupLabel,
    points: items.reduce((sum, item) => sum + item.points, 0)
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="ประเมินการเสนอหัวข้อ"
        description={`${student.studentCode} ${student.firstNameTh} ${student.lastNameTh}`}
        actions={<span className="sticky-score rounded-full border border-line bg-surface px-3 py-2 text-sm font-semibold">รวมที่เลือกไว้ {currentTotal}/100</span>}
      />
      <ActionFeedback success={query.success} error={query.error} />
      {isLateProposalOverride ? (
        <WarningAlert title="เปิดประเมินย้อนหลังเป็นรายกรณี">
          {latePenaltyRequired
            ? "รายการนี้ถูกเปิดหลังปิดรอบ Proposal ระบบจะหักคะแนน 10% จากคะแนนที่อาจารย์ประเมินในรอบนี้"
            : "รายการนี้ถูกเปิดหลังปิดรอบ Proposal เป็นกรณีพิเศษโดยไม่หักคะแนน"}
        </WarningAlert>
      ) : null}
      {isProposalRoundClosed ? (
        <WarningAlert title="รอบเสนอหัวข้อปิดแล้ว">
          หน้านี้เปิดให้อ่านหลักฐานและคะแนนเดิมเท่านั้น ไม่สามารถเริ่มหรือส่งคะแนนการเสนอหัวข้อเพิ่มหลังปิดรอบได้
        </WarningAlert>
      ) : null}
      {hasAdminProposalDecision ? (
        <InfoAlert title="ผู้ดูแลระบบบันทึกผลการเสนอหัวข้อแล้ว">
          รายการนี้ปิดการประเมินหลังผู้ดูแลระบบบันทึกผลตัดสินแล้ว อาจารย์ที่ยังไม่ได้ประเมินไม่จำเป็นต้องส่งคะแนนเพิ่ม
        </InfoAlert>
      ) : null}
      {hasSubmittedScore && !isScoreFormUnavailable ? (
        <InfoAlert title="คะแนนถูกส่งแล้วและยังแก้ไขได้">
          อาจารย์สามารถแก้คะแนน ผลประเมิน และข้อเสนอแนะได้จนกว่าผู้ดูแลระบบจะบันทึกผลตัดสิน Proposal
        </InfoAlert>
      ) : null}
      <InfoAlert title="การมองเห็นของนักศึกษา">
        นักศึกษาจะเห็นข้อเสนอแนะและชื่ออาจารย์ทันที แต่จะไม่เห็นคะแนนการเสนอหัวข้อ
      </InfoAlert>
      <ProposalQaRubricPanel audience="evaluator" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="panel">
          <h2 className="text-lg font-semibold">{submission?.titleTh ?? "ยังไม่มีชื่อหัวข้อ"}</h2>
          {submission?.titleEn ? <p className="mt-1 text-sm text-muted">{submission.titleEn}</p> : null}
          {submission?.materialLink ? (
            <a className="mt-3 inline-block text-sm font-medium text-brand" href={submission.materialLink} target="_blank" rel="noreferrer">
              เปิดเอกสารแนบ
            </a>
          ) : null}
          <div className="mt-4">
            <div className="mb-2 text-sm font-semibold">Abstract</div>
            <MarkdownLatexViewer value={submission?.abstractText} emptyText="ยังไม่มี abstract" />
          </div>
          <div className="mt-4 grid gap-3">
            {[
              { label: "ที่มาและความสำคัญ", value: content?.motivationBackground },
              { label: "วัตถุประสงค์", value: content?.objectives },
              { label: "วิธีดำเนินงาน", value: content?.proposedMethods },
              { label: "ผลที่คาดว่าจะได้รับ", value: content?.expectedOutcomes },
              { label: "แผนดำเนินงาน", value: content?.timeline },
              { label: "คำถามถึงอาจารย์", value: content?.questionsForTeachers }
            ].map((section) => (
              <details key={section.label} className="rounded-md border border-line p-3" open={section.label === "ที่มาและความสำคัญ"}>
                <summary className="cursor-pointer text-sm font-semibold">{section.label}</summary>
                <MarkdownLatexViewer className="mt-2" value={section.value} emptyText="ยังไม่มีข้อมูล" />
              </details>
            ))}
          </div>
        </section>
        <aside className="space-y-4">
          <WarningAlert title="ข้อควรพิจารณาในรายการสำคัญ">
            หากไม่ผ่านรายการสำคัญ ควรอธิบายในข้อเสนอแนะให้ชัดเจน โดยเฉพาะกรณีให้แก้ไขหรือไม่ผ่าน
          </WarningAlert>
          <section className="panel">
            <h2 className="font-semibold">Rubric groups</h2>
            <div className="mt-3 space-y-2 text-sm text-muted">
              {rubricGroupSummaries.map((group) => (
                <div key={group.groupLabel} className="flex items-center justify-between gap-3">
                  <span>{group.groupLabel}</span>
                  <span className="font-medium text-ink">{group.points}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
      {isScoreFormUnavailable ? (
        <section className="panel space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{hasSubmittedScore ? "ผลการประเมินที่ยืนยันแล้ว" : "ปิดการประเมินสำหรับรายการนี้"}</h2>
              <p className="mt-1 text-sm text-muted">
                {hasSubmittedScore
                  ? "อ่านย้อนหลังได้เท่านั้น เนื่องจากผู้ดูแลระบบบันทึกผลตัดสินหรือปิดรอบแล้ว"
                  : "ผู้ดูแลระบบบันทึกผลตัดสินหรือรอบประเมินปิดแล้ว จึงไม่ต้องส่งคะแนนเพิ่ม"}
              </p>
            </div>
            <span className="rounded-full border border-line bg-surface px-3 py-1 text-sm font-semibold">{currentTotal}/100 คะแนน</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-line bg-paper p-3 text-sm">
              <div className="text-muted">ผลการประเมิน</div>
              <div className="mt-1 font-semibold">{assignment.scoreSubmission?.proposalDecision?.decision ?? "-"}</div>
            </div>
            <div className="rounded-md border border-line bg-paper p-3 text-sm">
              <div className="text-muted">สถานะ</div>
              <div className="mt-1 font-semibold">{assignment.scoreSubmission?.status ?? assignment.status}</div>
            </div>
          </div>
          {assignment.scoreSubmission?.proposalDecision?.reason ? (
            <div>
              <div className="mb-2 text-sm font-semibold">เหตุผล</div>
              <MarkdownLatexViewer value={assignment.scoreSubmission.proposalDecision.reason} />
            </div>
          ) : null}
          {assignment.scoreSubmission?.overallComment ? (
            <div>
              <div className="mb-2 text-sm font-semibold">Comment ถึงนักศึกษา</div>
              <MarkdownLatexViewer value={assignment.scoreSubmission.overallComment} />
            </div>
          ) : null}
          <div className="space-y-3">
            {Object.entries(groupedRubric).map(([groupLabel, items]) => (
              <details key={groupLabel} className="rounded-md border border-line p-3" open>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <h3 className="font-semibold">{groupLabel}</h3>
                  <span className="text-xs text-muted">{items.reduce((sum, item) => sum + (previousScoreItems.get(item.id)?.pointsAwarded ?? 0), 0)} / {items.reduce((sum, item) => sum + item.points, 0)}</span>
                </summary>
                <div className="mt-3 space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 rounded-md bg-paper p-3 text-sm">
                      <div>
                        <div className="font-medium">{item.itemLabelTh}</div>
                        {item.evidenceHint ? <div className="mt-1 text-xs text-muted">{item.evidenceHint}</div> : null}
                      </div>
                      <span className="shrink-0 font-semibold">{previousScoreItems.get(item.id)?.pointsAwarded ?? 0}/{item.points}</span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      ) : (
        <RecoverableActionForm
          action={submitProposalScore}
          storageKey={`teacher-proposal-score-recovery:${session.user.id}:${assignment.id}`}
          className="space-y-4"
        >
          <input type="hidden" name="assignment_id" value={assignment.id} />
          {Object.entries(groupedRubric).map(([groupLabel, items]) => (
            <details key={groupLabel} className="panel space-y-3" open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{groupLabel}</h2>
              <span className="rounded-full border border-line px-3 py-1 text-xs">
                {items.reduce((sum, item) => sum + item.points, 0)} คะแนน
              </span>
            </summary>
            {items.map((item) => {
              const proposalCriterion = findProposalQaCriterion(item.itemKey);
              const hasPreviousScoreItem = previousScoreItems.has(item.id);
              const previousPoints = previousScoreItems.get(item.id)?.pointsAwarded ?? 0;
              const previousConditionCount = proposalCriterion?.scoreMappings.find((mapping) => mapping.score === previousPoints)?.conditionCount ?? 0;

              if (proposalCriterion) {
                const conditionMax = proposalCriterion.conditions.length || proposalCriterion.requiredSections?.length || 0;
                return (
                  <div key={item.id} className="rounded-md border border-line p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">
                          {item.itemLabelTh} ({item.points} คะแนน)
                        </div>
                        {item.evidenceHint ? <div className="mt-1 text-xs text-muted">{item.evidenceHint}</div> : null}
                        {item.isCritical ? <div className="mt-1 text-xs font-semibold text-red-700">Critical item</div> : null}
                      </div>
                      <label className="min-w-44 text-sm font-medium">
                        เงื่อนไขที่ผ่าน
                        <select
                          name={`condition_count:${item.id}`}
                          defaultValue={hasPreviousScoreItem ? previousConditionCount : ""}
                          className="mt-1"
                          required
                          data-score-control="true"
                        >
                          <option value="" disabled>ยังไม่ได้เลือก</option>
                          {Array.from({ length: conditionMax + 1 }, (_, count) => (
                            <option key={count} value={count} data-score-points={calculateCriterionScore(proposalCriterion, count)}>
                              {count}/{conditionMax} เงื่อนไข
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                );
              }

              return (
                <label key={item.id} className="flex min-h-14 items-start gap-3 rounded-md border border-line p-3">
                  <input
                    className="mt-1 h-5 w-5 shrink-0"
                    type="checkbox"
                    name="checked_item"
                    value={item.id}
                    defaultChecked={checked.has(item.id)}
                    data-score-control="true"
                    data-score-points={item.points}
                  />
                  <span className="flex-1">
                    <span className="block font-medium">
                      {item.itemLabelTh} ({item.points} คะแนน)
                    </span>
                    {item.evidenceHint ? <span className="text-xs text-muted">{item.evidenceHint}</span> : null}
                    {item.isCritical ? <span className="mt-1 block text-xs font-semibold text-red-700">Critical item</span> : null}
                  </span>
                </label>
              );
            })}
            </details>
          ))}
          <section className="panel grid gap-3 md:grid-cols-2">
          <div>
            <label>ผลการประเมิน</label>
            <select name="decision" defaultValue={assignment.scoreSubmission?.proposalDecision?.decision ?? "PASS"}>
              <option value="PASS">PASS</option>
              <option value="PASS_WITH_REVISION">REVISE</option>
              <option value="NOT_PASS">FAIL</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <MarkdownLatexEditor name="reason" label="เหตุผลเมื่อให้ REVISE หรือ FAIL" defaultValue={assignment.scoreSubmission?.proposalDecision?.reason ?? ""} rows={3} required={false} />
          </div>
          <div className="md:col-span-2">
            <MarkdownLatexEditor name="overall_comment" label="ข้อเสนอแนะถึงนักศึกษา" defaultValue={assignment.scoreSubmission?.overallComment ?? ""} rows={5} />
            <p className="mt-1 text-xs text-muted">ข้อเสนอแนะนี้จะแสดงให้นักศึกษาเห็นทันทีพร้อมชื่ออาจารย์</p>
          </div>
          <div className="sticky bottom-0 -mx-5 flex flex-col gap-2 border-t border-line bg-surface/95 p-4 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:border-0 sm:bg-transparent sm:p-0">
            {!hasSubmittedScore ? (
              <SubmitButton name="submit_mode" value="draft" pendingText="กำลังบันทึกร่าง...">บันทึกร่างข้อเสนอแนะ</SubmitButton>
            ) : null}
            <SubmitButton
              name="submit_mode"
              value="submit"
              pendingText="กำลังส่งคะแนน..."
              confirmMessage={hasSubmittedScore ? "ยืนยันส่งคะแนนการเสนอหัวข้อที่แก้ไขหรือไม่? ระบบจะเก็บรายการแก้ไขเป็นหลักฐาน" : "ยืนยันส่งคะแนนการเสนอหัวข้อหรือไม่? ระบบจะบันทึกคะแนนและข้อเสนอแนะเป็นหลักฐาน"}
              scoreGuard
            >
              {hasSubmittedScore ? "ยืนยันส่งคะแนนที่แก้ไข" : "ยืนยันส่งคะแนนการเสนอหัวข้อ"}
            </SubmitButton>
          </div>
          </section>
        </RecoverableActionForm>
      )}
    </div>
  );
}
