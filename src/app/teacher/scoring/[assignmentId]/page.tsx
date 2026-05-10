import { auth } from "@/auth";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { InfoAlert, WarningAlert } from "@/components/ui/Alert";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { MarkdownLatexEditor } from "@/components/ui/MarkdownLatexEditor";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/db";
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
            presentationSubmission: true,
            project: { include: { student: true } }
          }
        },
        scoreSubmission: { include: { scoreItems: true, proposalDecision: true } }
      }
    }),
    prisma.rubric.findFirst({
      where: { roundType: "PROPOSAL", active: true },
      include: { items: { orderBy: { displayOrder: "asc" } } }
    })
  ]);

  if (assignment.evaluatorUserId !== session.user.id) return <div className="panel">ไม่สามารถประเมินงานของผู้อื่นได้</div>;

  const submission = assignment.assessmentAttempt.presentationSubmission;
  const content = submission?.contentJson as Record<string, string> | undefined;
  const student = assignment.assessmentAttempt.project.student;

  if (!rubric || rubric.items.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="ประเมิน Proposal"
          description={`${student.studentCode} ${student.firstNameTh} ${student.lastNameTh}`}
        />
        <ActionFeedback success={query.success} error={query.error ?? "proposal_rubric_missing"} />
        <WarningAlert title="ยังไม่มี Rubric สำหรับ Proposal">
          ผู้ดูแลระบบต้องตั้งค่า rubric baseline สำหรับ Proposal ก่อน อาจารย์จึงจะประเมินได้
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

  const checked = new Set(assignment.scoreSubmission?.scoreItems.filter((item) => item.checked).map((item) => item.rubricItemId));
  const currentTotal = rubric.items.reduce((sum, item) => sum + (checked.has(item.id) ? item.points : 0), 0);
  const groupedRubric = rubric.items.reduce<Record<string, typeof rubric.items>>((groups, item) => {
    const key = item.groupLabelTh;
    groups[key] = groups[key] ?? [];
    groups[key].push(item);
    return groups;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="ประเมิน Proposal"
        description={`${student.studentCode} ${student.firstNameTh} ${student.lastNameTh}`}
        actions={<span className="sticky-score rounded-full border border-line bg-surface px-3 py-2 text-sm font-semibold">รวมที่เลือกไว้ {currentTotal}/100</span>}
      />
      <ActionFeedback success={query.success} error={query.error} />
      <GuidancePanel
        title="แนวทางก่อนส่งคะแนน"
        current="อ่าน abstract และเอกสารแนบ จากนั้นเลือก checklist ตามหลักฐานที่พบ"
        next="ระบบจะบันทึกคะแนนและ vote แต่แสดงให้นักศึกษาเห็นเฉพาะ comment พร้อมชื่ออาจารย์"
        actor="อาจารย์ผู้ประเมิน Proposal"
      />
      <InfoAlert title="การมองเห็นของนักศึกษา">
        นักศึกษาจะเห็น comment และชื่ออาจารย์ทันที แต่จะไม่เห็นคะแนน Proposal
      </InfoAlert>
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
          <WarningAlert title="Critical item warnings">
            หากไม่ผ่านรายการ critical ควรอธิบายใน comment ให้ชัดเจน โดยเฉพาะกรณี REVISE หรือ FAIL
          </WarningAlert>
          <section className="panel">
            <h2 className="font-semibold">Rubric groups</h2>
            <div className="mt-3 space-y-2 text-sm text-muted">
              <div>Clarity of Proposal 20</div>
              <div>Relevance 20</div>
              <div>Research Plan 30</div>
              <div>Presentation 20</div>
              <div>Overall 10</div>
            </div>
          </section>
        </aside>
      </div>
      <form action={submitProposalScore} className="space-y-4">
        <input type="hidden" name="assignment_id" value={assignment.id} />
        {Object.entries(groupedRubric).map(([groupLabel, items]) => (
          <details key={groupLabel} className="panel space-y-3" open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{groupLabel}</h2>
              <span className="rounded-full border border-line px-3 py-1 text-xs">
                {items.reduce((sum, item) => sum + item.points, 0)} คะแนน
              </span>
            </summary>
            {items.map((item) => (
              <label key={item.id} className="flex min-h-14 items-start gap-3 rounded-md border border-line p-3">
                <input className="mt-1 h-5 w-5 shrink-0" type="checkbox" name="checked_item" value={item.id} defaultChecked={checked.has(item.id)} />
                <span className="flex-1">
                  <span className="block font-medium">
                    {item.itemLabelTh} ({item.points} คะแนน)
                  </span>
                  {item.evidenceHint ? <span className="text-xs text-muted">{item.evidenceHint}</span> : null}
                  {item.isCritical ? <span className="mt-1 block text-xs font-semibold text-red-700">Critical item</span> : null}
                </span>
              </label>
            ))}
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
            <MarkdownLatexEditor name="overall_comment" label="Comment ถึงนักศึกษา" defaultValue={assignment.scoreSubmission?.overallComment ?? ""} rows={5} />
            <p className="mt-1 text-xs text-muted">comment นี้จะแสดงให้นักศึกษาเห็นทันทีพร้อมชื่ออาจารย์</p>
          </div>
          <div className="sticky bottom-0 -mx-5 flex flex-col gap-2 border-t border-line bg-surface/95 p-4 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:border-0 sm:bg-transparent sm:p-0">
            <SubmitButton name="submit_mode" value="draft" pendingText="กำลังบันทึก...">บันทึก comment</SubmitButton>
            <SubmitButton name="submit_mode" value="submit" pendingText="กำลังส่งคะแนน..." confirmMessage="ยืนยันการส่งคะแนน Proposal หรือไม่? หลังส่งแล้วระบบจะบันทึกคะแนนและ comment เป็นหลักฐาน">
              ส่งคะแนน Proposal
            </SubmitButton>
          </div>
        </section>
      </form>
    </div>
  );
}
