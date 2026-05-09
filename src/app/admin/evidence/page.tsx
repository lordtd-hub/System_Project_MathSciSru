import { auth } from "@/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfoAlert, WarningAlert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";
import { CompactMetricRow, DashboardSectionHeader } from "@/components/ui/DashboardActionQueue";
import { getEvidenceDashboardData } from "@/lib/evidence/adminEvidence";

function percent(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function exportHref(kind: string, courseOfferingId?: string) {
  const query = courseOfferingId && kind !== "audit" ? `?course_offering_id=${encodeURIComponent(courseOfferingId)}` : "";
  return `/admin/evidence/exports/${kind}${query}`;
}

export default async function AdminEvidencePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return <div className="panel">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</div>;

  const params = (await searchParams) ?? {};
  const selectedParam = Array.isArray(params.course_offering_id) ? params.course_offering_id[0] : params.course_offering_id;
  const data = await getEvidenceDashboardData(selectedParam);
  const totalProjects = data.projectRows.length;
  const completedProjects = data.projectRows.filter((row) => row.completed).length;
  const missingEvidenceProjects = data.projectRows.filter((row) => row.missingEvidence.length > 0).length;
  const progress1Count = data.projectRows.filter((row) => row.progress1Score).length;
  const progress2Count = data.projectRows.filter((row) => row.progress2Score).length;
  const finalCount = data.projectRows.filter((row) => row.finalScore).length;
  const reportCount = data.projectRows.filter((row) => row.reportApproval).length;
  const advisorScoreCount = data.projectRows.filter((row) => row.advisorScore).length;
  const selectedOfferingId = data.selectedOffering?.id;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Evidence & AUN-QA"
        description="รวมหลักฐานการดำเนินโครงงาน การประเมิน rubric feedback revision และ audit trail สำหรับผู้ดูแลระบบ"
        actions={<a className="button-secondary" href="/admin">กลับ Dashboard</a>}
      />

      <section className="panel dashboard-console-panel">
        <DashboardSectionHeader title="เลือกรายวิชา" description="ค่าเริ่มต้นคือ course offering ล่าสุดในระบบ" />
        {data.offerings.length ? (
          <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center" action="/admin/evidence">
            <select name="course_offering_id" defaultValue={selectedOfferingId}>
              {data.offerings.map((offering) => (
                <option key={offering.id} value={offering.id}>
                  {offering.label}
                </option>
              ))}
            </select>
            <button type="submit" className="button-secondary mobile-primary-action sm:w-auto">ดูหลักฐาน</button>
          </form>
        ) : (
          <EmptyState title="ยังไม่มี course offering" description="เมื่อเปิดรายวิชาแล้ว ระบบจะแสดง evidence summary ที่นี่" />
        )}
        {data.invalidCourseOfferingId ? (
          <WarningAlert title="ไม่พบ course offering ที่เลือก">
            ระบบไม่ fallback ไปยังรายวิชาอื่น เพื่อป้องกันการ export หลักฐานผิดรายวิชา กรุณาเลือกรายวิชาจากรายการด้านบนอีกครั้ง
          </WarningAlert>
        ) : null}
      </section>

      {data.selectedOffering ? (
        <>
          <CompactMetricRow
            title="ภาพรวมหลักฐานรายวิชา"
            description={data.selectedOffering.label}
            metrics={[
              { label: "Projects", value: totalProjects, href: "#project-evidence", tone: totalProjects ? "ready" : "quiet" },
              { label: "Closed out", value: completedProjects, href: "#project-evidence", tone: completedProjects ? "complete" : "quiet" },
              { label: "Missing evidence", value: missingEvidenceProjects, href: "#project-evidence", tone: missingEvidenceProjects ? "waiting" : "complete" },
              { label: "Report evidence", value: reportCount, href: "#project-evidence", tone: reportCount ? "complete" : "quiet" },
              { label: "Advisor evidence", value: advisorScoreCount, href: "#project-evidence", tone: advisorScoreCount ? "complete" : "quiet" }
            ]}
          />

          {missingEvidenceProjects ? (
            <WarningAlert title={`ยังมี project ที่หลักฐานไม่ครบ ${missingEvidenceProjects} รายการ`}>
              ตรวจคอลัมน์ missing evidence ก่อนใช้ข้อมูลนี้เป็นชุดหลักฐาน QA/AUN-QA อย่างเป็นทางการ โดยช่องคะแนนหมายถึงมีหลักฐานคะแนนที่บันทึกแล้ว ไม่ใช่การคำนวณกฎ closeout ใหม่
            </WarningAlert>
          ) : (
            <InfoAlert title="พบหลักฐานครบตามรายการตรวจ">
              ทุก project ในรายวิชานี้มีหลักฐานคะแนน Progress 1, Progress 2, Final, Report, Advisor score และ Admin closeout ตามข้อมูลที่บันทึกในระบบ
            </InfoAlert>
          )}

          <section className="panel dashboard-console-panel">
            <DashboardSectionHeader title="Export CSV" description="ไฟล์ CSV มี UTF-8 BOM เพื่อเปิดใน Excel กับภาษาไทยได้ง่ายขึ้น ยกเว้น audit logs เป็น global export ทั้งระบบ" />
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <a className="button-secondary justify-center" href={exportHref("projects", selectedOfferingId)}>Project evidence</a>
              <a className="button-secondary justify-center" href={exportHref("timeline", selectedOfferingId)}>Timeline events</a>
              <a className="button-secondary justify-center" href={exportHref("scores", selectedOfferingId)}>Rubric score evidence</a>
              <a className="button-secondary justify-center" href={exportHref("reports", selectedOfferingId)}>Report reviews</a>
              <a className="button-secondary justify-center" href={exportHref("audit", selectedOfferingId)}>Global audit logs</a>
            </div>
          </section>

          <section className="panel dashboard-console-panel" id="project-evidence">
            <DashboardSectionHeader
              title="Project evidence status"
              description={`มีหลักฐานคะแนน Progress 1 ${progress1Count}/${totalProjects} (${percent(progress1Count, totalProjects)}) · Progress 2 ${progress2Count}/${totalProjects} · Final ${finalCount}/${totalProjects}`}
            />
            <div className="mt-3 overflow-x-auto">
              <table className="responsive-table">
                <thead>
                  <tr className="border-b border-line">
                    <th>นักศึกษา</th>
                    <th>หัวข้อ</th>
                    <th>ที่ปรึกษา</th>
                    <th>สถานะ</th>
                    <th>P1 evidence</th>
                    <th>P2 evidence</th>
                    <th>Final evidence</th>
                    <th>Report evidence</th>
                    <th>Advisor evidence</th>
                    <th>Timeline</th>
                    <th>ล่าสุด</th>
                  </tr>
                </thead>
                <tbody>
                  {data.projectRows.map((row) => (
                    <tr key={row.projectId} className="border-b border-line align-top">
                      <td>
                        <div className="font-semibold">{row.studentCode}</div>
                        <div className="text-xs text-muted">{row.studentName}</div>
                      </td>
                      <td className="min-w-56">
                        <div className="font-medium">{row.projectTitle}</div>
                        <div className="mt-1 text-xs text-muted">ID: {row.projectId}</div>
                      </td>
                      <td className="min-w-44">{row.advisorName}</td>
                      <td>{row.statusLabel}</td>
                      <td>{row.progress1Score ? "มี" : "ไม่มี"}</td>
                      <td>{row.progress2Score ? "มี" : "ไม่มี"}</td>
                      <td>{row.finalScore ? "มี" : "ไม่มี"}</td>
                      <td>{row.reportApproval ? "มี" : "ไม่มี"}</td>
                      <td>{row.advisorScore ? "มี" : "ไม่มี"}</td>
                      <td>{row.timelineEventCount} / {row.statusHistoryCount}</td>
                      <td>
                        <div>{row.lastEvidenceUpdate ? row.lastEvidenceUpdate.toLocaleString("th-TH") : "ไม่มีข้อมูล"}</div>
                        {row.missingEvidence.length ? <div className="mt-1 text-xs text-amber-700">{row.missingEvidence.join(", ")}</div> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.projectRows.length ? <EmptyState title="ยังไม่มี project" description="เมื่อนำเข้านักศึกษาและเริ่ม workflow แล้ว รายการหลักฐานจะแสดงที่นี่" /> : null}
          </section>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div className="panel dashboard-console-panel">
              <DashboardSectionHeader title="Rubric-attributed score evidence" description="นับ score submissions ผ่าน score item ที่ผูกกับ rubric item จริง เพื่อไม่ปะปนข้าม rubric version" />
              <div className="mt-3 overflow-x-auto">
                <table className="responsive-table">
                  <thead>
                    <tr className="border-b border-line">
                      <th>Round</th>
                      <th>Rubric</th>
                      <th>Items</th>
                      <th>Submissions</th>
                      <th>Score items</th>
                      <th>Evaluators</th>
                      <th>Average</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rubricRows.map((row) => (
                      <tr key={`${row.roundType}-${row.rubricName}`} className="border-b border-line">
                        <td>{row.roundLabel}</td>
                        <td>{row.rubricName}</td>
                        <td>{row.rubricItemCount}</td>
                        <td>{row.scoreSubmissionCount}</td>
                        <td>{row.scoreItemCount}</td>
                        <td>{row.evaluatorCount}</td>
                        <td>{row.averageScore ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel dashboard-console-panel">
              <DashboardSectionHeader title="AUN-QA evidence framing" description="คำอธิบายประกอบ ไม่ใช่ official CLO/PLO mapping logic" />
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
                <li><strong className="text-ink">Assessment evidence:</strong> rubrics, score submissions, score items และ evaluator snapshots</li>
                <li><strong className="text-ink">Feedback/revision evidence:</strong> proposal comments, report reviews และ revision requests</li>
                <li><strong className="text-ink">Student progression evidence:</strong> status history และ timeline events ตาม lifecycle</li>
                <li><strong className="text-ink">Project completion evidence:</strong> report approval, advisor score และ Admin closeout</li>
                <li><strong className="text-ink">Decision/audit trail:</strong> admin actions, proposal final decision และ release evidence</li>
              </ul>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="panel dashboard-console-panel">
              <DashboardSectionHeader title="Recent evidence events" description="Project timeline ล่าสุดของรายวิชาที่เลือก" />
              <div className="mt-3 space-y-2 text-sm">
                {data.recentTimelineEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border border-line bg-paperSoft p-3">
                    <div className="font-semibold">{event.eventTitle}</div>
                    <div className="text-xs text-muted">{event.studentCode} · {event.projectTitle}</div>
                    <div className="mt-1 text-xs text-muted">{event.eventType} · {event.occurredAt.toLocaleString("th-TH")} · {event.actorName}</div>
                  </div>
                ))}
                {!data.recentTimelineEvents.length ? <EmptyState title="ยังไม่มี timeline event" /> : null}
              </div>
            </div>

            <div className="panel dashboard-console-panel">
              <DashboardSectionHeader title="Recent admin audit actions" description="รายการนี้เป็น global audit trail ทั้งระบบ แสดงเฉพาะ metadata ปลอดภัย ไม่ export secrets หรือ token" />
              <div className="mt-3 space-y-2 text-sm">
                {data.recentAuditLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-line bg-paperSoft p-3">
                    <div className="font-semibold">{log.action}</div>
                    <div className="text-xs text-muted">{log.entityType} · {log.entityId}</div>
                    <div className="mt-1 text-xs text-muted">{log.occurredAt.toLocaleString("th-TH")} · {log.actorName}</div>
                  </div>
                ))}
                {!data.recentAuditLogs.length ? <EmptyState title="ยังไม่มี audit log" /> : null}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
