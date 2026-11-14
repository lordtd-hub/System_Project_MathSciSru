import Link from "next/link";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { CourseContextBadge } from "@/components/ui/CourseContextBadge";
import { AcademicResultActionForm } from "@/components/ui/AcademicResultActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { teacherDisplayName } from "@/lib/teachers/displayName";
import { AdminIScoreError, allowedAdminRubricPoints, loadAdminAdvisorTarget, loadAdminPresentationTarget } from "@/lib/scoring/adminClosedIScore";
import { advisorCriteria } from "@/lib/scoring/advisorScoring";
import { recordIncompleteScore, verifyIncompleteDocuments, closeIncompleteProject, resolveVerifiedIncomplete } from "./actions";
import { loadExternalEvidence } from "@/lib/terms/incompleteExternalEvidence";
import { getCompletionEligibilityFromDb } from "@/lib/lifecycle/completionEligibility";
import { formatThaiDateTime24 } from "@/lib/format/dateTime";

export default async function AdminIScoreEntryPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await auth();
  const actor = session?.user.id ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, active: true, globalRole: true } }) : null;
  if (!actor?.active || actor.globalRole !== "ADMIN") return <p>หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>;
  const query = (await searchParams) ?? {};
  const value = (key: string) => String(Array.isArray(query[key]) ? query[key][0] : query[key] ?? "").slice(0, 100);
  const projectId = value("project_id"), roundId = value("round_id"), evaluatorId = value("evaluator_id"), advisorMode = value("mode") === "ADVISOR";
  const projects = await prisma.project.findMany({ where: { courseOffering: { status: "CLOSED" }, OR: [{ academicResult: { status: "INCOMPLETE" } }, { id: projectId, academicResult: { status: "RESOLVED" } }] },
    include: { academicResult: true, student: true, courseOffering: { include: { term: true, assessmentRounds: true } }, committeeAssignments: { include: { teacher: true } }, advisorRequests: { include: { advisorTeacher: true } } },
    orderBy: [{ courseOffering: { term: { academicYear: { yearBe: "desc" } } } }, { student: { studentCode: "asc" } }] });
  const project = projects.find(p => p.id === projectId);
  const unresolved = project?.academicResult?.status === "INCOMPLETE";
  const evidence = project && unresolved ? await loadExternalEvidence(prisma, project.id) : null;
  const eligibility = project && unresolved ? await getCompletionEligibilityFromDb(prisma, project.id, { allowCompleted: project.status === "COMPLETED" }) : null;
  const evaluators = project ? [...new Map([
    ...project.committeeAssignments.filter(a => a.active && (advisorMode ? a.role === "ADVISOR" : ["HEAD", "MEMBER"].includes(a.role))).map(a => [a.teacherId, a.teacher] as const),
    ...(advisorMode ? project.advisorRequests.filter(a => a.status === "APPROVED").map(a => [a.advisorTeacherId, a.advisorTeacher] as const) : [])
  ]).values()].filter(t => t.active) : [];
  let target: Awaited<ReturnType<typeof loadAdminPresentationTarget>> | null = null;
  let advisorTarget: Awaited<ReturnType<typeof loadAdminAdvisorTarget>> | null = null;
  let targetError = "";
  if (project && unresolved && project.status !== "COMPLETED" && evaluatorId && (advisorMode || roundId)) {
    try {
      const base = { actorUserId: actor.id, projectId: project.id, evaluatorTeacherId: evaluatorId };
      if (advisorMode) advisorTarget = await loadAdminAdvisorTarget(prisma, base);
      else target = await loadAdminPresentationTarget(prisma, { ...base, assessmentRoundId: roundId });
    } catch (error) { targetError = error instanceof AdminIScoreError ? error.message : "ยังเปิดแบบบันทึกไม่ได้"; }
  }
  const version = target?.version ?? advisorTarget?.version;
  const previousAdvisor = advisorTarget?.previous;
  const advisorValues = previousAdvisor ? { responsibility: previousAdvisor.responsibilityScore, researchProcess: previousAdvisor.researchProcessScore, problemSolving: previousAdvisor.problemSolvingScore, communication: previousAdvisor.communicationScore, professionalism: previousAdvisor.professionalismScore } : null;
  return <div className="space-y-5">
    <PageHeader title="สะสาง I" description="ตรวจเอกสารจริง บันทึกคะแนน แล้วจึงยืนยันจบและบันทึกผลที่ได้รับการยืนยัน — ไม่ส่ง REG อัตโนมัติ" />
    <form method="get" className="panel flex flex-wrap items-end gap-3">
      <label className="min-w-64 flex-1">เลือกงาน I<select name="project_id" defaultValue={projectId} required><option value="">เลือกนักศึกษา / รายวิชา</option>{projects.map(p => <option value={p.id} key={p.id}>{p.courseOffering.term.displayName} · {p.courseOffering.courseCode} {p.courseOffering.section} · {p.student.studentCode} {p.student.firstNameTh} {p.student.lastNameTh}{p.academicResult?.status === "RESOLVED" ? " · สะสางแล้ว" : ""}</option>)}</select></label>
      <button className="button-primary">เปิดงาน I</button>
    </form>
    {!projects.length ? <p className="panel">ไม่มีงาน I ที่รอสะสางในรายวิชาปิด</p> : null}
    {project ? <section className="space-y-3">
      <CourseContextBadge offering={project.courseOffering} label="รายวิชาของงานที่กำลังจัดการ" />
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}</h2><p className="text-sm text-muted">{project.currentTitleTh ?? "ยังไม่ระบุชื่อโครงงาน"}</p></div><Link className="button-secondary" href={`/projects/${project.id}`}>ดูแฟ้มโครงงาน</Link></div>
    </section> : projectId ? <p role="alert">ไม่พบงาน I ของรายวิชาปิดตามรายการนี้</p> : null}
    {project?.academicResult?.status === "RESOLVED" ? <section className="panel app-alert alert-success"><h2 className="font-semibold">สะสาง I แล้ว — ผลที่ยืนยัน: {project.academicResult.resolutionGrade}</h2><p>เก็บผล I และคะแนนเดิมไว้ในประวัติ การบันทึกนี้ไม่ได้ส่งหรือแก้ REG</p></section> : null}
    {project && evidence && eligibility ? <>
      <section className="panel space-y-3">
        <h2 className="text-lg font-semibold">1. ตรวจหลักฐานจริง</h2>
        <p className="text-sm text-muted">ยืนยันผลจากเอกสารจริงที่ตรวจแล้ว โดยไม่ต้องแนบไฟล์หรือกรอกอ้างอิงซ้ำ ระบบบันทึกผู้ดูแลระบบเป็นผู้รับรอง ไม่ใช่ผู้ประเมินแทนอาจารย์</p>
        {evidence.valid ? <>
          <p className="app-alert alert-success">ตรวจรับรองแล้วโดย {evidence.latest!.actor?.name ?? "ผู้ดูแลระบบ"} · {formatThaiDateTime24(evidence.latest!.occurredAt)}</p>
          <details><summary className="cursor-pointer text-sm text-muted">แก้ไขการรับรอง</summary><AcademicResultActionForm action={verifyIncompleteDocuments} className="mt-3">
            <input type="hidden" name="project_id" value={project.id} /><input type="hidden" name="version" value={evidence.version} /><input type="hidden" name="request_id" value={randomUUID()} /><input type="hidden" name="revoke" value="1" />
            <SubmitButton className="button-secondary" pendingText="กำลังถอน...">ถอนการรับรองเพื่อกลับไปตรวจใหม่</SubmitButton>
          </AcademicResultActionForm></details>
        </> : <AcademicResultActionForm action={verifyIncompleteDocuments} className="space-y-3">
          {evidence.latest ? <p className="app-alert alert-warning">การรับรองเดิมถูกถอน หรือข้อมูลรายงาน/ผู้เกี่ยวข้องเปลี่ยน กรุณาตรวจฉบับปัจจุบันใหม่</p> : null}
          <input type="hidden" name="project_id" value={project.id} /><input type="hidden" name="version" value={evidence.version} /><input type="hidden" name="request_id" value={randomUUID()} />
          <label className="flex items-start gap-3"><input type="checkbox" name="report_accepted" required className="mt-1 h-5 w-5" /><span>ตรวจรายงานฉบับสมบูรณ์และผลรับรองจากเอกสารจริงแล้ว</span></label>
          <label className="flex items-start gap-3"><input type="checkbox" name="corrections_complete" required className="mt-1 h-5 w-5" /><span>ตรวจแล้วว่าข้อแก้ไขรายงานได้รับการสะสางครบ ไม่มีงานแก้ค้าง</span></label>
          <SubmitButton pendingText="กำลังบันทึก...">บันทึกการตรวจหลักฐาน</SubmitButton>
        </AcademicResultActionForm>}
      </section>
      <section className="panel space-y-3">
        <h2 className="text-lg font-semibold">2. ตรวจคะแนนจริง</h2>
        <div className="grid gap-2 sm:grid-cols-2">{[["ความก้าวหน้าครั้งที่ 1",eligibility.hasProgress1Score],["ความก้าวหน้าครั้งที่ 2",eligibility.hasProgress2Score],["นำเสนอขั้นสุดท้าย",eligibility.hasFinalPresentationScore],["อาจารย์ที่ปรึกษา",eligibility.hasAdvisorScore]].map(([label,done])=><p key={String(label)} className="rounded border border-line px-3 py-2 text-sm"><span className="font-medium">{label}</span> · {done ? "ครบแล้ว" : "ยังไม่ครบ"}</p>)}</div>
        <p className="text-sm text-muted">การยืนยันเอกสารไม่แทนคะแนนที่ยังขาด ต้องมีคะแนนจริงของกรรมการแต่ละคนและที่ปรึกษา โดยใช้เกณฑ์และการหักคะแนนเดิม</p>
        {project.status !== "COMPLETED" ? <details open={!!version} className="border-t border-line pt-3"><summary className="cursor-pointer font-medium">บันทึก / แก้คะแนนจริง</summary>
          <div className="mt-3 flex flex-wrap gap-2"><Link className={advisorMode ? "button-secondary" : "button-primary"} href={`/admin/i-score-entry?project_id=${project.id}&mode=PRESENTATION`}>คะแนนนำเสนอ</Link><Link className={advisorMode ? "button-primary" : "button-secondary"} href={`/admin/i-score-entry?project_id=${project.id}&mode=ADVISOR`}>คะแนนที่ปรึกษา</Link></div>
          <form method="get" className="mt-3 grid items-end gap-3 md:grid-cols-3">
            <input type="hidden" name="project_id" value={project.id} /><input type="hidden" name="mode" value={advisorMode ? "ADVISOR" : "PRESENTATION"} />
            {!advisorMode ? <label>รอบสอบ<select name="round_id" defaultValue={roundId} required><option value="">เลือกรอบสอบ</option>{project.courseOffering.assessmentRounds.filter(r=>["PROGRESS_1","PROGRESS_2","FINAL_PRESENTATION"].includes(r.roundType)).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label> : null}
            <label>ผู้ประเมินจริง<select name="evaluator_id" defaultValue={evaluatorId} required><option value="">เลือกผู้ประเมินที่แต่งตั้ง</option>{evaluators.map(t=><option key={t.id} value={t.id}>{teacherDisplayName(t)}</option>)}</select></label><button className="button-secondary">เปิดแบบบันทึกคะแนน</button>
          </form>
          {targetError ? <p className="app-alert alert-warning mt-3" role="alert">{targetError}</p> : null}
          {project && version ? <AcademicResultActionForm action={recordIncompleteScore} className="panel space-y-4">
      <fieldset key={version} className="contents">
      <p className="text-sm text-muted">บันทึกให้ {project.student.studentCode} · {project.courseOffering.courseCode} {project.courseOffering.section} · {project.courseOffering.term.displayName}</p>
      <h2 className="font-semibold">{teacherDisplayName((target ?? advisorTarget)!.evaluator)} · {target?.round.name ?? "คะแนนอาจารย์ที่ปรึกษา"}</h2>
      <input type="hidden" name="project_id" value={project.id} /><input type="hidden" name="mode" value={advisorMode ? "ADVISOR" : "PRESENTATION"} />
      <input type="hidden" name="round_id" value={target?.round.id ?? ""} /><input type="hidden" name="evaluator_id" value={(target ?? advisorTarget)!.evaluator.id} />
      <input type="hidden" name="version" value={version} /><input type="hidden" name="request_id" value={randomUUID()} />
      {target ? target.rubric.items.map(item => {
        const previous = target!.previous?.scoreItems.find(i => i.rubricItemId === item.id);
        const choices = allowedAdminRubricPoints(target!.round.roundType, item);
        return <label key={item.id} className="block">{item.itemLabelTh} (เต็ม {item.points})<input type="hidden" name="item_id" value={item.id} />
          {choices ? <select name={`mark_${item.id}`} required defaultValue={previous ? String(previous.pointsAwarded) : ""}><option value="" disabled>เลือกคะแนนที่ได้รับการยืนยัน</option>{choices.map(points => <option key={points} value={points}>{points}</option>)}</select>
            : <input type="number" name={`mark_${item.id}`} min={0} max={item.points} step={1} required defaultValue={previous ? Number(previous.pointsAwarded) : undefined} />}</label>;
      }) : advisorCriteria.map(criterion => <label key={criterion.key} className="block">{criterion.label} (เต็ม {criterion.max})<input type="number" name={`mark_${criterion.key}`} min={0} max={criterion.max} step={1} required defaultValue={advisorValues?.[criterion.key] ?? undefined} /></label>)}
      <label className="block">หมายเหตุ (ถ้ามี)<textarea name="comment" maxLength={2000} defaultValue={target?.previous?.overallComment ?? previousAdvisor?.comment ?? ""} /></label>
      <SubmitButton pendingText="กำลังบันทึกคะแนน...">บันทึกคะแนนตามผลที่ยืนยันแล้ว</SubmitButton>
      </fieldset>
    </AcademicResultActionForm> : null}
        </details> : <p className="text-sm">โครงงานยืนยันจบแล้ว คะแนนในหน้านี้อ่านได้อย่างเดียว</p>}
      </section>
      <section className="panel space-y-3">
        <h2 className="text-lg font-semibold">3. ยืนยันจบและบันทึกผลแก้ I</h2>
        {project.status !== "COMPLETED" ? eligibility.eligible ? <AcademicResultActionForm action={closeIncompleteProject}>
          <input type="hidden" name="project_id" value={project.id} /><input type="hidden" name="workflow_version" value={eligibility.workflowVersion} /><input type="hidden" name="request_id" value={randomUUID()} />
          <p className="mb-3">คะแนนและหลักฐานครบแล้ว ผู้ดูแลระบบเป็นผู้ยืนยันจบโครงงาน</p><SubmitButton pendingText="กำลังยืนยัน...">ยืนยันจบโครงงาน</SubmitButton>
        </AcademicResultActionForm> : <><p className="font-medium">ยังยืนยันจบไม่ได้</p><ul className="list-disc space-y-1 pl-5 text-sm">{eligibility.missingRequirements.map(item=><li key={item}>{item}</li>)}</ul></>
        : evidence.valid && eligibility.eligible ? <AcademicResultActionForm action={resolveVerifiedIncomplete} className="space-y-3">
          <p className="app-alert alert-success">ยืนยันจบโครงงานแล้ว เหลือบันทึกผลที่ผู้มีอำนาจยืนยัน</p>
          <input type="hidden" name="project_id" value={project.id} /><input type="hidden" name="result_version" value={project.academicResult!.version} /><input type="hidden" name="workflow_version" value={eligibility.workflowVersion} />
          <label>ผลที่ยืนยันแล้ว<select name="grade" required defaultValue=""><option value="" disabled>เลือกผลที่ได้รับการยืนยันแล้ว</option>{["A","B+","B","C+","C","D+","D","E","S","U"].map(grade=><option key={grade}>{grade}</option>)}</select></label>
          <SubmitButton pendingText="กำลังบันทึก...">บันทึกผลแก้ I</SubmitButton><p className="text-sm text-muted">ระบบเก็บผู้บันทึก เวลา และการรับรองเดิมให้อัตโนมัติ ไม่คำนวณเกรดหรือส่ง REG</p>
        </AcademicResultActionForm> : <p className="app-alert alert-warning">ตรวจการรับรองเอกสารและคะแนนปัจจุบันให้ครบก่อนบันทึกผลแก้ I</p>}
      </section>
    </> : null}
  </div>;
}
