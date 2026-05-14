import Link from "next/link";
import { auth } from "@/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatThaiDateTime24, formatThaiScheduleRange } from "@/lib/format/dateTime";
import { getProjectRecordForViewer, type ProjectRecordDto } from "@/lib/projects/projectRecord";

function MiniSection({
  title,
  children,
  empty
}: {
  title: string;
  children?: React.ReactNode;
  empty?: string;
}) {
  return (
    <section className="panel">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children ?? <p className="text-sm text-muted">{empty ?? "ยังไม่มีข้อมูล"}</p>}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-paper p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-sm text-ink">{value || "-"}</div>
    </div>
  );
}

function EnumPill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted">{children}</span>;
}

function RoleAwareLinks({ record }: { record: ProjectRecordDto }) {
  return (
    <div className="flex flex-wrap gap-2">
      {record.actionLinks.map((link) => (
        <Link key={link.href} className="button-secondary" href={link.href}>
          {link.label}
        </Link>
      ))}
    </div>
  );
}

export default async function ProjectRecordPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await auth();
  const result = await getProjectRecordForViewer(projectId, session?.user);

  if (result.status === "NOT_FOUND") {
    return (
      <div className="panel">
        <h1 className="text-xl font-semibold">ไม่พบแฟ้มโครงงาน</h1>
        <p className="mt-2 text-sm text-muted">อาจไม่มีโครงงานนี้ในระบบ หรือรหัสโครงงานไม่ถูกต้อง</p>
      </div>
    );
  }

  if (result.status === "UNAUTHORIZED") {
    return (
      <div className="panel">
        <h1 className="text-xl font-semibold">ไม่สามารถเปิดแฟ้มโครงงานนี้ได้</h1>
        <p className="mt-2 text-sm text-muted">ระบบแสดงเฉพาะโครงงานที่เกี่ยวข้องกับบัญชีของท่านเท่านั้น</p>
      </div>
    );
  }

  const record = result.record;
  const officialAttempts = record.assessmentAttempts.filter((attempt) => attempt.isOfficialScore);
  const latestReport = record.reports[0];
  const latestSchedule = record.schedules[0];

  return (
    <div className="space-y-5">
      <PageHeader
        title="แฟ้มโครงงาน"
        description="อ่านข้อมูลรวมของโครงงานนี้แบบย้อนหลัง โดยไม่มีการบันทึกหรือเปลี่ยนสถานะจากหน้านี้"
        actions={<RoleAwareLinks record={record} />}
      />

      <section className="panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Project Record</div>
            <h1 className="mt-2 text-2xl font-semibold leading-snug text-ink">{record.summary.titleTh}</h1>
            {record.summary.titleEn ? <p className="mt-1 text-sm text-muted">{record.summary.titleEn}</p> : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={record.summary.status} label={record.summary.statusLabel} />
              <EnumPill>{record.viewerRole}</EnumPill>
            </div>
          </div>
          <div className="grid min-w-60 gap-2 text-sm">
            <InfoRow label="นักศึกษา" value={`${record.student.studentCode} ${record.student.name}`} />
            <InfoRow label="รายวิชา" value={`${record.courseOffering.courseTitle} · ${record.courseOffering.termDisplayName}`} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <InfoRow label="สถานะปัจจุบัน" value={record.summary.statusLabel} />
        <InfoRow label="อาจารย์ที่ปรึกษาล่าสุด" value={record.advisorRequests[0]?.advisorName} />
        <InfoRow label="รายงานล่าสุด" value={latestReport ? `ฉบับที่ ${latestReport.versionNo}` : "ยังไม่มีรายงาน"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <div className="space-y-4">
          <MiniSection title="ข้อมูลตั้งต้นและ Proposal">
            {record.origin ? (
              <div className="grid gap-3 md:grid-cols-2">
                <InfoRow label="ชื่อหัวข้อแรก" value={record.origin.titleTh} />
                <InfoRow label="สถานะเอกสาร" value={record.origin.status} />
                <InfoRow label="อาจารย์ที่เสนอไว้" value={record.origin.tentativeAdvisorName} />
                <InfoRow label="วันที่ส่ง" value={formatThaiDateTime24(record.origin.submittedAt)} />
                <InfoRow label="จำนวนเวอร์ชัน" value={`${record.origin.versionCount}`} />
                <InfoRow
                  label="เอกสารแนบ"
                  value={
                    record.origin.materialLink ? (
                      <a className="font-medium text-brand" href={record.origin.materialLink} target="_blank" rel="noreferrer">
                        เปิดเอกสาร
                      </a>
                    ) : null
                  }
                />
              </div>
            ) : (
              <p className="text-sm text-muted">ยังไม่มีข้อมูลตั้งต้นของโครงงาน</p>
            )}
          </MiniSection>

          <MiniSection title="รอบสอบและคะแนนนำเสนอ">
            {record.assessmentAttempts.length ? (
              <div className="space-y-2">
                {record.assessmentAttempts.map((attempt) => (
                  <div key={attempt.id} className="rounded-md border border-line bg-paper p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">{attempt.roundType}</div>
                        <div className="mt-1 text-xs text-muted">ครั้งที่ {attempt.attemptNo} · {attempt.status}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <EnumPill>{attempt.submittedReviewers}/{attempt.requiredReviewers} ผู้ประเมิน</EnumPill>
                        {attempt.officialScore ? <EnumPill>{attempt.officialScore}/100</EnumPill> : null}
                        {attempt.finalDecision ? <EnumPill>{attempt.finalDecision}</EnumPill> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">ยังไม่มีรอบประเมินที่บันทึกกับโครงงานนี้</p>
            )}
          </MiniSection>

          <MiniSection title="รายงานและการตรวจ">
            {record.reports.length ? (
              <div className="space-y-2">
                {record.reports.map((report) => (
                  <div key={report.id} className="rounded-md border border-line bg-paper p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">รายงานฉบับที่ {report.versionNo}</div>
                        <div className="mt-1 text-xs text-muted">ส่งเมื่อ {formatThaiDateTime24(report.submittedAt)}</div>
                      </div>
                      <a className="button-secondary" href={report.driveLink} target="_blank" rel="noreferrer">
                        เปิดรายงาน
                      </a>
                    </div>
                    {report.reviews.length ? (
                      <div className="mt-3 space-y-1 text-xs text-muted">
                        {report.reviews.map((review) => (
                          <div key={`${report.id}-${review.reviewerName}-${review.reviewedAt.toISOString()}`} className="flex flex-wrap justify-between gap-2 rounded-md border border-line bg-surface p-2">
                            <span>{review.reviewerName}</span>
                            <span>{review.decision} · {formatThaiDateTime24(review.reviewedAt)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">ยังไม่มีรายงานที่ส่ง</p>
            )}
          </MiniSection>
        </div>

        <div className="space-y-4">
          <MiniSection title="ผู้เกี่ยวข้อง">
            <div className="space-y-2">
              <div className="rounded-md border border-line bg-paper p-3 text-sm">
                <div className="font-semibold">{record.student.name}</div>
                <div className="text-muted">{record.student.studentCode} · {record.student.email}</div>
              </div>
              {record.committee.length ? (
                record.committee.map((person) => (
                  <div key={person.id} className="rounded-md border border-line bg-paper p-3 text-sm">
                    <div className="font-semibold">{person.teacherName}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <EnumPill>{person.role}</EnumPill>
                      {!person.active ? <EnumPill>ไม่ใช้งานแล้ว</EnumPill> : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">ยังไม่มีกรรมการที่บันทึกไว้</p>
              )}
            </div>
          </MiniSection>

          <MiniSection title="ตารางสอบ">
            {record.schedules.length ? (
              <div className="space-y-2">
                {record.schedules.map((schedule) => (
                  <div key={schedule.id} className="rounded-md border border-line bg-paper p-3 text-sm">
                    <div className="font-semibold">{schedule.roundType ?? schedule.assessmentKind}</div>
                    <div className="mt-1 text-muted">{formatThaiScheduleRange(schedule.proposedStartAt, schedule.proposedEndAt)}</div>
                    <div className="mt-1 text-muted">{schedule.room ? `ห้อง ${schedule.room}` : "ยังไม่ระบุห้อง"} · {schedule.status}</div>
                    {schedule.approvals.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {schedule.approvals.map((approval) => (
                          <EnumPill key={`${schedule.id}-${approval.teacherName}`}>{approval.teacherName}: {approval.decision}</EnumPill>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">ยังไม่มีตารางสอบที่เสนอ</p>
            )}
          </MiniSection>

          <MiniSection title="คะแนนที่ปรึกษา">
            {record.advisorScore ? (
              <div className="rounded-md border border-line bg-paper p-3 text-sm">
                <div className="font-semibold">{record.advisorScore.advisorName}</div>
                <div className="mt-1 text-muted">สถานะ {record.advisorScore.status}</div>
                <div className="mt-1 text-muted">คะแนน {record.advisorScore.score ?? "-"}</div>
                <div className="mt-1 text-muted">ส่งเมื่อ {formatThaiDateTime24(record.advisorScore.submittedAt)}</div>
              </div>
            ) : (
              <p className="text-sm text-muted">ยังไม่มีคะแนนที่ปรึกษา</p>
            )}
          </MiniSection>

          <MiniSection title="ข้อยกเว้น/การกู้คืน">
            {record.exceptions.length ? (
              <div className="space-y-2">
                {record.exceptions.map((exception) => (
                  <div key={exception.id} className="rounded-md border border-line bg-paper p-3 text-sm">
                    <div className="font-semibold">{exception.roundType} · {exception.exceptionType}</div>
                    <div className="mt-1 text-muted">{exception.status} · {formatThaiDateTime24(exception.createdAt)}</div>
                    <div className="mt-1 text-muted">{exception.reason}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">ไม่มีข้อยกเว้นที่บันทึกไว้</p>
            )}
          </MiniSection>
        </div>
      </div>

      <MiniSection title="หลักฐานและไทม์ไลน์">
        {record.timeline.length ? (
          <div className="space-y-2">
            {record.timeline.map((event) => (
              <div key={event.id} className="rounded-md border border-line bg-paper p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">{event.title}</div>
                  <div className="text-xs text-muted">{formatThaiDateTime24(event.occurredAt)}</div>
                </div>
                {event.description ? <p className="mt-1 text-muted">{event.description}</p> : null}
                {event.actorName ? <p className="mt-1 text-xs text-muted">โดย {event.actorName}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">ยังไม่มีไทม์ไลน์ที่บันทึกไว้</p>
        )}
      </MiniSection>

      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">ทางไปหน้าทำงานเดิม</h2>
            <p className="mt-1 text-sm text-muted">แฟ้มโครงงานนี้เป็นหน้าอ่านอย่างเดียว หากต้องส่ง อนุมัติ ตรวจ หรือให้คะแนน ให้กลับไปใช้หน้าทำงานเดิม</p>
          </div>
          <RoleAwareLinks record={record} />
        </div>
        {latestSchedule || officialAttempts.length ? null : (
          <p className="mt-3 text-xs text-muted">เมื่อมีรอบสอบหรือคะแนนที่บันทึกแล้ว รายการจะรวมอยู่ในแฟ้มนี้โดยอัตโนมัติ</p>
        )}
      </section>
    </div>
  );
}
