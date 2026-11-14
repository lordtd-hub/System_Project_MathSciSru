import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { loadExternalEvidence, recordExternalEvidence, EXTERNAL_I_EVIDENCE_TYPE } from "../src/lib/terms/incompleteExternalEvidence";
import { getCompletionEligibilityFromDb } from "../src/lib/lifecycle/completionEligibility";
import { completeProjectAtomic } from "../src/lib/lifecycle/completeProject";
import { resolveIncomplete } from "../src/lib/terms/incomplete";
import { loadAdminPresentationTarget, recordAdminPresentationScore, loadAdminAdvisorTarget, recordAdminAdvisorScore } from "../src/lib/scoring/adminClosedIScore";

function check(value: unknown, message: string): asserts value { if (!value) throw Error(message); }
async function rejects(operation: () => Promise<unknown>, message: string) { let denied=false;try{await operation();}catch{denied=true;}check(denied,message); }
type Scenario = { adminId: string; oldOfferingId: string; newOfferingId: string; teacherIds: Array<{ id: string; userId: string | null; role: string }>; studentUserId: string };
export async function runAdminIChecklistCases(db: PrismaClient, scenario: Scenario, pass: (value: string) => void) {
  const { adminId, teacherIds: teachers } = scenario;
  const head = teachers.find(t=>t.role === "HEAD")!, member = teachers.find(t=>t.role === "MEMBER")!, advisor = teachers.find(t=>t.role === "ADVISOR")!;
  const rounds = await db.assessmentRound.findMany({ where: { courseOfferingId: scenario.oldOfferingId } });
  const round = (type: string) => rounds.find(r=>r.roundType === type)!;
  await db.rubric.upsert({ where: { roundType_version: { roundType: "PROGRESS_1", version: 1 } }, update: {}, create: { roundType: "PROGRESS_1", version: 1, name: "Synthetic checklist rubric", items: { create: [
    { groupKey:"s",groupLabelTh:"Synthetic",itemKey:"synthetic-a",itemLabelTh:"Synthetic criterion A",points:40,displayOrder:1 },
    { groupKey:"s",groupLabelTh:"Synthetic",itemKey:"synthetic-b",itemLabelTh:"Synthetic criterion B",points:60,displayOrder:2 }
  ] } } });
  async function fixture(code: string) {
    const student=await db.student.create({data:{studentCode:code,firstNameTh:"Synthetic",lastNameTh:"Checklist "+code,generatedEmail:code+"@student.sru.ac.th"}});
    const project=await db.project.create({data:{studentId:student.id,courseOfferingId:scenario.oldOfferingId,status:"IN_PROGRESS",currentTitleTh:"Synthetic external-document I "+code,
      academicResult:{create:{originalGrade:"I",reason:"Synthetic original I reason",reference:"Synthetic original I reference"}}}});
    for(const teacher of teachers)await db.committeeAssignment.create({data:{projectId:project.id,teacherId:teacher.id,role:teacher.role as "ADVISOR"|"HEAD"|"MEMBER",appointedByUserId:adminId}});
    return {project,student};
  }
  const {project,student}=await fixture("9900000000003");
  const evidenceInput = async (projectId=project.id) => ({actorId:adminId,projectId,expectedVersion:(await loadExternalEvidence(db,projectId)).version,requestId:randomUUID(),reportAccepted:true,reportCorrectionsComplete:true});
  const snapshot=async()=>JSON.stringify({project:await db.project.findUnique({where:{id:project.id},include:{academicResult:true,timelineEvents:{orderBy:{id:"asc"}}}}),audit:await db.auditLog.findMany({where:{entityType:EXTERNAL_I_EVIDENCE_TYPE,entityId:project.id},orderBy:{id:"asc"}})});
  const initial=await evidenceInput();
  await rejects(()=>recordExternalEvidence(db,{...initial,reportAccepted:false}),"unchecked report denied");
  await rejects(()=>recordExternalEvidence(db,{...initial,reportCorrectionsComplete:false}),"unchecked corrections denied");
  await rejects(()=>recordExternalEvidence(db,{...initial,actorId:head.userId!}),"teacher certification denied");
  await rejects(()=>recordExternalEvidence(db,{...initial,actorId:scenario.studentUserId}),"student certification denied");
  const activeProject=await db.project.findFirstOrThrow({where:{courseOfferingId:scenario.newOfferingId}});
  await rejects(()=>recordExternalEvidence(db,{...initial,projectId:activeProject.id}),"ACTIVE course attestation denied");
  for(const point of ["after_attestation","after_timeline"]){const before=await snapshot();await rejects(()=>recordExternalEvidence(db,{...initial,requestId:randomUUID()},{fault:at=>{if(at===point)throw Error("Synthetic evidence rollback");}}),"fault rejects");check(await snapshot()===before,"evidence and timeline roll back together");}
  await rejects(()=>loadAdminAdvisorTarget(db,{actorUserId:adminId,projectId:project.id,evaluatorTeacherId:advisor.id}),"no report or external check cannot enter advisor score");
  let eligibility=await getCompletionEligibilityFromDb(db,project.id);
  check(!eligibility.eligible && !eligibility.hasProgress1Score && !eligibility.hasReachedReportApproved,"checklist cannot replace absent marks/report");
  await rejects(()=>completeProjectAtomic(db,{actorId:adminId,projectId:project.id,expectedVersion:eligibility.workflowVersion!,requestId:randomUUID()}),"unchecked missing evidence closeout denied");
  const concurrentInputs=[initial,{...initial,requestId:randomUUID()}];
  const concurrent=await Promise.allSettled(concurrentInputs.map(input=>recordExternalEvidence(db,input)));
  check(concurrent.filter(r=>r.status==="fulfilled").length===1,"one concurrent attestation version winner");
  const winning=concurrentInputs[concurrent.findIndex(r=>r.status==="fulfilled")];
  check((await recordExternalEvidence(db,winning)).unchanged,"attestation replay does not duplicate");
  check(await db.auditLog.count({where:{entityType:EXTERNAL_I_EVIDENCE_TYPE,entityId:project.id}})===1,"one verification audit");
  check(await db.reportVersion.count({where:{projectId:project.id}})===0 && await db.reportReview.count({where:{reportVersion:{projectId:project.id}}})===0,"external check creates no report or teacher review");
  check((await db.project.findUniqueOrThrow({where:{id:project.id}})).status==="IN_PROGRESS","checklist does not manufacture a project state");
  pass("external checklist: required checks/ADMIN/scope, concurrent CAS/replay, two fault rollbacks; separate admin evidence creates no ReportVersion, PASS or stage transition");

  const changed=await fixture("9900000000004");
  const report=await db.reportVersion.create({data:{projectId:changed.project.id,submittedByStudentId:changed.student.id,versionNo:1,driveLink:"https://drive.google.com/file/d/synthetic-current-review/view"}});
  const review=await db.reportReview.create({data:{reportVersionId:report.id,reviewerTeacherId:head.id,decision:"FAIL",comment:"Synthetic previously pending correction"}});
  await recordExternalEvidence(db,await evidenceInput(changed.project.id));
  check((await getCompletionEligibilityFromDb(db,changed.project.id)).hasReachedReportApproved,"admin external confirmation can represent real externally completed report corrections");
  check((await db.reportReview.findUniqueOrThrow({where:{id:review.id}})).decision==="FAIL","external evidence never rewrites a teacher review");
  const beforeChange=(await loadExternalEvidence(db,changed.project.id)).version;
  await db.reportReview.update({where:{id:review.id},data:{comment:"Synthetic new correction after verification"}});
  check(!(await loadExternalEvidence(db,changed.project.id)).valid,"new report evidence invalidates earlier verification");
  await rejects(async()=>recordExternalEvidence(db,{...(await evidenceInput(changed.project.id)),expectedVersion:beforeChange}),"stale report checkbox form denied");
  check((await getCompletionEligibilityFromDb(db,changed.project.id)).hasUnresolvedReportRevision,"new FAIL cannot be silently bypassed");
  pass("existing FAIL remains unchanged; current external confirmation is distinct evidence; later report/reviewer changes invalidate it and reject stale forms");

  const scoreInput=async(projectId:string,teacherId:string,roundType:string,points=[40,60])=>{
    const target=await loadAdminPresentationTarget(db,{actorUserId:adminId,projectId,evaluatorTeacherId:teacherId,assessmentRoundId:round(roundType).id});
    return {actorUserId:adminId,projectId,evaluatorTeacherId:teacherId,assessmentRoundId:round(roundType).id,requestId:randomUUID(),expectedVersion:target.version,items:target.rubric.items.map((i,index)=>({id:i.id,points:points[index]})),comment:null};
  };
  // An old aggregate or one submitted committee member is not a complete closed-I assessment.
  await db.assessmentAttempt.create({data:{projectId:project.id,assessmentRoundId:round("PROGRESS_1").id,attemptNo:1,attemptType:"PROGRESS_1",officialScore:100,status:"SCORING_CLOSED"}});
  check(!(await getCompletionEligibilityFromDb(db,project.id)).hasProgress1Score,"aggregate alone does not replace actual committee marks");
  const advisorTarget=await loadAdminAdvisorTarget(db,{actorUserId:adminId,projectId:project.id,evaluatorTeacherId:advisor.id});
  await recordAdminAdvisorScore(db,{actorUserId:adminId,projectId:project.id,evaluatorTeacherId:advisor.id,requestId:randomUUID(),expectedVersion:advisorTarget.version,
    marks:{responsibility:25,researchProcess:25,problemSolving:25,communication:15,professionalism:10},comment:null});
  check((await db.project.findUniqueOrThrow({where:{id:project.id}})).status==="IN_PROGRESS","advisor mark with external report does not invent REPORT_APPROVED");
  for(const type of ["PROGRESS_1","PROGRESS_2","FINAL_PRESENTATION"]){
    await recordAdminPresentationScore(db,await scoreInput(project.id,head.id,type));
    const partial=await getCompletionEligibilityFromDb(db,project.id);
    const field=type==="PROGRESS_1"?"hasProgress1Score":type==="PROGRESS_2"?"hasProgress2Score":"hasFinalPresentationScore";
    check(!partial[field],"one committee member is insufficient for "+type);
    await recordAdminPresentationScore(db,await scoreInput(project.id,member.id,type));
    check((await getCompletionEligibilityFromDb(db,project.id))[field],"both committee numeric scores complete "+type);
  }
  check((await loadExternalEvidence(db,project.id)).valid,"entering real numeric marks does not force duplicate report attestation");
  eligibility=await getCompletionEligibilityFromDb(db,project.id);
  check(eligibility.eligible,"real scores plus distinct external report evidence can close without report record");
  const staleClose={actorId:adminId,projectId:project.id,expectedVersion:eligibility.workflowVersion!,requestId:randomUUID()};
  await recordAdminPresentationScore(db,await scoreInput(project.id,head.id,"PROGRESS_2",[0,60]));
  await rejects(()=>completeProjectAtomic(db,staleClose),"score revision invalidates old closeout tab");
  eligibility=await getCompletionEligibilityFromDb(db,project.id);
  check(eligibility.eligible,"actual revised complete scores remain eligible after re-reading");
  const close={...staleClose,requestId:randomUUID(),expectedVersion:eligibility.workflowVersion!};
  const beforeFault=await snapshot();
  await rejects(()=>completeProjectAtomic(db,close,{fault:point=>{if(point==="after_audit")throw Error("Synthetic closeout rollback");}}),"failed closeout rolls back");
  check(await snapshot()===beforeFault,"project/result/timeline unchanged after failed closeout");
  const closing=[close,{...close,requestId:randomUUID()}];
  const closed=await Promise.allSettled(closing.map(value=>completeProjectAtomic(db,value)));
  check(closed.filter(r=>r.status==="fulfilled").length===1,"one concurrent closeout winner");
  check((await completeProjectAtomic(db,closing[closed.findIndex(r=>r.status==="fulfilled")])).unchanged,"closeout replay");
  check((await db.project.findUniqueOrThrow({where:{id:project.id}})).status==="COMPLETED","manual closeout reaches COMPLETED from actual evidence");
  check(await db.projectStatusHistory.count({where:{projectId:project.id,toStatus:"REPORT_APPROVED"}})===0,"no fake report-approved transition");
  pass("closed-I completion requires both actual committee marks per latest round plus complete advisor criteria; no aggregate/one-member bypass; score-edit CAS, atomic rollback and one concurrent closeout winner without fake report state");

  const completedEligibility=await getCompletionEligibilityFromDb(db,project.id,{allowCompleted:true});
  const resolve={actorId:adminId,projectId:project.id,expectedVersion:1,grade:"B+",useExternalEvidence:true,expectedWorkflowVersion:completedEligibility.workflowVersion!};
  const withdrawal=await evidenceInput();await recordExternalEvidence(db,{...withdrawal,revoke:true,reportAccepted:false,reportCorrectionsComplete:false});
  await rejects(()=>resolveIncomplete(db,resolve),"withdrawn verification cannot resolve I");
  await recordExternalEvidence(db,await evidenceInput());
  await rejects(()=>resolveIncomplete(db,resolve),"new verification requires refreshed result tab");
  const finalResolve={...resolve,expectedWorkflowVersion:(await getCompletionEligibilityFromDb(db,project.id,{allowCompleted:true})).workflowVersion!};
  await rejects(()=>resolveIncomplete(db,{...finalResolve,actorId:head.userId!}),"teacher cannot resolve");
  const resolved=await Promise.all([resolveIncomplete(db,finalResolve),resolveIncomplete(db,finalResolve),resolveIncomplete(db,finalResolve)]);
  check(resolved.filter(r=>!r.unchanged).length===1,"resolution writes once");
  const result=await db.projectAcademicResult.findUniqueOrThrow({where:{projectId:project.id}});
  check(result.status==="RESOLVED"&&result.version===2&&result.originalGrade==="I"&&result.reference==="Synthetic original I reference"&&result.reason==="Synthetic original I reason"&&result.resolutionGrade==="B+","original I retained, actual explicitly selected grade recorded");
  check(result.resolutionReference?.startsWith("ADMIN_EXTERNAL_EVIDENCE:"),"reference is server-derived from actual verification audit");
  check(await db.reportVersion.count({where:{projectId:project.id}})===0&&await db.reportReview.count({where:{reportVersion:{projectId:project.id}}})===0,"full workflow ends without fake report or reviews");
  pass("full no-report-record I path: actual checklist + all real marks -> manual COMPLETED -> explicit selected grade RESOLVED; no text/file reference inputs; withdrawal/stale/role/replay guarded; original I/history retained");

  // Regression for the unchanged open-course policy through the refactored atomic closeout entry point.
  const normalStudent=await db.student.create({data:{studentCode:"9800000000010",firstNameTh:"Synthetic",lastNameTh:"Active closeout",generatedEmail:"9800000000010@student.sru.ac.th"}});
  const normal=await db.project.create({data:{studentId:normalStudent.id,courseOfferingId:scenario.newOfferingId,status:"ADVISOR_SCORING"}});
  const activeRounds=await db.assessmentRound.findMany({where:{courseOfferingId:scenario.newOfferingId}});
  for(const type of ["PROGRESS_1","PROGRESS_2","FINAL_PRESENTATION"] as const)await db.assessmentAttempt.create({data:{projectId:normal.id,assessmentRoundId:activeRounds.find(r=>r.roundType===type)!.id,attemptNo:1,attemptType:type,officialScore:80,status:"SCORING_CLOSED"}});
  await db.advisorScore.create({data:{projectId:normal.id,advisorTeacherId:advisor.id,status:"SUBMITTED",score:100,responsibilityScore:25,researchProcessScore:25,problemSolvingScore:25,communicationScore:15,professionalismScore:10}});
  const normalEligibility=await getCompletionEligibilityFromDb(db,normal.id);
  check(normalEligibility.eligible&&!normalEligibility.closedIncomplete,"open-course eligibility policy remains unchanged");
  await completeProjectAtomic(db,{actorId:adminId,projectId:normal.id,expectedVersion:normalEligibility.workflowVersion!,requestId:randomUUID()});
  check((await db.project.findUniqueOrThrow({where:{id:normal.id}})).status==="COMPLETED"&&await db.projectAcademicResult.count({where:{projectId:normal.id}})===0,"active course closes through atomic action without creating I or external evidence");
  pass("normal ACTIVE course retains existing eligibility semantics through atomic closeout; no I/result/external-evidence mutation");

  // Fresh browser fixture: old P1/P2 scores are real synthetic service writes; Final/advisor/checklist remain for UI.
  const ui=await fixture("9900000000005");
  for(const type of ["PROGRESS_1","PROGRESS_2"])for(const teacher of [head,member])await recordAdminPresentationScore(db,await scoreInput(ui.project.id,teacher.id,type));
  return {checklistUiProjectId:ui.project.id,checklistUiStudentCode:ui.student.studentCode,checklistHeadId:head.id,checklistMemberId:member.id,checklistAdvisorId:advisor.id,checklistFinalRoundId:round("FINAL_PRESENTATION").id};
}
