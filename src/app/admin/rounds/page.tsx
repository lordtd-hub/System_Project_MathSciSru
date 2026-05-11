import { auth } from "@/auth";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { InfoAlert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { courseLevelRoundTypes, defaultCourseRoundName, isRoundClosed, isRoundOpen, roundStatusLabelTh, roundTypeLabelTh } from "@/lib/assessments/courseRounds";
import { baselineRubricDefinitions } from "@/lib/admin/rubricBaseline";
import { getRoundEligibility, reasonLabelTh } from "@/lib/assessments/roundEligibility";
import { getCourseRoundResetState } from "@/lib/assessments/roundReset";
import { getRoundOpenGate, roundSequenceReasonLabelTh } from "@/lib/assessments/roundSequence";
import { prisma } from "@/lib/db";
import { closeCourseRound, openCourseRound, resetCourseRound, seedRubricBaselineFromAdmin } from "../actions";

function formatDate(value?: Date | null) {
  return value ? value.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "-";
}

export default async function AdminRoundsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return <div className="panel">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</div>;
  const params = (await searchParams) ?? {};

  const offering = await prisma.courseOffering.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { id: "desc" },
    include: { term: true }
  });

  if (!offering) {
    return <EmptyState title="ยังไม่มีรายวิชาที่เปิดใช้งาน" description="สร้างรายวิชา/ภาคเรียนก่อนจัดการรอบสอบ" />;
  }

  const rounds = await prisma.assessmentRound.findMany({
    where: { courseOfferingId: offering.id, roundType: { in: [...courseLevelRoundTypes] } },
    include: {
      closedByAdmin: true,
      attempts: { include: { presentationSubmission: true } },
      projectExceptions: true,
      scheduleProposals: true
    }
  });
  const roundMap = new Map(rounds.map((round) => [round.roundType, round]));
  const roundStatuses = Object.fromEntries(courseLevelRoundTypes.map((roundType) => [roundType, roundMap.get(roundType)?.status ?? "DRAFT"]));
  const [progress1Eligibility, rubrics] = await Promise.all([
    getRoundEligibility(offering.id, "PROGRESS_1"),
    prisma.rubric.findMany({
      where: { roundType: { in: [...courseLevelRoundTypes] }, active: true },
      orderBy: [{ roundType: "asc" }, { version: "desc" }],
      select: { id: true, roundType: true, version: true, active: true, items: { select: { id: true } } }
    })
  ]);
  const rubricMap = new Map<(typeof rubrics)[number]["roundType"], (typeof rubrics)[number]>();
  for (const rubric of rubrics) {
    if (!rubricMap.has(rubric.roundType)) rubricMap.set(rubric.roundType, rubric);
  }
  const missingRubricCount = baselineRubricDefinitions.filter((definition) => {
    const rubric = rubricMap.get(definition.roundType);
    return !rubric?.active || rubric.items.length === 0;
  }).length;
  const currentOpenRoundType = courseLevelRoundTypes.find((roundType) => isRoundOpen(roundStatuses[roundType] ?? "DRAFT"));
  const nextNotClosedRoundType = courseLevelRoundTypes.find((roundType) => !isRoundClosed(roundStatuses[roundType] ?? "DRAFT"));
  const readinessFocusRoundType = currentOpenRoundType ?? nextNotClosedRoundType ?? "FINAL_PRESENTATION";

  return (
    <div className="space-y-6">
      <PageHeader
        title="รอบสอบของรายวิชา"
        description={`${offering.term.displayName} · ${offering.courseTitle}`}
      />
      <ActionFeedback success={params.success} error={params.error} />

      <InfoAlert title="การเปิดรอบเป็นระดับรายวิชา">
        การปิดรอบการเสนอหัวข้อไม่ได้เปิดรอบสอบความก้าวหน้าครั้งที่ 1 อัตโนมัติ ผู้ดูแลระบบต้องตัดสินผลการเสนอหัวข้อ แต่งตั้งกรรมการ แล้วเปิดรอบสอบความก้าวหน้าครั้งที่ 1 เอง
      </InfoAlert>

      <section className="panel">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand">เกณฑ์ประเมินมาตรฐาน</p>
            <h2 className="mt-1 text-lg font-semibold">เกณฑ์ประเมินสำหรับรอบสอบ</h2>
            <p className="mt-1 text-sm text-muted">
              ใช้ตั้งค่าเกณฑ์ประเมินมาตรฐานสำหรับการเสนอหัวข้อ การสอบความก้าวหน้าครั้งที่ 1 ครั้งที่ 2 และการสอบนำเสนอขั้นสุดท้าย เพื่อให้ดำเนินการประเมินตามรอบรายวิชาได้ต่อเนื่อง
            </p>
          </div>
          <form action={seedRubricBaselineFromAdmin}>
            <SubmitButton className="button-secondary" pendingText="กำลังตั้งค่าเกณฑ์ประเมิน...">
              ตั้งค่าเกณฑ์ประเมินมาตรฐาน
            </SubmitButton>
          </form>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-4">
          {baselineRubricDefinitions.map((definition) => {
            const rubric = rubricMap.get(definition.roundType);
            const isReady = Boolean(rubric?.active && rubric.items.length > 0);
            return (
              <div key={definition.roundType} className="rounded-md border border-line bg-paper p-3 text-sm">
                <div className="font-semibold">{roundTypeLabelTh(definition.roundType)}</div>
                <div className="mt-1 text-muted">{rubric?.items.length ?? 0} รายการ{rubric ? ` · v${rubric.version}` : ""}</div>
                <div className={isReady ? "mt-2 text-xs font-semibold text-green-700" : "mt-2 text-xs font-semibold text-red-700"}>
                  {isReady ? "พร้อมใช้งาน" : "ยังไม่พร้อม"}
                </div>
              </div>
            );
          })}
        </div>
        {missingRubricCount ? (
          <p className="mt-3 text-sm text-red-700">มีเกณฑ์ประเมินที่ยังไม่พร้อม {missingRubricCount} รอบ กดปุ่มด้านบนเพื่อเติมเกณฑ์มาตรฐานที่ขาด</p>
        ) : (
          <p className="mt-3 text-sm text-muted">เกณฑ์ประเมินมาตรฐานพร้อมสำหรับทุกรอบสอบแล้ว</p>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {courseLevelRoundTypes.map((roundType) => {
          const round = roundMap.get(roundType);
          const eligibility = roundType === "PROGRESS_1" ? progress1Eligibility : { eligible: [], notReady: [] };
          const submittedCount = round?.attempts.filter((attempt) => ["SUBMITTED", "LOCKED"].includes(attempt.presentationSubmission?.status ?? "")).length ?? 0;
          const completedCount = round?.attempts.filter((attempt) => isRoundClosed(attempt.status) || Boolean(attempt.finalDecision)).length ?? 0;
          const exceptionCount = round?.projectExceptions.filter((exception) => exception.status !== "RESOLVED").length ?? 0;
          const openGate = getRoundOpenGate(roundType, roundStatuses, { progress1EligibleCount: progress1Eligibility.eligible.length });
          const firstNotReadyReason = eligibility.notReady.flatMap((item) => item.reasons)[0];
          const resetState = round
            ? getCourseRoundResetState(round.status, {
                attempts: round.attempts.length,
                projectExceptions: round.projectExceptions.length,
                scheduleProposals: round.scheduleProposals.length
              })
            : { canReset: false };

          return (
            <section key={roundType} className="panel">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-muted">รอบ {roundTypeLabelTh(roundType)}</div>
                  <h2 className="mt-1 text-lg font-semibold">{round?.name ?? defaultCourseRoundName(roundType)}</h2>
                </div>
                <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold">{roundStatusLabelTh(round?.status ?? "DRAFT")}</span>
              </div>
              <dl className="mt-4 space-y-1 text-sm text-muted">
                <div className="flex justify-between gap-3"><dt>เปิดเมื่อ</dt><dd>{formatDate(round?.submissionOpenAt)}</dd></div>
                <div className="flex justify-between gap-3"><dt>ปิดเมื่อ</dt><dd>{formatDate(round?.closedAt)}</dd></div>
                <div className="flex justify-between gap-3"><dt>พร้อมเข้าสู่รอบ</dt><dd>{roundType === "PROGRESS_1" ? eligibility.eligible.length : "-"}</dd></div>
                <div className="flex justify-between gap-3"><dt>ส่งแล้ว</dt><dd>{submittedCount}</dd></div>
                <div className="flex justify-between gap-3"><dt>ดำเนินการครบ</dt><dd>{completedCount}</dd></div>
                <div className="flex justify-between gap-3"><dt>ยังไม่พร้อม/ข้อยกเว้น</dt><dd>{roundType === "PROGRESS_1" ? eligibility.notReady.length + exceptionCount : exceptionCount}</dd></div>
              </dl>

              <div className="mt-4 rounded-md border border-line bg-paper p-3 text-sm">
                {openGate.canOpen ? (
                  `ขั้นตอนถัดไป: เปิดรอบ ${roundTypeLabelTh(roundType)}`
                ) : roundType === "PROGRESS_1" && openGate.reasonKey === "progress_1_not_ready" && firstNotReadyReason ? (
                  reasonLabelTh(firstNotReadyReason)
                ) : roundType === "PROPOSAL" && round && isRoundClosed(round.status) ? (
                  "ขั้นตอนถัดไป: ตัดสินผลการเสนอหัวข้อ / แต่งตั้งกรรมการ / เปิดรอบสอบความก้าวหน้าครั้งที่ 1"
                ) : (
                  roundSequenceReasonLabelTh(openGate.reasonKey)
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <form action={openCourseRound}>
                  <input type="hidden" name="course_offering_id" value={offering.id} />
                  <input type="hidden" name="round_type" value={roundType} />
                  <SubmitButton disabled={!openGate.canOpen} pendingText="กำลังเปิดรอบ...">
                    เปิดรอบ
                  </SubmitButton>
                </form>
                {round ? (
                  <form action={closeCourseRound}>
                    <input type="hidden" name="round_id" value={round.id} />
                    <SubmitButton disabled={!isRoundOpen(round.status)} pendingText="กำลังปิดรอบ..." confirmMessage={`ยืนยันการปิดรอบ ${roundTypeLabelTh(roundType)} หรือไม่?`}>
                      ปิดรอบ
                    </SubmitButton>
                  </form>
                ) : null}
                {round && resetState.canReset ? (
                  <form action={resetCourseRound}>
                    <input type="hidden" name="round_id" value={round.id} />
                    <SubmitButton
                      className="button-secondary"
                      pendingText="กำลังรีเซต..."
                      confirmMessage={`ยืนยันรีเซตรอบ ${roundTypeLabelTh(roundType)} หรือไม่? ใช้ได้เฉพาะรอบที่ยังไม่มีหลักฐานการส่งงาน การประเมิน ตารางสอบ หรือข้อยกเว้น`}
                    >
                      รีเซตรอบ
                    </SubmitButton>
                  </form>
                ) : null}
                <a className="button-secondary" href="#not-ready">ดูความพร้อมของรอบปัจจุบัน</a>
              </div>
            </section>
          );
        })}
      </div>

      <section id="not-ready" className="panel">
        <h2 className="text-lg font-semibold">ความพร้อมสำหรับรอบ {roundTypeLabelTh(readinessFocusRoundType)}</h2>
        <div className="mt-4 space-y-2">
          {readinessFocusRoundType !== "PROGRESS_1" ? (
            <InfoAlert title={`กำลังอยู่ในรอบ ${roundTypeLabelTh(readinessFocusRoundType)}`}>
              รอบสอบความก้าวหน้าครั้งที่ 1 ปิดหรือผ่านไปแล้ว รายการความพร้อมของรอบนี้จึงไม่ใช่งานหลักของรอบปัจจุบัน
            </InfoAlert>
          ) : progress1Eligibility.notReady.length ? progress1Eligibility.notReady.map((item) => (
            <div key={item.project.id} className="rounded-md border border-line p-3 text-sm">
              <div className="font-medium">
                {item.project.student?.studentCode} {item.project.student?.firstNameTh} {item.project.student?.lastNameTh}
              </div>
              <div className="mt-1 text-muted">{item.project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</div>
              <div className="mt-2 text-muted">{item.reasons.map(reasonLabelTh).join(" · ")}</div>
            </div>
          )) : (
            <InfoAlert title="ทุกโครงงานที่เกี่ยวข้องพร้อมเข้าสู่การสอบความก้าวหน้าครั้งที่ 1" />
          )}
        </div>
      </section>
    </div>
  );
}
