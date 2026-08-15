import { auth } from "@/auth";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { AdminRoundActionForm } from "@/components/ui/AdminRoundActionForm";
import { AdminDangerZone, AdminOperationalSummary, AdminQueueBadge } from "@/components/ui/AdminOperationalQueue";
import { InfoAlert, WarningAlert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { courseLevelRoundTypes, defaultCourseRoundName, isRoundClosed, isRoundOpen, roundStatusLabelTh, roundTypeLabelTh } from "@/lib/assessments/courseRounds";
import { baselineRubricDefinitions } from "@/lib/admin/rubricBaseline";
import { getRoundEligibility, reasonLabelTh } from "@/lib/assessments/roundEligibility";
import { getCourseRoundResetState } from "@/lib/assessments/roundReset";
import { getRoundOpenGate, roundSequenceReasonLabelTh } from "@/lib/assessments/roundSequence";
import { prisma } from "@/lib/db";
import { formatThaiDateTime24 } from "@/lib/format/dateTime";
import { closeCourseRound, openCourseRound, resetCourseRound, seedRubricBaselineFromAdmin } from "../actions";

function formatDate(value?: Date | null) {
  return formatThaiDateTime24(value);
}

function readinessActionForReason(reason: string) {
  if (["committee", "committee not assigned", "missing HEAD", "missing MEMBER"].includes(reason)) {
    return { href: "/admin/committee", label: "ไปจัดการกรรมการ" };
  }
  if (["proposal", "waiting proposal final decision", "proposal failed/revise", "previous proposal gate not passed"].includes(reason)) {
    return { href: "/admin/proposals", label: "ไปตรวจผล Proposal" };
  }
  if (["project_state", "project still PENDING_ADMIN", "project in DRAFT", "project still PENDING_ADVISOR"].includes(reason)) {
    return { href: "/admin", label: "กลับแดชบอร์ดผู้ดูแลระบบ" };
  }
  return null;
}

function readinessReasonGroup(reason: string) {
  if (["committee not assigned", "missing HEAD", "missing MEMBER"].includes(reason)) {
    return { key: "committee", label: "ยังไม่ได้แต่งตั้งกรรมการครบ" };
  }
  if (["waiting proposal final decision", "proposal failed/revise", "previous proposal gate not passed"].includes(reason)) {
    return { key: "proposal", label: "ยังไม่ผ่าน/ยังไม่จบขั้น Proposal" };
  }
  if (["project still PENDING_ADMIN", "project in DRAFT", "project still PENDING_ADVISOR"].includes(reason)) {
    return { key: "project_state", label: "สถานะโครงงานยังไม่พร้อม" };
  }
  return { key: reason, label: reasonLabelTh(reason) };
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
      attempts: {
        include: {
          presentationSubmission: true,
          project: { include: { committeeAssignments: true } },
          evaluatorAssignments: { include: { scoreSubmission: true } }
        }
      },
      projectExceptions: true,
      scheduleProposals: true
    }
  });
  const roundMap = new Map(rounds.map((round) => [round.roundType, round]));
  const roundStatuses = Object.fromEntries(courseLevelRoundTypes.map((roundType) => [roundType, roundMap.get(roundType)?.status ?? "DRAFT"]));
  const [roundEligibilityEntries, rubrics] = await Promise.all([
    Promise.all(courseLevelRoundTypes.map(async (roundType) => [roundType, await getRoundEligibility(offering.id, roundType)] as const)),
    prisma.rubric.findMany({
      where: { roundType: { in: [...courseLevelRoundTypes] }, active: true },
      orderBy: [{ roundType: "asc" }, { version: "desc" }],
      select: { id: true, roundType: true, version: true, active: true, items: { select: { id: true } } }
    })
  ]);
  const emptyEligibility = { eligible: [], notReady: [], submitted: [], completed: [], eligibleButIncomplete: [] };
  const roundEligibilityByType = new Map(roundEligibilityEntries);
  const progress1Eligibility = roundEligibilityByType.get("PROGRESS_1") ?? emptyEligibility;
  const missingProposalProjects = await prisma.project.findMany({
    where: { courseOfferingId: offering.id, presentationSubmissions: { none: {} } },
    orderBy: { student: { studentCode: "asc" } },
    select: {
      id: true,
      currentTitleTh: true,
      student: { select: { studentCode: true, firstNameTh: true, lastNameTh: true } },
      roundExceptions: {
        where: { status: "OPEN", assessmentRound: { roundType: "PROPOSAL" } },
        select: { id: true, exceptionType: true, reason: true }
      }
    }
  });
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
  const readinessFocusEligibility = roundEligibilityByType.get(readinessFocusRoundType) ?? emptyEligibility;
  const readinessReasonGroups = Array.from(
    readinessFocusEligibility.notReady.reduce((groups, item) => {
      const seenGroupKeys = new Set<string>();
      for (const reason of item.reasons.length ? item.reasons : ["ยังไม่ผ่านเงื่อนไขของรอบก่อนหน้า"]) {
        const groupInfo = readinessReasonGroup(reason);
        if (seenGroupKeys.has(groupInfo.key)) continue;
        seenGroupKeys.add(groupInfo.key);
        const current = groups.get(groupInfo.key) ?? { key: groupInfo.key, label: groupInfo.label, count: 0, samples: [] as typeof readinessFocusEligibility.notReady };
        current.count += 1;
        if (current.samples.length < 3) current.samples.push(item);
        groups.set(groupInfo.key, current);
      }
      return groups;
    }, new Map<string, { key: string; label: string; count: number; samples: typeof readinessFocusEligibility.notReady }>()).values()
  ).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "th"));
  const roundOperationalState = courseLevelRoundTypes.map((roundType) => {
    const round = roundMap.get(roundType);
    const eligibility = roundEligibilityByType.get(roundType) ?? emptyEligibility;
    const openGate = getRoundOpenGate(roundType, roundStatuses, { progress1EligibleCount: progress1Eligibility.eligible.length });
    const open = Boolean(round && isRoundOpen(round.status));
    const exceptionCount = round?.projectExceptions.filter((exception) => exception.status !== "RESOLVED").length ?? 0;
    const waitingTeachers = Math.max(eligibility.submitted.length - eligibility.completed.length, 0);
    const waitingStudents = Math.max(eligibility.eligibleButIncomplete.length - waitingTeachers, 0);
    return { roundType, round, eligibility, openGate, open, exceptionCount, waitingTeachers, waitingStudents };
  });
  const openableRoundCount = roundOperationalState.filter((item) => item.openGate.canOpen && !item.open).length;
  const readyToCloseRoundCount = roundOperationalState.filter((item) => item.open && item.eligibility.eligibleButIncomplete.length === 0).length;
  const waitingTeacherCount = roundOperationalState.reduce((sum, item) => sum + item.waitingTeachers, 0);
  const waitingStudentCount = roundOperationalState.reduce((sum, item) => sum + item.waitingStudents, 0);
  const exceptionCount = roundOperationalState.reduce((sum, item) => sum + item.exceptionCount, 0);
  const notEligibleCount = roundOperationalState.reduce((sum, item) => sum + item.eligibility.notReady.length, 0);

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

      <AdminOperationalSummary
        title="สรุปปฏิบัติการรอบสอบ"
        description="แยกรายการที่ต้องกดดำเนินการ ออกจากรายการที่รอนักศึกษา/อาจารย์ และรายการที่ยังไม่เข้าเกณฑ์ของรอบ"
        metrics={[
          { label: "เปิดรอบได้", count: openableRoundCount, tone: openableRoundCount ? "action" : "locked", description: "รอบที่ผ่านเงื่อนไขลำดับแล้ว แต่ยังไม่ได้เปิด" },
          { label: "พร้อมปิดรอบ", count: readyToCloseRoundCount, tone: readyToCloseRoundCount ? "ready" : "locked", description: "รอบที่เปิดอยู่และไม่มี eligible-but-incomplete" },
          { label: "รออาจารย์", count: waitingTeacherCount, tone: waitingTeacherCount ? "waiting" : "completed", description: "มีหลักฐานแล้ว แต่คะแนน/การประเมินยังไม่ครบ" },
          { label: "รอนักศึกษา", count: waitingStudentCount, tone: waitingStudentCount ? "waiting" : "completed", description: "เข้าเกณฑ์รอบนี้แล้ว แต่หลักฐานหรือขั้นตอนยังไม่ครบ" },
          { label: "ข้อยกเว้น/ย้อนหลัง", count: exceptionCount, tone: exceptionCount ? "exception" : "locked", description: "รายการเปิดส่งย้อนหลังหรือข้อยกเว้นที่ยังไม่ resolved" },
          { label: "ยังไม่เข้าเกณฑ์", count: notEligibleCount, tone: "locked", description: "ไม่ใช่ blocker ของรอบปัจจุบัน" }
        ]}
      />

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
          const eligibility = roundEligibilityByType.get(roundType) ?? emptyEligibility;
          const submittedCount = eligibility.submitted.length;
          const completedCount = eligibility.completed.length;
          const exceptionCount = round?.projectExceptions.filter((exception) => exception.status !== "RESOLVED").length ?? 0;
          const openGate = getRoundOpenGate(roundType, roundStatuses, { progress1EligibleCount: progress1Eligibility.eligible.length });
          const canScheduledZeroReadyOpen = roundType === "PROGRESS_1"
            && openGate.reasonKey === "progress_1_not_ready"
            && isRoundClosed(roundStatuses.PROPOSAL ?? "DRAFT")
            && progress1Eligibility.eligible.length === 0;
          const firstNotReadyReason = eligibility.notReady.flatMap((item) => item.reasons)[0];
          const requireProposalCloseAck = roundType === "PROPOSAL" && Boolean(round && isRoundOpen(round.status) && missingProposalProjects.length);
          const requireIncompleteCloseAck = roundType !== "PROPOSAL" && Boolean(round && isRoundOpen(round.status) && eligibility.eligibleButIncomplete.length);
          const requiresCloseAck = requireProposalCloseAck || requireIncompleteCloseAck;
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
                <div className="flex justify-between gap-3"><dt>พร้อมเข้าสู่รอบนี้</dt><dd>{eligibility.eligible.length}</dd></div>
                <div className="flex justify-between gap-3"><dt>ส่งหลักฐานรอบนี้แล้ว</dt><dd>{submittedCount}</dd></div>
                <div className="flex justify-between gap-3"><dt>ประเมินรอบนี้ครบ</dt><dd>{completedCount}</dd></div>
                <div className="flex justify-between gap-3"><dt>พร้อมแต่ยังไม่ครบ</dt><dd>{eligibility.eligibleButIncomplete.length}</dd></div>
                <div className="flex justify-between gap-3"><dt>ยังไม่พร้อมรอบนี้</dt><dd>{eligibility.notReady.length}</dd></div>
                <div className="flex justify-between gap-3"><dt>ข้อยกเว้น/เปิดส่งย้อนหลัง</dt><dd>{exceptionCount}</dd></div>
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

              {requireProposalCloseAck ? (
                <WarningAlert title={`มีนักศึกษายังไม่ส่ง Proposal ${missingProposalProjects.length} ราย`}>
                  <div className="space-y-2">
                    <p>ก่อนปิดรอบ โปรดยืนยันว่ารับทราบรายชื่อนักศึกษาที่ค้างส่งแล้ว ระบบจะล็อกการส่งปกติหลังปิดรอบ</p>
                    <ul className="list-disc space-y-1 pl-5">
                      {missingProposalProjects.slice(0, 8).map((project) => (
                        <li key={project.id}>{project.student?.studentCode} {project.student?.firstNameTh} {project.student?.lastNameTh}</li>
                      ))}
                    </ul>
                    {missingProposalProjects.length > 8 ? <p>และรายการอื่นอีก {missingProposalProjects.length - 8} ราย</p> : null}
                  </div>
                </WarningAlert>
              ) : null}

              {requireIncompleteCloseAck ? (
                <WarningAlert title={`มีโครงงานที่พร้อมเข้าสู่ ${roundTypeLabelTh(roundType)} แต่ยังดำเนินการไม่ครบ ${eligibility.eligibleButIncomplete.length} รายการ`}>
                  <div className="space-y-2">
                    <p>
                      รายการนี้นับเฉพาะโครงงานที่ผ่านเกณฑ์จากรอบก่อนหน้าแล้ว แต่ยังส่งหลักฐานหรือประเมินรอบปัจจุบันไม่ครบ
                      โครงงานที่ยังไม่ผ่านรอบก่อนหน้าจะแยกอยู่ในกลุ่ม &quot;ยังไม่พร้อมรอบนี้&quot; และไม่ใช่ตัวบล็อกของรอบนี้
                    </p>
                    {roundType === "FINAL_PRESENTATION" ? (
                      <p className="font-semibold">หากปิดรอบ Final ขณะที่รายการเหล่านี้ยังไม่ครบ นักศึกษาอาจได้รับเกรด I</p>
                    ) : null}
                    <ul className="list-disc space-y-1 pl-5">
                      {eligibility.eligibleButIncomplete.slice(0, 8).map((item) => (
                        <li key={item.project.id}>
                          {item.project.student?.studentCode} {item.project.student?.firstNameTh} {item.project.student?.lastNameTh}
                          {item.project.currentTitleTh ? ` - ${item.project.currentTitleTh}` : ""}
                        </li>
                      ))}
                    </ul>
                    {eligibility.eligibleButIncomplete.length > 8 ? <p>และรายการอื่นอีก {eligibility.eligibleButIncomplete.length - 8} รายการ</p> : null}
                  </div>
                </WarningAlert>
              ) : null}

              {roundType === "PROPOSAL" && round && isRoundClosed(round.status) && missingProposalProjects.length ? (
                <WarningAlert title="จัดการผู้ส่งย้อนหลัง / นักศึกษาที่พลาดรอบ">
                  <div className="space-y-3">
                    <p>
                      มีนักศึกษาที่ยังไม่ส่ง Proposal {missingProposalProjects.length} รายการ ใช้หน้าเฉพาะเพื่อค้นหา กรองสถานะ และเปิดส่งย้อนหลังรายกรณีอย่างปลอดภัย
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="rounded-md border border-amber-200 bg-surface p-2">
                        <div className="text-lg font-semibold text-amber-900">{missingProposalProjects.length}</div>
                        <div className="text-xs text-muted">ยังไม่ส่ง Proposal</div>
                      </div>
                      <div className="rounded-md border border-amber-200 bg-surface p-2">
                        <div className="text-lg font-semibold text-amber-900">
                          {missingProposalProjects.filter((project) => project.roundExceptions.length > 0).length}
                        </div>
                        <div className="text-xs text-muted">เปิดส่งย้อนหลังแล้ว</div>
                      </div>
                      <div className="rounded-md border border-amber-200 bg-surface p-2">
                        <div className="text-lg font-semibold text-amber-900">10%</div>
                        <div className="text-xs text-muted">หักคะแนนเริ่มต้นถ้าไม่ใช่เหตุสุดวิสัย</div>
                      </div>
                    </div>
                    <a className="button-secondary" href="/admin/round-exceptions?round_type=PROPOSAL">
                      จัดการผู้ส่งย้อนหลัง
                    </a>
                  </div>
                </WarningAlert>
              ) : null}

              <div className="mt-4 space-y-3">
                <div className="rounded-md border border-line bg-paper p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">การเปิดรอบ</div>
                      <p className="mt-1 text-xs text-muted">เปิดได้เฉพาะเมื่อผ่านเงื่อนไขลำดับรอบและความพร้อมที่ระบบคำนวณไว้แล้ว</p>
                    </div>
                    <AdminQueueBadge tone={openGate.canOpen || canScheduledZeroReadyOpen ? "action" : "locked"}>
                      {openGate.canOpen ? "เปิดได้" : canScheduledZeroReadyOpen ? "เปิดตามกำหนดการได้" : "ยังเปิดไม่ได้"}
                    </AdminQueueBadge>
                  </div>
                  {openGate.canOpen ? (
                    <AdminRoundActionForm action={openCourseRound} className="mt-3">
                      <input type="hidden" name="course_offering_id" value={offering.id} />
                      <input type="hidden" name="round_type" value={roundType} />
                      <input type="hidden" name="open_mode" value="NORMAL" />
                      <SubmitButton pendingText="กำลังเปิดรอบ...">เปิดรอบ</SubmitButton>
                    </AdminRoundActionForm>
                  ) : canScheduledZeroReadyOpen ? (
                    <AdminRoundActionForm action={openCourseRound} className="mt-3 space-y-3">
                      <input type="hidden" name="course_offering_id" value={offering.id} />
                      <input type="hidden" name="round_type" value="PROGRESS_1" />
                      <input type="hidden" name="open_mode" value="SCHEDULED_ZERO_READY" />
                      <WarningAlert title="ขณะนี้ยังไม่มีโครงงานพร้อมเข้าสู่รอบ">
                        การเปิดตามกำหนดการจะเปิดเฉพาะรอบระดับรายวิชา โครงงานที่ยังไม่ผ่าน Proposal หรือยังแต่งตั้งกรรมการไม่ครบจะยังส่งหลักฐานและเสนอวันสอบไม่ได้
                      </WarningAlert>
                      <label className="block text-sm font-medium" htmlFor="progress1-zero-ready-reason">
                        เหตุผลการเปิดรอบตามกำหนดการ
                      </label>
                      <textarea
                        id="progress1-zero-ready-reason"
                        name="override_reason"
                        className="min-h-24 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
                        required
                        maxLength={500}
                        placeholder="เช่น เปิดรอบล่วงหน้าเพื่อให้นักศึกษาที่พร้อมภายหลังดำเนินการได้ตามปฏิทินรายวิชา"
                      />
                      <p className="text-xs text-muted">ไม่เกิน 500 ตัวอักษร และจะถูกเก็บใน Audit Log</p>
                      <SubmitButton
                        pendingText="กำลังเปิดรอบ..."
                        confirmMessage="ยืนยันเปิดรอบสอบความก้าวหน้าครั้งที่ 1 ขณะที่มีโครงงานพร้อม 0 โครงงานหรือไม่? โครงงานที่ยังไม่พร้อมจะยังส่งหลักฐานหรือนัดสอบไม่ได้"
                      >
                        เปิดรอบตามกำหนดการ
                      </SubmitButton>
                    </AdminRoundActionForm>
                  ) : (
                    <p className="mt-3 text-xs text-muted">{roundSequenceReasonLabelTh(openGate.reasonKey)}</p>
                  )}
                </div>
                {round ? (
                  <AdminDangerZone
                    title="การปิดหรือรีเซตรอบ"
                    description="ตรวจ bucket ด้านบนและรายการที่ต้องรับทราบก่อนกดปิดรอบ การรีเซตใช้เฉพาะรอบที่ยังไม่มีหลักฐานผูกอยู่"
                  >
                    <div className="flex flex-wrap gap-2">
                      <form action={closeCourseRound} className={requiresCloseAck ? "basis-full space-y-2" : ""}>
                        <input type="hidden" name="round_id" value={round.id} />
                        {requireProposalCloseAck ? (
                          <label className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                            <input className="mt-1" type="checkbox" name="acknowledge_missing_projects" value="yes" />
                            <span>
                              <span className="block font-semibold">ยืนยันก่อนปิดรอบ</span>
                              รับทราบรายชื่อนักศึกษาที่ยังไม่ส่ง Proposal แล้ว
                            </span>
                          </label>
                        ) : null}
                        {requireIncompleteCloseAck ? (
                          <label className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                            <input className="mt-1" type="checkbox" name="acknowledge_incomplete_projects" value="yes" />
                            <span>
                              <span className="block font-semibold">ยืนยันก่อนปิดรอบ</span>
                              รับทราบรายชื่อโครงงานที่พร้อมเข้าสู่รอบนี้แต่ยังดำเนินการไม่ครบแล้ว
                            </span>
                          </label>
                        ) : null}
                        <SubmitButton disabled={!isRoundOpen(round.status)} pendingText="กำลังปิดรอบ..." confirmMessage={`ยืนยันการปิดรอบ ${roundTypeLabelTh(roundType)} หรือไม่?`}>
                          ปิดรอบ
                        </SubmitButton>
                      </form>
                      {resetState.canReset ? (
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
                    </div>
                  </AdminDangerZone>
                ) : null}
                <a className="button-secondary" href="#not-ready">ดูสรุปกลุ่มที่ยังไม่พร้อม</a>
              </div>
            </section>
          );
        })}
      </div>

      <section id="not-ready" className="panel">
        <h2 className="text-lg font-semibold">ความพร้อมสำหรับรอบ {roundTypeLabelTh(readinessFocusRoundType)}</h2>
        <div className="mt-2 text-sm text-muted">
          ใช้ส่วนนี้เพื่อดูภาพรวมว่าโครงงานที่ยังไม่พร้อมติดเงื่อนไขใด ไม่ใช่รายชื่อที่ต้องรับทราบก่อนปิดรอบปัจจุบัน
        </div>
        <div className="mt-4 space-y-3">
          {readinessFocusEligibility.notReady.length ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-line bg-paper p-3 text-sm">
                  <div className="text-2xl font-semibold">{readinessFocusEligibility.eligible.length}</div>
                  <div className="text-muted">พร้อมเข้ารอบนี้</div>
                </div>
                <div className="rounded-md border border-line bg-paper p-3 text-sm">
                  <div className="text-2xl font-semibold">{readinessFocusEligibility.eligibleButIncomplete.length}</div>
                  <div className="text-muted">พร้อมแต่ยังไม่ครบ</div>
                </div>
                <div className="rounded-md border border-line bg-paper p-3 text-sm">
                  <div className="text-2xl font-semibold">{readinessFocusEligibility.notReady.length}</div>
                  <div className="text-muted">ยังไม่พร้อมรอบนี้</div>
                </div>
              </div>
              <div className="space-y-2">
                {readinessReasonGroups.map((group) => {
                  const action = readinessActionForReason(group.key);
                  return (
                    <div key={group.key} className="rounded-md border border-line bg-surface p-3 text-sm">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="font-semibold">{group.label}</div>
                          <div className="mt-1 text-muted">{group.count} รายการ</div>
                        </div>
                        {action ? <a className="button-secondary min-h-9 px-3 py-1.5 text-xs" href={action.href}>{action.label}</a> : null}
                      </div>
                      <ul className="mt-3 space-y-1 text-xs text-muted">
                        {group.samples.map((item) => (
                          <li key={`${group.key}-${item.project.id}`}>
                            {item.project.student?.studentCode} {item.project.student?.firstNameTh} {item.project.student?.lastNameTh}
                            {item.project.currentTitleTh ? ` - ${item.project.currentTitleTh}` : " - ยังไม่มีชื่อหัวข้อ"}
                          </li>
                        ))}
                      </ul>
                      {group.count > group.samples.length ? (
                        <div className="mt-2 text-xs text-muted">และรายการอื่นอีก {group.count - group.samples.length} รายการ</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <InfoAlert title="ทุกโครงงานที่เกี่ยวข้องพร้อมเข้าสู่รอบนี้" />
          )}
        </div>
      </section>
    </div>
  );
}
