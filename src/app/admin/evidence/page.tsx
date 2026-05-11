import Link from "next/link";
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

const exportItems = [
  { kind: "projects", label: "หลักฐานรายโครงงาน" },
  { kind: "timeline", label: "Timeline events" },
  { kind: "scores", label: "Rubric score evidence" },
  { kind: "reports", label: "Report reviews" },
  { kind: "audit", label: "ประวัติการดำเนินการทั้งระบบ" }
] as const;

function exportHref(kind: string, format: "csv" | "xlsx", courseOfferingId?: string) {
  const params = new URLSearchParams();
  if (courseOfferingId && kind !== "audit") params.set("course_offering_id", courseOfferingId);
  if (format === "xlsx") params.set("format", "xlsx");
  const query = params.toString();
  return `/admin/evidence/exports/${kind}${query ? `?${query}` : ""}`;
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
        title="หลักฐานการดำเนินงานและ AUN-QA"
        description="รวมหลักฐานการดำเนินโครงงาน การประเมิน ข้อเสนอแนะ การแก้ไขรายงาน และประวัติการดำเนินการสำหรับผู้ดูแลระบบ"
        actions={<Link className="button-secondary" href="/admin">กลับแดชบอร์ด</Link>}
      />

      <section className="panel dashboard-console-panel">
        <DashboardSectionHeader title="เลือกรายวิชา" description="ค่าเริ่มต้นคือรายวิชาที่เปิดล่าสุดในระบบ" />
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
          <EmptyState title="ยังไม่มีรายวิชาที่เปิด" description="เมื่อเปิดรายวิชาแล้ว ระบบจะแสดงสรุปหลักฐานที่นี่" />
        )}
        {data.invalidCourseOfferingId ? (
          <WarningAlert title="ไม่พบรายวิชาที่เลือก">
            ระบบจะไม่เปลี่ยนไปใช้รายวิชาอื่นโดยอัตโนมัติ เพื่อป้องกันการส่งออกหลักฐานผิดรายวิชา กรุณาเลือกรายวิชาจากรายการด้านบนอีกครั้ง
          </WarningAlert>
        ) : null}
      </section>

      {data.selectedOffering ? (
        <>
          <CompactMetricRow
            title="ภาพรวมหลักฐานรายวิชา"
            description={data.selectedOffering.label}
            metrics={[
              { label: "โครงงาน", value: totalProjects, href: "#project-evidence", tone: totalProjects ? "ready" : "quiet" },
              { label: "เสร็จสมบูรณ์", value: completedProjects, href: "#project-evidence", tone: completedProjects ? "complete" : "quiet" },
              { label: "หลักฐานยังไม่ครบ", value: missingEvidenceProjects, href: "#project-evidence", tone: missingEvidenceProjects ? "waiting" : "complete" },
              { label: "หลักฐานรายงาน", value: reportCount, href: "#project-evidence", tone: reportCount ? "complete" : "quiet" },
              { label: "คะแนนที่ปรึกษา", value: advisorScoreCount, href: "#project-evidence", tone: advisorScoreCount ? "complete" : "quiet" }
            ]}
          />

          {missingEvidenceProjects ? (
            <WarningAlert title={`ยังมีโครงงานที่หลักฐานไม่ครบ ${missingEvidenceProjects} รายการ`}>
              ตรวจรายการหลักฐานที่ยังขาดก่อนใช้ข้อมูลนี้เป็นชุดหลักฐาน AUN-QA อย่างเป็นทางการ โดยช่องคะแนนหมายถึงมีหลักฐานคะแนนที่บันทึกแล้ว ไม่ใช่การคำนวณกฎการปิดโครงงานใหม่
            </WarningAlert>
          ) : (
            <InfoAlert title="พบหลักฐานครบตามรายการตรวจ">
              ทุกโครงงานในรายวิชานี้มีหลักฐานคะแนนสอบความก้าวหน้าครั้งที่ 1 ครั้งที่ 2 คะแนนสอบขั้นสุดท้าย รายงาน คะแนนอาจารย์ที่ปรึกษา และการยืนยันจบโครงงานตามข้อมูลที่บันทึกในระบบ
            </InfoAlert>
          )}

          <section className="panel dashboard-console-panel">
            <DashboardSectionHeader title="ส่งออกหลักฐาน" description="ดาวน์โหลดเป็น CSV หรือ Excel (.xlsx) โดยประวัติการดำเนินการเป็นข้อมูลภาพรวมทั้งระบบ" />
            <div className="mt-3 grid gap-2 lg:grid-cols-5">
              {exportItems.map((item) => (
                <div key={item.kind} className="rounded-lg border border-line bg-paperSoft p-2">
                  <div className="mb-2 text-xs font-semibold text-ink">{item.label}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <a className="button-secondary justify-center px-2 text-xs" href={exportHref(item.kind, "csv", selectedOfferingId)}>CSV</a>
                    <a className="button-secondary justify-center px-2 text-xs" href={exportHref(item.kind, "xlsx", selectedOfferingId)}>Excel</a>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel dashboard-console-panel" id="project-evidence">
            <DashboardSectionHeader
              title="สถานะหลักฐานรายโครงงาน"
              description={`มีหลักฐานคะแนนสอบความก้าวหน้าครั้งที่ 1 ${progress1Count}/${totalProjects} (${percent(progress1Count, totalProjects)}) · ครั้งที่ 2 ${progress2Count}/${totalProjects} · สอบขั้นสุดท้าย ${finalCount}/${totalProjects}`}
            />
            <div className="mt-3 overflow-x-auto">
              <table className="responsive-table">
                <thead>
                  <tr className="border-b border-line">
                    <th>นักศึกษา</th>
                    <th>หัวข้อ</th>
                    <th>ที่ปรึกษา</th>
                    <th>สถานะ</th>
                    <th>หลักฐาน P1</th>
                    <th>หลักฐาน P2</th>
                    <th>หลักฐาน Final</th>
                    <th>หลักฐานรายงาน</th>
                    <th>คะแนนที่ปรึกษา</th>
                    <th>ประวัติ</th>
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
            {!data.projectRows.length ? <EmptyState title="ยังไม่มีโครงงาน" description="เมื่อนำเข้านักศึกษาและเริ่มขั้นตอนโครงงานแล้ว รายการหลักฐานจะแสดงที่นี่" /> : null}
          </section>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div className="panel dashboard-console-panel">
              <DashboardSectionHeader title="หลักฐานคะแนนตามเกณฑ์ประเมิน" description="นับหลักฐานคะแนนจากรายการประเมินที่ผูกกับเกณฑ์ประเมินจริง เพื่อไม่ปะปนข้ามฉบับของเกณฑ์" />
              <div className="mt-3 overflow-x-auto">
                <table className="responsive-table">
                  <thead>
                    <tr className="border-b border-line">
                      <th>รอบสอบ</th>
                      <th>เกณฑ์ประเมิน</th>
                      <th>รายการ</th>
                      <th>การบันทึกคะแนน</th>
                      <th>รายการคะแนน</th>
                      <th>ผู้ประเมิน</th>
                      <th>คะแนนเฉลี่ย</th>
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
              <DashboardSectionHeader title="กรอบการใช้หลักฐานสำหรับ AUN-QA" description="คำอธิบายประกอบสำหรับการทบทวนหลักฐาน ยังไม่ใช่การ mapping CLO/PLO อย่างเป็นทางการ" />
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
                <li><strong className="text-ink">หลักฐานการประเมิน:</strong> เกณฑ์ประเมิน การบันทึกคะแนน รายการคะแนน และข้อมูลผู้ประเมินขณะบันทึก</li>
                <li><strong className="text-ink">หลักฐานข้อเสนอแนะและการแก้ไข:</strong> ความเห็นจากการเสนอหัวข้อ ผลตรวจรายงาน และคำขอแก้ไขรายงาน</li>
                <li><strong className="text-ink">หลักฐานความก้าวหน้าของนักศึกษา:</strong> ประวัติสถานะและเหตุการณ์สำคัญตามขั้นตอนโครงงาน</li>
                <li><strong className="text-ink">หลักฐานการสำเร็จโครงงาน:</strong> การผ่านรายงาน คะแนนอาจารย์ที่ปรึกษา และการปิดโครงงาน</li>
                <li><strong className="text-ink">หลักฐานการตัดสินใจ:</strong> การดำเนินการของผู้ดูแลระบบ มติผลการเสนอหัวข้อ และการเปิดผลประเมิน</li>
              </ul>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="panel dashboard-console-panel">
              <DashboardSectionHeader title="เหตุการณ์หลักฐานล่าสุด" description="เหตุการณ์สำคัญล่าสุดของรายวิชาที่เลือก" />
              <div className="mt-3 space-y-2 text-sm">
                {data.recentTimelineEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border border-line bg-paperSoft p-3">
                    <div className="font-semibold">{event.eventTitle}</div>
                    <div className="text-xs text-muted">{event.studentCode} · {event.projectTitle}</div>
                    <div className="mt-1 text-xs text-muted">{event.eventType} · {event.occurredAt.toLocaleString("th-TH")} · {event.actorName}</div>
                  </div>
                ))}
                {!data.recentTimelineEvents.length ? <EmptyState title="ยังไม่มีเหตุการณ์หลักฐาน" /> : null}
              </div>
            </div>

            <div className="panel dashboard-console-panel">
              <DashboardSectionHeader title="ประวัติการดำเนินการล่าสุดของผู้ดูแลระบบ" description="รายการนี้เป็นประวัติภาพรวมทั้งระบบ แสดงเฉพาะข้อมูลประกอบที่ปลอดภัย ไม่ส่งออกข้อมูลลับหรือโทเคน" />
              <div className="mt-3 space-y-2 text-sm">
                {data.recentAuditLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-line bg-paperSoft p-3">
                    <div className="font-semibold">{log.action}</div>
                    <div className="text-xs text-muted">{log.entityType} · {log.entityId}</div>
                    <div className="mt-1 text-xs text-muted">{log.occurredAt.toLocaleString("th-TH")} · {log.actorName}</div>
                  </div>
                ))}
                {!data.recentAuditLogs.length ? <EmptyState title="ยังไม่มีประวัติการดำเนินการ" /> : null}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
