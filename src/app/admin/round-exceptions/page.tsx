import { auth } from "@/auth";
import type { Prisma } from "@prisma/client";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { InfoAlert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { courseLevelRoundTypes, isRoundClosed, roundStatusLabelTh, roundTypeLabelTh } from "@/lib/assessments/courseRounds";
import { prisma } from "@/lib/db";
import { formatThaiDateTime24 } from "@/lib/format/dateTime";
import { openLateRoundSubmissionForProject } from "../actions";

type RoundType = (typeof courseLevelRoundTypes)[number];

const statusLabels = {
  missed: "ยังไม่ส่ง",
  opened: "เปิดย้อนหลังแล้ว",
  late_submitted: "ส่งแล้วหลังปิดรอบ"
} as const;
type ExceptionRowStatus = keyof typeof statusLabels;

function getSelectedRoundType(value: string | string[] | undefined): RoundType {
  const roundType = Array.isArray(value) ? value[0] : value;
  return courseLevelRoundTypes.includes(roundType as RoundType) ? (roundType as RoundType) : "PROPOSAL";
}

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDate(value?: Date | null) {
  return formatThaiDateTime24(value);
}

function teacherName(teacher?: { academicPrefix: string; firstNameTh: string; lastNameTh: string } | null) {
  return teacher ? `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}` : "";
}

export default async function AdminRoundExceptionsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return <div className="panel">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</div>;

  const params = (await searchParams) ?? {};
  const selectedRoundType = getSelectedRoundType(params.round_type);
  const statusFilter = getParam(params.status);
  const query = getParam(params.q).trim().toLowerCase();

  const offering = await prisma.courseOffering.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { id: "desc" },
    include: { term: true }
  });

  if (!offering) {
    return <EmptyState title="ยังไม่มีรายวิชาที่เปิดใช้งาน" description="สร้างรายวิชา/ภาคเรียนก่อนจัดการผู้ส่งย้อนหลัง" />;
  }

  const round = await prisma.assessmentRound.findUnique({
    where: { courseOfferingId_roundType: { courseOfferingId: offering.id, roundType: selectedRoundType } }
  });
  const exceptionProjectWhere: Prisma.ProjectWhereInput[] = round
    ? selectedRoundType === "PROPOSAL"
      ? [{ presentationSubmissions: { none: {} } }, { roundExceptions: { some: { assessmentRoundId: round.id } } }]
      : [{ roundExceptions: { some: { assessmentRoundId: round.id } } }]
    : [];

  const projects = round
    ? await prisma.project.findMany({
        where: {
          courseOfferingId: offering.id,
          OR: exceptionProjectWhere
        },
        orderBy: { student: { studentCode: "asc" } },
        include: {
          student: true,
          advisorRequests: {
            where: { status: "APPROVED" },
            orderBy: { reviewedAt: "desc" },
            take: 1,
            include: { advisorTeacher: true }
          },
          presentationSubmissions: {
            orderBy: { submittedAt: "desc" },
            take: 1
          },
          roundExceptions: {
            where: { assessmentRoundId: round.id },
            orderBy: { createdAt: "desc" }
          }
        }
      })
    : [];

  const rows = projects
    .map((project) => {
      const latestException = project.roundExceptions[0];
      const hasSubmission = selectedRoundType === "PROPOSAL" ? project.presentationSubmissions.length > 0 : false;
      const isOpen = latestException?.status === "OPEN";
      const status: ExceptionRowStatus = hasSubmission && latestException ? "late_submitted" : isOpen ? "opened" : "missed";
      const searchText = [
        project.student.studentCode,
        project.student.firstNameTh,
        project.student.lastNameTh,
        project.currentTitleTh,
        teacherName(project.advisorRequests[0]?.advisorTeacher)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return { project, latestException, hasSubmission, isOpen, status, searchText };
    })
    .filter((row) => (query ? row.searchText.includes(query) : true))
    .filter((row) => (statusFilter && statusFilter in statusLabels ? row.status === statusFilter : true));

  const counts = {
    missed: rows.filter((row) => row.status === "missed").length,
    opened: rows.filter((row) => row.status === "opened").length,
    lateSubmitted: rows.filter((row) => row.status === "late_submitted").length
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="จัดการผู้ส่งย้อนหลัง / นักศึกษาที่พลาดรอบ"
        description={`${offering.term.displayName} · ${offering.courseTitle}`}
      />
      <ActionFeedback success={params.success} error={params.error} />

      <InfoAlert title="ใช้หน้านี้แทนการแสดงฟอร์มยาวในหน้ารอบสอบ">
        เลือกรอบ กรองรายชื่อ แล้วเปิดส่งย้อนหลังเป็นรายกรณี ระบบจะติดป้ายส่งหลังปิดรอบและหักคะแนนเริ่มต้น 10% เว้นแต่ระบุเป็นเหตุสุดวิสัย
      </InfoAlert>

      <section className="panel">
        <form className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]" action="/admin/round-exceptions">
          <label className="text-sm font-medium">
            รอบสอบ
            <select name="round_type" defaultValue={selectedRoundType} className="mt-1">
              {courseLevelRoundTypes.map((roundType) => (
                <option key={roundType} value={roundType}>
                  {roundTypeLabelTh(roundType)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            สถานะ
            <select name="status" defaultValue={statusFilter} className="mt-1">
              <option value="">ทุกสถานะ</option>
              <option value="missed">{statusLabels.missed}</option>
              <option value="opened">{statusLabels.opened}</option>
              <option value="late_submitted">{statusLabels.late_submitted}</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            ค้นหา
            <input name="q" defaultValue={getParam(params.q)} placeholder="รหัส ชื่อ โครงงาน หรืออาจารย์" className="mt-1" />
          </label>
          <button className="button-secondary self-end" type="submit">
            กรองรายการ
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">{roundTypeLabelTh(selectedRoundType)}</h2>
            <p className="mt-1 text-sm text-muted">
              สถานะรอบ: {round ? roundStatusLabelTh(round.status) : "ยังไม่สร้างรอบ"} · เปิดย้อนหลังได้เมื่อรอบปิดแล้วเท่านั้น
            </p>
          </div>
          <a className="button-secondary" href="/admin/rounds">
            กลับไปรอบสอบของรายวิชา
          </a>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <div className="rounded-md border border-line bg-paper p-3">
            <div className="text-2xl font-semibold">{counts.missed}</div>
            <div className="text-sm text-muted">ยังไม่ส่ง</div>
          </div>
          <div className="rounded-md border border-line bg-paper p-3">
            <div className="text-2xl font-semibold">{counts.opened}</div>
            <div className="text-sm text-muted">เปิดย้อนหลังแล้ว</div>
          </div>
          <div className="rounded-md border border-line bg-paper p-3">
            <div className="text-2xl font-semibold">{counts.lateSubmitted}</div>
            <div className="text-sm text-muted">ส่งแล้วหลังปิดรอบ</div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="px-3 py-2 font-medium">นักศึกษา</th>
                <th className="px-3 py-2 font-medium">โครงงาน</th>
                <th className="px-3 py-2 font-medium">ที่ปรึกษา</th>
                <th className="px-3 py-2 font-medium">สถานะ</th>
                <th className="px-3 py-2 font-medium">การหักคะแนน</th>
                <th className="px-3 py-2 font-medium">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ project, latestException, hasSubmission, isOpen, status }) => {
                const excused = latestException?.exceptionType === "LATE_ROUND_EXCUSED";
                const canOpen = Boolean(round && isRoundClosed(round.status) && !hasSubmission && !isOpen);
                return (
                  <tr key={project.id} className="align-top">
                    <td className="px-3 py-3">
                      <div className="font-medium">{project.student.studentCode}</div>
                      <div className="text-muted">{project.student.firstNameTh} {project.student.lastNameTh}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div>{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</div>
                      <div className="mt-1 text-xs text-muted">ID: {project.id}</div>
                    </td>
                    <td className="px-3 py-3">{teacherName(project.advisorRequests[0]?.advisorTeacher) || "ไม่มีข้อมูล"}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full border border-line px-2 py-1 text-xs font-semibold">{statusLabels[status]}</span>
                      {latestException ? <div className="mt-2 text-xs text-muted">เปิดเมื่อ {formatDate(latestException.reopenedAt)}</div> : null}
                    </td>
                    <td className="px-3 py-3">{excused ? "ไม่หักคะแนน (เหตุสุดวิสัย)" : latestException ? "หัก 10%" : "หัก 10% หากเปิดย้อนหลัง"}</td>
                    <td className="px-3 py-3">
                      {canOpen ? (
                        <details>
                          <summary className="cursor-pointer font-semibold text-brand">เปิดส่งรายกรณี</summary>
                          <form action={openLateRoundSubmissionForProject} className="mt-3 min-w-72 rounded-md border border-line bg-paper p-3">
                            <input type="hidden" name="project_id" value={project.id} />
                            <input type="hidden" name="round_type" value={selectedRoundType} />
                            <input type="hidden" name="return_to" value="/admin/round-exceptions" />
                            <label className="block text-xs font-semibold text-muted">เหตุผล/บันทึกการเปิดย้อนหลัง</label>
                            <textarea
                              name="reason"
                              rows={3}
                              defaultValue="เปิดให้ส่งหลังปิดรอบเป็นกรณีพิเศษ โดยระบบติดป้ายส่งหลังปิดรอบและหักคะแนนรอบนี้ 10%"
                              className="mt-1"
                            />
                            <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                              <input type="checkbox" name="excused" value="yes" />
                              เหตุสุดวิสัย ไม่หักคะแนน
                            </label>
                            <SubmitButton className="mt-3" pendingText="กำลังเปิดสิทธิ์...">
                              ยืนยันเปิดส่งย้อนหลัง
                            </SubmitButton>
                          </form>
                        </details>
                      ) : (
                        <span className="text-muted">{hasSubmission ? "ไม่มี action เพิ่ม" : isOpen ? "เปิดไว้แล้ว" : "รอบยังไม่ปิด"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr>
                  <td className="px-3 py-6 text-center text-muted" colSpan={6}>
                    ไม่พบรายการตามตัวกรอง
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
