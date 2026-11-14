import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { externalReportDigest, recordExternalEvidence, type ExternalEvidenceProject } from "./incompleteExternalEvidence";
import { workflowDigest } from "./workflowDigest";
function fixture() { return { id:"p",courseOfferingId:"old",status:"IN_PROGRESS",academicResult:{projectId:"p",version:1},committeeAssignments:[{id:"b",teacherId:"head",active:true},{id:"a",teacherId:"member",active:true}],advisorRequests:[],reportVersions:[{id:"r",driveLink:"https://drive.google.com/file/d/synthetic/view",reviews:[{id:"review",decision:"FAIL",comment:"original"}]}] } as unknown as ExternalEvidenceProject; }
describe("external report verification binds to actual document evidence",()=>{
  it("uses stable order and real date values",()=>{
    const project=fixture(),other=fixture();other.committeeAssignments.reverse();
    expect(externalReportDigest(project)).toBe(externalReportDigest(other));
    expect(workflowDigest({at:new Date("2026-11-14T00:00:00Z")})).not.toBe(workflowDigest({at:new Date("2026-11-15T00:00:00Z")}));
  });
  it("does not demand rechecking the same report merely because a numeric stage advances",()=>{
    const project=fixture(),other=fixture();other.status="FINAL_DONE";
    expect(externalReportDigest(project)).toBe(externalReportDigest(other));
  });
  it.each(["project","report","review","committee","result"])("invalidates changed %s evidence",kind=>{
    const original=fixture(),changed=fixture();
    if(kind==="project")changed.id="other";
    if(kind==="report")changed.reportVersions[0].driveLink="https://drive.google.com/file/d/different/view";
    if(kind==="review")changed.reportVersions[0].reviews[0].comment="new correction";
    if(kind==="committee")changed.committeeAssignments[0].active=false;
    if(kind==="result")changed.academicResult!.version++;
    expect(externalReportDigest(original)).not.toBe(externalReportDigest(changed));
  });
  it.each([[false,true],[true,false],[false,false]])("unchecked checklist %j/%j cannot start a write",async(reportAccepted,reportCorrectionsComplete)=>{
    const transaction=vi.fn();
    await expect(recordExternalEvidence({$transaction:transaction} as unknown as PrismaClient,{actorId:"admin",projectId:"p",expectedVersion:"a".repeat(64),requestId:"11111111-1111-1111-1111-111111111111",reportAccepted,reportCorrectionsComplete})).rejects.toThrow("ติ๊กให้ครบ");
    expect(transaction).not.toHaveBeenCalled();
  });
});
