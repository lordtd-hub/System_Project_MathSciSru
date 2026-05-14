import Link from "next/link";
import { auth } from "@/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TeacherQueueBadge, TeacherWorkloadSummary } from "@/components/ui/TeacherWorkloadQueue";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { prisma } from "@/lib/db";
import { formatThaiScheduleRange } from "@/lib/format/dateTime";

function latestScheduleLabel(schedule: {
  proposedStartAt: Date;
  proposedEndAt: Date | null;
  room: string | null;
} | null | undefined) {
  if (!schedule) return "ยังไม่มีตารางสอบที่เกี่ยวข้อง";
  return `${formatThaiScheduleRange(schedule.proposedStartAt, schedule.proposedEndAt)}${schedule.room ? ` · ห้อง ${schedule.room}` : ""}`;
}

export default async function TeacherAdviceesPage() {
  const session = await auth();
  if (!hasApprovedTeacherCapability(session?.user) || !session?.user.id) {
    return <div className="panel">หน้านี้สำหรับอาจารย์เท่านั้น</div>;
  }

  const teacherWhere = session.user.teacherId ? { id: session.user.teacherId } : { userId: session.user.id };
  const teacher = await prisma.teacher.findUnique({
    where: teacherWhere,
    select: { id: true, academicPrefix: true, firstNameTh: true, lastNameTh: true }
  });

  if (!teacher) {
    return <EmptyState title="ยังไม่พบโปรไฟล์อาจารย์" description="กรุณาผูกบัญชีอาจารย์และรอผู้ดูแลระบบอนุมัติก่อนใช้งาน" />;
  }

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { advisorRequests: { some: { advisorTeacherId: teacher.id, status: "APPROVED" } } },
        { committeeAssignments: { some: { teacherId: teacher.id, active: true, role: "ADVISOR" } } }
      ]
    },
    include: {
      student: { include: { profile: true } },
      courseOffering: { include: { term: true } },
      advisorRequests: {
        where: { advisorTeacherId: teacher.id, status: "APPROVED" },
        orderBy: { reviewedAt: "desc" }
      },
      committeeAssignments: {
        where: { active: true },
        include: { teacher: true },
        orderBy: { appointedAt: "asc" }
      },
      scheduleProposals: {
        orderBy: { proposedStartAt: "desc" },
        take: 1
      },
      reportVersions: {
        orderBy: { versionNo: "desc" },
        take: 1,
        include: { reviews: true }
      },
      advisorScore: true
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });

  const activeProjects = projects.filter((project) => project.status !== "COMPLETED").length;
  const completedProjects = projects.length - activeProjects;
  const reportReadyProjects = projects.filter((project) => ["REPORT_REVIEW", "REPORT_APPROVED", "ADVISOR_SCORING", "COMPLETED"].includes(project.status)).length;
  const scoredProjects = projects.filter((project) => project.advisorScore?.status === "SUBMITTED").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="ลูกศิษย์ที่ปรึกษา"
        description="รวมโครงงานที่อาจารย์เป็นที่ปรึกษา เพื่อเปิดดูแฟ้มโครงงานและติดตามภาพรวมของลูกศิษย์แต่ละคน"
      />

      <TeacherWorkloadSummary
        metrics={[
          { label: "โครงงานทั้งหมด", count: projects.length, tone: projects.length ? "completed" : "locked", description: "โครงงานที่ผูกกับอาจารย์ในบทบาทที่ปรึกษา" },
          { label: "กำลังดำเนินการ", count: activeProjects, tone: activeProjects ? "action" : "locked", description: "ยังไม่ปิดโครงงานเป็น COMPLETED" },
          { label: "ถึงช่วงรายงาน", count: reportReadyProjects, tone: reportReadyProjects ? "waiting" : "locked", description: "มีรายงานหรืออยู่ช่วงหลังสอบขั้นสุดท้าย" },
          { label: "ให้คะแนนที่ปรึกษาแล้ว", count: scoredProjects, tone: scoredProjects ? "completed" : "locked", description: "มีคะแนนสรุปของอาจารย์ที่ปรึกษาแล้ว" },
          { label: "เสร็จสิ้น", count: completedProjects, tone: completedProjects ? "completed" : "locked", description: "ผู้ดูแลระบบปิดโครงงานเรียบร้อยแล้ว" }
        ]}
      />

      {projects.length ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {projects.map((project) => {
            const latestSchedule = project.scheduleProposals[0];
            const latestReport = project.reportVersions[0];
            const committeeCount = project.committeeAssignments.length;
            const advisorScoreSubmitted = project.advisorScore?.status === "SUBMITTED";

            return (
              <article key={project.id} className="panel space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted">{project.student.studentCode}</div>
                    <h2 className="mt-1 text-lg font-semibold text-ink">{project.currentTitleTh ?? "ยังไม่ได้ระบุชื่อหัวข้อ"}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {project.student.firstNameTh} {project.student.lastNameTh}
                    </p>
                  </div>
                  <StatusBadge status={project.status} />
                </div>

                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-md border border-line bg-paper p-3">
                    <div className="text-xs font-semibold text-muted">รายวิชา</div>
                    <div className="mt-1 text-ink">{project.courseOffering.courseTitle}</div>
                    <div className="mt-1 text-xs text-muted">{project.courseOffering.term.displayName}</div>
                  </div>
                  <div className="rounded-md border border-line bg-paper p-3">
                    <div className="text-xs font-semibold text-muted">ตารางสอบล่าสุด</div>
                    <div className="mt-1 text-ink">{latestScheduleLabel(latestSchedule)}</div>
                  </div>
                  <div className="rounded-md border border-line bg-paper p-3">
                    <div className="text-xs font-semibold text-muted">ช่องทางติดต่อ</div>
                    <div className="mt-1 text-ink">โทร {project.student.profile?.phone?.trim() || "ยังไม่ระบุ"}</div>
                    <div className="mt-1 text-xs text-muted">LINE {project.student.profile?.lineId?.trim() || "ยังไม่ระบุ"}</div>
                  </div>
                  <div className="rounded-md border border-line bg-paper p-3">
                    <div className="text-xs font-semibold text-muted">รายงานล่าสุด</div>
                    <div className="mt-1 text-ink">{latestReport ? `ฉบับที่ ${latestReport.versionNo}` : "ยังไม่มีรายงาน"}</div>
                    {latestReport ? <div className="mt-1 text-xs text-muted">ผลตรวจ {latestReport.reviews.length} รายการ</div> : null}
                  </div>
                  <div className="rounded-md border border-line bg-paper p-3">
                    <div className="text-xs font-semibold text-muted">กรรมการ / คะแนนที่ปรึกษา</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <TeacherQueueBadge tone={committeeCount ? "completed" : "locked"}>{committeeCount} กรรมการ</TeacherQueueBadge>
                      <TeacherQueueBadge tone={advisorScoreSubmitted ? "completed" : "waiting"}>
                        {advisorScoreSubmitted ? "ให้คะแนนแล้ว" : "ยังไม่ให้คะแนน"}
                      </TeacherQueueBadge>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                  <Link className="button" href={`/projects/${project.id}`}>ดูแฟ้มโครงงาน</Link>
                  <Link className="button-secondary" href="/teacher/advisor-score">คะแนนที่ปรึกษา</Link>
                  <Link className="button-secondary" href="/teacher/schedules">ตารางสอบ</Link>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState
          title="ยังไม่มีลูกศิษย์ที่ปรึกษา"
          description="เมื่อมีนักศึกษาเลือกอาจารย์เป็นที่ปรึกษาและคำขอได้รับอนุมัติ รายการโครงงานจะแสดงที่หน้านี้"
        />
      )}
    </div>
  );
}
