import { auth } from "@/auth";
import { reviewReportVersion } from "@/app/teacher/actions";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { MarkdownLatexEditor } from "@/components/ui/MarkdownLatexEditor";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/db";
import { allRequiredReportReviewersPassed, requiredReportReviewerIds } from "@/lib/reports/reportWorkflow";
import { teacherDisplayName } from "@/lib/teachers/displayName";

export default async function TeacherReportsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user.role !== "TEACHER" || !session.user.id) {
    return <div className="panel">หน้านี้สำหรับอาจารย์เท่านั้น</div>;
  }

  const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
  if (!teacher) {
    return <EmptyState title="ยังไม่พบโปรไฟล์อาจารย์" description="กรุณา claim โปรไฟล์และรอผู้ดูแลระบบอนุมัติก่อนใช้งาน" />;
  }

  const params = (await searchParams) ?? {};
  const projects = await prisma.project.findMany({
    where: {
      status: { in: ["REPORT_REVIEW", "REPORT_APPROVED"] },
      OR: [
        { committeeAssignments: { some: { teacherId: teacher.id, active: true, role: { in: ["HEAD", "MEMBER"] } } } },
        { advisorRequests: { some: { advisorTeacherId: teacher.id, status: "APPROVED" } } }
      ]
    },
    include: {
      student: true,
      committeeAssignments: { include: { teacher: true }, orderBy: { appointedAt: "asc" } },
      advisorRequests: { include: { advisorTeacher: true }, orderBy: { requestedAt: "desc" } },
      reportVersions: {
        include: { reviews: { include: { reviewerTeacher: true }, orderBy: { reviewedAt: "desc" } } },
        orderBy: { versionNo: "desc" }
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="ตรวจเล่มรายงาน"
        description="อาจารย์ที่ปรึกษาและ HEAD/MEMBER ที่ได้รับแต่งตั้งสามารถ PASS หรือขอให้นักศึกษาแก้ไขเล่มได้"
      />
      <ActionFeedback success={params.success} error={params.error} />
      <GuidancePanel
        title="Report approval loop"
        current="ตรวจเฉพาะ version ล่าสุดของโครงงานที่อยู่ในสถานะ REPORT_REVIEW"
        next="ถ้า HEAD/MEMBER ที่กำหนดอนุมัติครบ ระบบจะเปลี่ยนสถานะเป็น REPORT_APPROVED และหยุดก่อน Advisor scoring"
        actor="อาจารย์ที่ปรึกษา หรือ HEAD/MEMBER ที่ได้รับแต่งตั้ง"
      />

      <div className="space-y-4">
        {projects.length ? (
          projects.map((project) => {
            const latestReport = project.reportVersions[0];
            const previousReview = latestReport?.reviews.find((review) => review.reviewerTeacherId === teacher.id);
            const requiredReviewerIds = requiredReportReviewerIds(project.committeeAssignments);
            const projectReviews = project.reportVersions.flatMap((version) => version.reviews);
            const allPassed = allRequiredReportReviewersPassed({ requiredReviewerIds, reviews: projectReviews });

            return (
              <section key={project.id} className="panel">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}
                    </p>
                  </div>
                  <StatusBadge status={project.status} />
                </div>

                {!latestReport ? (
                  <EmptyState title="ยังไม่มีเล่มรายงาน" description="เมื่อนักศึกษาส่งเล่ม รายการจะแสดงที่นี่" />
                ) : (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-md border border-line bg-paper p-3 text-sm">
                      <div className="font-medium">Version {latestReport.versionNo}</div>
                      <a className="mt-1 inline-block text-brand" href={latestReport.driveLink} target="_blank" rel="noreferrer">
                        เปิดลิงก์รายงาน
                      </a>
                      <p className="mt-2 text-muted">
                        สถานะตรวจ: {allPassed || project.status === "REPORT_APPROVED" ? "ผ่านครบ" : "รอผลตรวจ / รอแก้ไข"}
                      </p>
                    </div>

                    {latestReport.reviews.length ? (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold">ผลตรวจที่บันทึกแล้ว</h3>
                        {latestReport.reviews.map((review) => (
                          <div key={review.id} className="rounded-md border border-line p-3 text-sm">
                            <div className="font-medium">
                              {teacherDisplayName(review.reviewerTeacher)} · {review.decision === "PASS" ? "PASS" : "ขอแก้ไข"}
                            </div>
                            {review.comment ? <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0 text-muted" value={review.comment} /> : null}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {project.status === "REPORT_REVIEW" ? (
                      <form action={reviewReportVersion} className="space-y-4">
                        <input type="hidden" name="report_version_id" value={latestReport.id} />
                        <MarkdownLatexEditor
                          name="comment"
                          label="Comment สำหรับนักศึกษา"
                          defaultValue={previousReview?.comment ?? ""}
                          rows={4}
                        />
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <SubmitButton
                            name="decision"
                            value="PASS"
                            pendingText="กำลังบันทึกผล..."
                            confirmMessage="ยืนยันว่าเล่มรายงาน version นี้ผ่านหรือไม่?"
                          >
                            อนุมัติเล่มรายงาน
                          </SubmitButton>
                          <SubmitButton
                            name="decision"
                            value="FAIL"
                            className="button-secondary"
                            pendingText="กำลังบันทึกผล..."
                            confirmMessage="ยืนยันการขอให้นักศึกษาแก้ไขเล่มรายงานหรือไม่?"
                          >
                            ขอแก้ไขเล่มรายงาน
                          </SubmitButton>
                        </div>
                      </form>
                    ) : (
                      <p className="rounded-md border border-line bg-paper p-3 text-sm text-muted">
                        เล่มรายงานผ่านแล้ว หน้านี้จะแสดงประวัติเท่านั้น
                      </p>
                    )}
                  </div>
                )}
              </section>
            );
          })
        ) : (
          <EmptyState
            title="ยังไม่มีเล่มรายงานที่ต้องตรวจ"
            description="รายการจะแสดงเมื่อมีโครงงาน REPORT_REVIEW หรือ REPORT_APPROVED ที่ท่านเป็นอาจารย์ที่ปรึกษา / HEAD / MEMBER"
          />
        )}
      </div>
    </div>
  );
}
