import { auth } from "@/auth";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { reviewReportVersion } from "@/app/teacher/actions";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { MarkdownLatexEditor } from "@/components/ui/MarkdownLatexEditor";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TeacherQueueBadge, TeacherWorkloadSummary } from "@/components/ui/TeacherWorkloadQueue";
import { FigmaMetricCard, FigmaObjectDetail, FigmaObjectSummaryList, FigmaPageHeader, FigmaPanel, FigmaReviewLayout, FigmaStatusBadge } from "@/components/redesign/VisualSurfaces";
import { prisma } from "@/lib/db";
import { allRequiredReportReviewersPassed, requiredReportReviewerIds } from "@/lib/reports/reportWorkflow";
import { teacherDisplayName } from "@/lib/teachers/displayName";
import { getUiMode } from "@/lib/uiMode";

export default async function TeacherReportsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!hasApprovedTeacherCapability(session?.user) || !session?.user.id) {
    return <div className="panel">หน้านี้สำหรับอาจารย์เท่านั้น</div>;
  }

  const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
  if (!teacher) {
    return <EmptyState title="ยังไม่พบโปรไฟล์อาจารย์" description="กรุณาส่งคำขอผูกบัญชีอาจารย์และรอผู้ดูแลระบบอนุมัติก่อนใช้งาน" />;
  }

  const params = (await searchParams) ?? {};
  const uiMode = await getUiMode();
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
      },
      timelineEvents: {
        where: { eventType: "REPORT_VERSION_SUBMITTED" },
        orderBy: { occurredAt: "asc" }
      }
    },
    orderBy: { updatedAt: "desc" }
  });
  const reportQueueOrder = { action: 0, returned: 1, waiting: 2, completed: 3, locked: 4 } as const;
  const reportQueueLabels = {
    action: "ต้องดำเนินการ",
    returned: "ส่งกลับ/รอแก้ไข",
    waiting: "รอผู้อื่น",
    completed: "เสร็จแล้ว",
    locked: "ยังไม่พร้อม"
  } as const;
  const reportQueueTones = {
    action: "action",
    returned: "returned",
    waiting: "waiting",
    completed: "completed",
    locked: "locked"
  } as const;
  const reportQueueItems = projects.map((project) => {
    const latestReport = project.reportVersions[0];
    if (!latestReport) return { projectId: project.id, state: "locked" as const };
    const previousReview = latestReport.reviews.find((review) => review.reviewerTeacherId === teacher.id);
    const requiredReviewerIds = requiredReportReviewerIds(project.committeeAssignments, project.advisorRequests);
    const allPassed = allRequiredReportReviewersPassed({ requiredReviewerIds, reviews: latestReport.reviews });
    const latestReportHasRevisionRequest = latestReport.reviews.some((review) => review.decision === "FAIL");
    if (project.status === "REPORT_APPROVED" || allPassed) return { projectId: project.id, state: "completed" as const };
    if (latestReportHasRevisionRequest) return { projectId: project.id, state: "returned" as const };
    if (previousReview) return { projectId: project.id, state: "waiting" as const };
    return { projectId: project.id, state: "action" as const };
  });
  const reportQueueStateByProjectId = new Map(reportQueueItems.map((item) => [item.projectId, item.state]));
  const sortedProjects = [...projects].sort((a, b) => {
    const stateA = reportQueueStateByProjectId.get(a.id) ?? "waiting";
    const stateB = reportQueueStateByProjectId.get(b.id) ?? "waiting";
    return reportQueueOrder[stateA] - reportQueueOrder[stateB];
  });
  const reportQueueCount = (state: (typeof reportQueueItems)[number]["state"]) =>
    reportQueueItems.filter((item) => item.state === state).length;
  const figmaReportTone = (state: (typeof reportQueueItems)[number]["state"]) => {
    if (state === "action") return "action" as const;
    if (state === "returned") return "warning" as const;
    if (state === "waiting") return "waiting" as const;
    if (state === "completed") return "success" as const;
    return "muted" as const;
  };

  const renderFigmaReportProject = (project: (typeof projects)[number]) => {
    const latestReport = project.reportVersions[0];
    const previousReview = latestReport?.reviews.find((review) => review.reviewerTeacherId === teacher.id);
    const hasSubmittedCurrentReview = Boolean(previousReview);
    const requiredReviewerIds = requiredReportReviewerIds(project.committeeAssignments, project.advisorRequests);
    const allPassed = allRequiredReportReviewersPassed({ requiredReviewerIds, reviews: latestReport?.reviews ?? [] });
    const latestReportHasRevisionRequest = latestReport?.reviews.some((review) => review.decision === "FAIL") ?? false;
    const reportHistory = [...project.reportVersions].sort((a, b) => a.versionNo - b.versionNo);
    const latestReportNote = latestReport
      ? project.timelineEvents.find((event) => event.relatedEntityId === latestReport.id)?.eventDescription
      : null;
    const queueState = reportQueueStateByProjectId.get(project.id) ?? "waiting";

    const context = (
      <div className="space-y-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <FigmaStatusBadge tone={figmaReportTone(queueState)}>{reportQueueLabels[queueState]}</FigmaStatusBadge>
            <FigmaStatusBadge tone="muted">Report</FigmaStatusBadge>
            <StatusBadge status={project.status} />
          </div>
          <h2 className="mt-3 text-lg font-semibold text-ink">{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            {project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}
          </p>
        </div>

        {!latestReport ? (
          <EmptyState title="ยังไม่มีเล่มรายงาน" description="เมื่อนักศึกษาส่งเล่ม รายการจะแสดงที่นี่" />
        ) : (
          <>
            <div className="rounded-md border border-line bg-paper p-3 text-sm">
              <div className="font-medium text-ink">ฉบับที่ {latestReport.versionNo}</div>
              <a className="mt-1 inline-block text-brand" href={latestReport.driveLink} target="_blank" rel="noreferrer">
                เปิดลิงก์รายงาน
              </a>
              <p className="mt-2 text-muted">
                สถานะตรวจ: {allPassed || project.status === "REPORT_APPROVED" ? "ผู้ตรวจอนุมัติครบแล้ว" : "รอผลตรวจ / รอแก้ไข"}
              </p>
            </div>

            {latestReportNote ? (
              <div className="rounded-md border border-line bg-surface p-3 text-sm">
                <h3 className="font-semibold text-ink">สรุปการแก้ไข / ตอบกลับข้อเสนอแนะของผู้ตรวจจากนักศึกษา</h3>
                <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0 text-muted" value={latestReportNote} />
              </div>
            ) : null}

            {reportHistory.length > 1 ? (
              <div className="rounded-md border border-line bg-paper p-3 text-sm">
                <h3 className="font-semibold text-ink">ประวัติการส่งรายงาน</h3>
                <div className="mt-2 space-y-2">
                  {reportHistory.map((version) => {
                    const note = project.timelineEvents.find((event) => event.relatedEntityId === version.id)?.eventDescription;
                    return (
                      <div key={version.id} className="rounded-md border border-line bg-surface p-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">ฉบับที่ {version.versionNo}</span>
                          <a className="text-brand" href={version.driveLink} target="_blank" rel="noreferrer">เปิดเล่ม</a>
                        </div>
                        {note ? <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0 text-muted" value={note} /> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {latestReport.reviews.length ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-ink">ผลตรวจที่บันทึกแล้ว</h3>
                {latestReport.reviews.map((review) => (
                  <div key={review.id} className="rounded-md border border-line bg-paper p-3 text-sm">
                    <div className="font-medium text-ink">
                      {teacherDisplayName(review.reviewerTeacher)} · {review.decision === "PASS" ? "PASS" : "ขอแก้ไข"}
                    </div>
                    {review.comment ? <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0 text-muted" value={review.comment} /> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    );

    const action = !latestReport ? (
      <EmptyState title="ยังไม่มีเล่มรายงาน" description="ยังไม่มีฟอร์มตรวจจนกว่านักศึกษาจะส่งรายงานฉบับล่าสุด" />
    ) : project.status === "REPORT_REVIEW" && hasSubmittedCurrentReview ? (
      <div className="figma-readonly-note">
        <div className="font-semibold text-ink">บันทึกผลตรวจของท่านแล้ว</div>
        <p className="mt-1 text-muted">
          {previousReview?.decision === "PASS"
            ? "ท่านอนุมัติรายงานฉบับล่าสุดแล้ว กรุณารอผู้ตรวจท่านอื่นดำเนินการให้ครบ"
            : "ท่านขอให้นักศึกษาแก้ไขรายงานฉบับล่าสุดแล้ว กรุณารอรายงานฉบับแก้ไขก่อนตรวจอีกครั้ง"}
        </p>
        {previousReview?.comment ? (
          <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0 text-muted" value={previousReview.comment} />
        ) : null}
      </div>
    ) : project.status === "REPORT_REVIEW" && !latestReportHasRevisionRequest ? (
      <form action={reviewReportVersion} className="space-y-4 rounded-lg border border-line bg-paperSoft p-4">
        <input type="hidden" name="report_version_id" value={latestReport.id} />
        <div>
          <h3 className="text-sm font-semibold text-ink">ตรวจเล่มรายงานฉบับล่าสุด</h3>
          <p className="mt-1 text-sm leading-6 text-muted">ฟอร์มนี้ใช้ server action เดิมและผูกกับ report version ล่าสุดเท่านั้น</p>
        </div>
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
            confirmMessage="ยืนยันว่ารายงานฉบับนี้ผ่านการตรวจหรือไม่?"
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
    ) : latestReportHasRevisionRequest ? (
      <p className="figma-readonly-note">
        มีผู้ตรวจขอให้นักศึกษาแก้ไขเล่มรายงานแล้ว กรุณารอรายงานฉบับแก้ไขก่อนตรวจอีกครั้ง
      </p>
    ) : (
      <p className="figma-readonly-note">
        เล่มรายงานผ่านแล้ว หน้านี้จะแสดงประวัติเท่านั้น
      </p>
    );

    const hasEditableReportAction = Boolean(latestReport) && project.status === "REPORT_REVIEW" && !hasSubmittedCurrentReview && !latestReportHasRevisionRequest;

    return (
      <FigmaObjectDetail key={`${project.id}-figma`} id={`report-${project.id}`} density={hasEditableReportAction ? "form" : "display"} className="scroll-mt-24">
        {hasEditableReportAction ? (
          <FigmaReviewLayout context={context} action={action} />
        ) : (
          <div className="figma-readonly-detail">
            <div>{context}</div>
            {action}
          </div>
        )}
      </FigmaObjectDetail>
    );
  };

  if (uiMode === "figma") {
    return (
      <div className="figma-dashboard-page figma-teacher-reports">
        <FigmaPageHeader
          eyebrow="Report"
          title="ตรวจเล่มรายงาน"
          description="จัดคิวตรวจรายงานตามสถานะล่าสุด แยกงานที่ต้องทำ งานรอแก้ไข และประวัติที่อ่านย้อนหลังได้"
        />
        <ActionFeedback success={params.success} error={params.error} />

        <div className="figma-kpi-grid">
          <FigmaMetricCard label="ต้องดำเนินการ" value={reportQueueCount("action")} description="รายงานฉบับล่าสุดที่รอผลตรวจของท่าน" tone="action" />
          <FigmaMetricCard label="รอ" value={reportQueueCount("waiting")} description="ท่านตรวจแล้ว รอผู้ตรวจท่านอื่น" tone="waiting" />
          <FigmaMetricCard label="เสร็จแล้ว" value={reportQueueCount("completed")} description="ผ่านครบหรืออนุมัติแล้ว" tone="success" />
          <FigmaMetricCard label="ส่งกลับ" value={reportQueueCount("returned")} description="มีผู้ขอให้นักศึกษาแก้ไข" tone="warning" />
          <FigmaMetricCard label="ยังไม่พร้อม" value={reportQueueCount("locked")} description="ยังไม่มีเล่มล่าสุดให้ตรวจ" tone="muted" />
        </div>

        <FigmaPanel
          title="คิวตรวจเล่ม"
          description="เลือกโครงการเพื่อไปยังรายละเอียดรายงาน ฉบับล่าสุด ประวัติ และฟอร์มตรวจ"
          tone={projects.length ? "action" : "muted"}
        >
          {projects.length ? (
            <FigmaObjectSummaryList>
              {sortedProjects.map((project) => {
                const latestReport = project.reportVersions[0];
                const queueState = reportQueueStateByProjectId.get(project.id) ?? "waiting";
                return (
                  <a key={`${project.id}-figma-queue`} className="figma-action-row figma-report-row" data-tone={figmaReportTone(queueState)} href={`#report-${project.id}`}>
                    <div>
                      <strong>{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</strong>
                      <p>
                        {project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}
                      </p>
                      <small>{latestReport ? `ฉบับที่ ${latestReport.versionNo}` : "ยังไม่มีเล่มรายงาน"}</small>
                    </div>
                    <FigmaStatusBadge tone={figmaReportTone(queueState)}>{reportQueueLabels[queueState]}</FigmaStatusBadge>
                  </a>
                );
              })}
            </FigmaObjectSummaryList>
          ) : (
            <EmptyState
              title="ยังไม่มีเล่มรายงานที่ต้องตรวจ"
              description="รายการจะแสดงเมื่อมีโครงงานที่อยู่ระหว่างตรวจรายงานหรือรายงานผ่านแล้ว และท่านเป็นอาจารย์ที่ปรึกษาหรือกรรมการ"
            />
          )}
        </FigmaPanel>

        <FigmaPanel
          title="รายละเอียดรายงานและฟอร์มตรวจ"
          description="แสดงฉบับล่าสุด ประวัติการส่ง ผลตรวจเดิม และฟอร์มตัดสินใจโดยใช้ workflow เดิม"
          tone={projects.length ? "action" : "muted"}
        >
          <div className="space-y-4">
            {projects.length ? sortedProjects.map(renderFigmaReportProject) : (
              <EmptyState
                title="ยังไม่มีรายละเอียดรายงาน"
                description="เมื่อมีรายงานในความรับผิดชอบ รายละเอียดจะปรากฏในส่วนนี้"
              />
            )}
          </div>
        </FigmaPanel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ตรวจเล่มรายงาน"
        description="อาจารย์ที่ปรึกษา ประธานกรรมการ และกรรมการที่ได้รับแต่งตั้งสามารถอนุมัติหรือขอให้นักศึกษาแก้ไขรายงานได้"
      />
      <ActionFeedback success={params.success} error={params.error} />
      <GuidancePanel
        title="ขั้นตอนการตรวจรายงาน"
        current="ตรวจเฉพาะรายงานฉบับล่าสุดของโครงงานที่อยู่ระหว่างการตรวจรายงาน"
            next="ถ้าอาจารย์ที่ปรึกษาและกรรมการที่กำหนดอนุมัติครบ ระบบจะเปลี่ยนเป็นขั้นตอนบันทึกคะแนนสรุปของอาจารย์ที่ปรึกษา"
        actor="อาจารย์ที่ปรึกษา ประธานกรรมการ หรือกรรมการที่ได้รับแต่งตั้ง"
      />
      <TeacherWorkloadSummary
        metrics={[
          { label: "ต้องดำเนินการ", count: reportQueueCount("action"), tone: "action", description: "รายงานฉบับล่าสุดที่รอผลตรวจของท่าน" },
          { label: "รอ", count: reportQueueCount("waiting"), tone: "waiting", description: "ท่านตรวจแล้ว รอผู้ตรวจท่านอื่น" },
          { label: "เสร็จแล้ว", count: reportQueueCount("completed"), tone: "completed", description: "ผ่านครบหรืออนุมัติแล้ว" },
          { label: "ส่งกลับ", count: reportQueueCount("returned"), tone: "returned", description: "มีผู้ขอให้นักศึกษาแก้ไข" },
          { label: "ยังไม่พร้อม", count: reportQueueCount("locked"), tone: "locked", description: "ยังไม่มีเล่มล่าสุดให้ตรวจ" }
        ]}
      />

      <div className="space-y-4">
        {projects.length ? (
          sortedProjects.map((project) => {
            const latestReport = project.reportVersions[0];
            const previousReview = latestReport?.reviews.find((review) => review.reviewerTeacherId === teacher.id);
            const hasSubmittedCurrentReview = Boolean(previousReview);
            const requiredReviewerIds = requiredReportReviewerIds(project.committeeAssignments, project.advisorRequests);
            const allPassed = allRequiredReportReviewersPassed({ requiredReviewerIds, reviews: latestReport?.reviews ?? [] });
            const latestReportHasRevisionRequest = latestReport?.reviews.some((review) => review.decision === "FAIL") ?? false;
            const reportHistory = [...project.reportVersions].sort((a, b) => a.versionNo - b.versionNo);
            const latestReportNote = latestReport
              ? project.timelineEvents.find((event) => event.relatedEntityId === latestReport.id)?.eventDescription
              : null;
            const queueState = reportQueueStateByProjectId.get(project.id) ?? "waiting";

            return (
              <section key={project.id} className="panel teacher-review-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <TeacherQueueBadge tone={reportQueueTones[queueState]}>{reportQueueLabels[queueState]}</TeacherQueueBadge>
                    <StatusBadge status={project.status} />
                  </div>
                </div>

                {!latestReport ? (
                  <EmptyState title="ยังไม่มีเล่มรายงาน" description="เมื่อนักศึกษาส่งเล่ม รายการจะแสดงที่นี่" />
                ) : (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-md border border-line bg-paper p-3 text-sm">
                      <div className="font-medium">ฉบับที่ {latestReport.versionNo}</div>
                      <a className="mt-1 inline-block text-brand" href={latestReport.driveLink} target="_blank" rel="noreferrer">
                        เปิดลิงก์รายงาน
                      </a>
                      <p className="mt-2 text-muted">
                        สถานะตรวจ: {allPassed || project.status === "REPORT_APPROVED" ? "ผู้ตรวจอนุมัติครบแล้ว" : "รอผลตรวจ / รอแก้ไข"}
                      </p>
                    </div>

                    {latestReportNote ? (
                      <div className="rounded-md border border-line bg-surface p-3 text-sm">
                        <h3 className="font-semibold">สรุปการแก้ไข / ตอบกลับข้อเสนอแนะของผู้ตรวจจากนักศึกษา</h3>
                        <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0 text-muted" value={latestReportNote} />
                      </div>
                    ) : null}

                    {reportHistory.length > 1 ? (
                      <div className="rounded-md border border-line bg-paper p-3 text-sm">
                        <h3 className="font-semibold">ประวัติการส่งรายงาน</h3>
                        <div className="mt-2 space-y-2">
                          {reportHistory.map((version) => {
                            const note = project.timelineEvents.find((event) => event.relatedEntityId === version.id)?.eventDescription;
                            return (
                              <div key={version.id} className="rounded-md border border-line bg-surface p-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-medium">ฉบับที่ {version.versionNo}</span>
                                  <a className="text-brand" href={version.driveLink} target="_blank" rel="noreferrer">เปิดเล่ม</a>
                                </div>
                                {note ? <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0 text-muted" value={note} /> : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

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

                    {project.status === "REPORT_REVIEW" && hasSubmittedCurrentReview ? (
                      <div className="rounded-md border border-line bg-paper p-3 text-sm">
                        <div className="font-semibold text-ink">บันทึกผลตรวจของท่านแล้ว</div>
                        <p className="mt-1 text-muted">
                          {previousReview?.decision === "PASS"
                            ? "ท่านอนุมัติรายงานฉบับล่าสุดแล้ว กรุณารอผู้ตรวจท่านอื่นดำเนินการให้ครบ"
                            : "ท่านขอให้นักศึกษาแก้ไขรายงานฉบับล่าสุดแล้ว กรุณารอรายงานฉบับแก้ไขก่อนตรวจอีกครั้ง"}
                        </p>
                        {previousReview?.comment ? (
                          <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0 text-muted" value={previousReview.comment} />
                        ) : null}
                      </div>
                    ) : project.status === "REPORT_REVIEW" && !latestReportHasRevisionRequest ? (
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
                            confirmMessage="ยืนยันว่ารายงานฉบับนี้ผ่านการตรวจหรือไม่?"
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
                    ) : latestReportHasRevisionRequest ? (
                      <p className="rounded-md border border-line bg-paper p-3 text-sm text-muted">
                        มีผู้ตรวจขอให้นักศึกษาแก้ไขเล่มรายงานแล้ว กรุณารอรายงานฉบับแก้ไขก่อนตรวจอีกครั้ง
                      </p>
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
            description="รายการจะแสดงเมื่อมีโครงงานที่อยู่ระหว่างตรวจรายงานหรือรายงานผ่านแล้ว และท่านเป็นอาจารย์ที่ปรึกษาหรือกรรมการ"
          />
        )}
      </div>
    </div>
  );
}
