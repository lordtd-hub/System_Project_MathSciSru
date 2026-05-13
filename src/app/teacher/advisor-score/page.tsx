import { auth } from "@/auth";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { submitAdvisorScore } from "@/app/teacher/actions";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { MarkdownLatexEditor } from "@/components/ui/MarkdownLatexEditor";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TeacherQueueBadge, TeacherWorkloadSummary } from "@/components/ui/TeacherWorkloadQueue";
import { FigmaMetricCard, FigmaPageHeader, FigmaPanel, FigmaReviewLayout, FigmaStatusBadge } from "@/components/redesign/VisualSurfaces";
import { prisma } from "@/lib/db";
import { formatThaiDateTime24 } from "@/lib/format/dateTime";
import { advisorCriteria } from "@/lib/scoring/advisorScoring";
import { getUiMode } from "@/lib/uiMode";

function fieldName(key: string) {
  if (key === "researchProcess") return "research_process";
  if (key === "problemSolving") return "problem_solving";
  return key;
}

function previousValue(score: {
  responsibilityScore: number | null;
  researchProcessScore: number | null;
  problemSolvingScore: number | null;
  communicationScore: number | null;
  professionalismScore: number | null;
} | null | undefined, key: string) {
  if (!score) return 0;
  if (key === "responsibility") return score.responsibilityScore ?? 0;
  if (key === "researchProcess") return score.researchProcessScore ?? 0;
  if (key === "problemSolving") return score.problemSolvingScore ?? 0;
  if (key === "communication") return score.communicationScore ?? 0;
  if (key === "professionalism") return score.professionalismScore ?? 0;
  return 0;
}

function advisorScoreSummary(score: {
  responsibilityScore: number | null;
  researchProcessScore: number | null;
  problemSolvingScore: number | null;
  communicationScore: number | null;
  professionalismScore: number | null;
}) {
  return [
    { label: "ความรับผิดชอบและตรงต่อเวลา", value: score.responsibilityScore, max: 25 },
    { label: "กระบวนการทำงานวิจัยและความเป็นอิสระ", value: score.researchProcessScore, max: 25 },
    { label: "การแก้ปัญหาและการปรับปรุงงาน", value: score.problemSolvingScore, max: 25 },
    { label: "การสื่อสารกับอาจารย์ที่ปรึกษา", value: score.communicationScore, max: 15 },
    { label: "ความเป็นมืออาชีพโดยรวม", value: score.professionalismScore, max: 10 }
  ];
}

export default async function TeacherAdvisorScorePage({
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
    return <EmptyState title="ยังไม่พบโปรไฟล์อาจารย์" description="กรุณาส่งคำขอผูกบัญชีกับโปรไฟล์อาจารย์และรอผู้ดูแลระบบอนุมัติก่อนใช้งาน" />;
  }

  const params = (await searchParams) ?? {};
  const uiMode = await getUiMode();
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { advisorRequests: { some: { advisorTeacherId: teacher.id, status: "APPROVED" } } },
        { committeeAssignments: { some: { teacherId: teacher.id, active: true, role: "ADVISOR" } } }
      ],
      status: { in: ["FINAL_DONE", "REPORT_REVIEW", "REPORT_APPROVED", "ADVISOR_SCORING", "COMPLETED"] }
    },
    include: {
      student: true,
      reportVersions: { include: { reviews: true }, orderBy: { versionNo: "desc" } },
      advisorScore: true
    },
    orderBy: { updatedAt: "desc" }
  });
  const advisorQueueOrder = { action: 0, waiting: 1, completed: 2, locked: 3 } as const;
  const advisorQueueLabels = {
    action: "ต้องดำเนินการ",
    waiting: "รอเงื่อนไข",
    completed: "เสร็จแล้ว",
    locked: "ยังไม่พร้อม"
  } as const;
  const advisorQueueTones = {
    action: "action",
    waiting: "waiting",
    completed: "completed",
    locked: "locked"
  } as const;
  const advisorQueueItems = projects.map((project) => {
    const submitted = project.advisorScore?.status === "SUBMITTED" && project.advisorScore.score != null;
    const editable = !submitted && (project.status === "REPORT_APPROVED" || project.status === "ADVISOR_SCORING");
    if (submitted) return { projectId: project.id, state: "completed" as const };
    if (editable) return { projectId: project.id, state: "action" as const };
    if (project.status === "REPORT_REVIEW") return { projectId: project.id, state: "waiting" as const };
    return { projectId: project.id, state: "locked" as const };
  });
  const advisorQueueStateByProjectId = new Map(advisorQueueItems.map((item) => [item.projectId, item.state]));
  const sortedProjects = [...projects].sort((a, b) => {
    const stateA = advisorQueueStateByProjectId.get(a.id) ?? "locked";
    const stateB = advisorQueueStateByProjectId.get(b.id) ?? "locked";
    return advisorQueueOrder[stateA] - advisorQueueOrder[stateB];
  });
  const advisorQueueCount = (state: (typeof advisorQueueItems)[number]["state"]) =>
    advisorQueueItems.filter((item) => item.state === state).length;
  const figmaAdvisorTone = (state: (typeof advisorQueueItems)[number]["state"]) => {
    if (state === "action") return "action" as const;
    if (state === "waiting") return "waiting" as const;
    if (state === "completed") return "success" as const;
    return "muted" as const;
  };

  const renderFigmaAdvisorProject = (project: (typeof projects)[number]) => {
    const previous = project.advisorScore;
    const submitted = previous?.status === "SUBMITTED" && previous.score != null;
    const editable = !submitted && (project.status === "REPORT_APPROVED" || project.status === "ADVISOR_SCORING");
    const latestReport = project.reportVersions[0];
    const queueState = advisorQueueStateByProjectId.get(project.id) ?? "locked";

    const context = (
      <div className="space-y-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <FigmaStatusBadge tone={figmaAdvisorTone(queueState)}>{advisorQueueLabels[queueState]}</FigmaStatusBadge>
            <FigmaStatusBadge tone="muted">Advisor Score</FigmaStatusBadge>
            <StatusBadge status={project.status} />
          </div>
          <h2 className="mt-3 text-lg font-semibold text-ink">{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            {project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}
          </p>
        </div>

        <div className="rounded-md border border-line bg-paper p-3 text-sm text-muted">
          รายงาน: {latestReport ? `ฉบับที่ ${latestReport.versionNo}` : "ยังไม่มีเล่มรายงาน"} · คะแนนที่ปรึกษา:{" "}
          {previous?.status === "SUBMITTED" ? `บันทึกแล้ว ${Number(previous.score ?? 0)}/100` : editable ? "พร้อมบันทึก" : "ยังล็อก"}
        </div>

        {submitted ? (
          <div className="space-y-3 rounded-md border border-line bg-paper p-3 text-sm">
            <div>
              <div className="font-semibold text-ink">บันทึกคะแนนสรุปแล้ว</div>
              <p className="mt-1 text-muted">
                คะแนนรวม {Number(previous.score ?? 0)}/100
                {previous.submittedAt ? ` · ${formatThaiDateTime24(previous.submittedAt)}` : ""}
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {advisorScoreSummary(previous).map((item) => (
                <div key={item.label} className="rounded-md border border-line bg-surface p-2">
                  <div className="font-medium text-ink">{item.label}</div>
                  <div className="mt-1 text-muted">{item.value ?? 0}/{item.max}</div>
                </div>
              ))}
            </div>
            {previous.comment ? (
              <div className="rounded-md border border-line bg-surface p-3">
                <div className="font-semibold text-ink">ข้อเสนอแนะสำหรับนักศึกษา</div>
                <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0 text-muted" value={previous.comment} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );

    const action = submitted ? (
      <div className="rounded-lg border border-line bg-paperSoft p-4 text-sm text-muted">
        บันทึกคะแนนสรุปแล้ว หน้านี้แสดงผลอ่านย้อนหลังเท่านั้น
      </div>
    ) : !editable ? (
      <div className="rounded-lg border border-line bg-paperSoft p-4 text-sm text-muted">
        ยังไม่สามารถบันทึกคะแนนสรุปของอาจารย์ที่ปรึกษาได้ ต้องรอให้เล่มรายงานผ่านการตรวจก่อน
      </div>
    ) : (
      <form action={submitAdvisorScore} className="space-y-4 rounded-lg border border-line bg-paperSoft p-4">
        <input type="hidden" name="project_id" value={project.id} />
        <div>
          <h3 className="text-sm font-semibold text-ink">บันทึกคะแนนสรุป 25%</h3>
          <p className="mt-1 text-sm leading-6 text-muted">ใช้เกณฑ์และ server action เดิม เปลี่ยนเฉพาะการจัดวางให้ตรวจอ่านง่ายขึ้น</p>
        </div>
        <div className="rounded-md border border-line bg-paper p-3">
          <h3 className="text-sm font-semibold text-ink">เกณฑ์คะแนนสรุปของอาจารย์ที่ปรึกษา</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {advisorCriteria.map((criterion) => (
              <label key={criterion.key} className="rounded-md border border-line bg-surface p-3 text-sm">
                <span className="font-medium">{criterion.labelTh}</span>
                <span className="ml-2 text-xs text-muted">{criterion.labelEn}</span>
                <span className="ml-2 text-muted">เต็ม {criterion.max}</span>
                <input
                  className="mt-2"
                  name={fieldName(criterion.key)}
                  type="number"
                  min="0"
                  max={criterion.max}
                  step="1"
                  defaultValue={previousValue(previous, criterion.key)}
                  required
                />
              </label>
            ))}
          </div>
        </div>
        <MarkdownLatexEditor name="comment" label="ข้อเสนอแนะสำหรับนักศึกษา" defaultValue={previous?.comment ?? ""} rows={4} required={false} />
        <SubmitButton pendingText="กำลังบันทึกคะแนน..." confirmMessage="ยืนยันการบันทึกคะแนนสรุปของอาจารย์ที่ปรึกษา 25% หรือไม่?">
          บันทึกคะแนนสรุป 25%
        </SubmitButton>
      </form>
    );

    return (
      <section key={`${project.id}-figma`} id={`advisor-score-${project.id}`} className="scroll-mt-24 rounded-lg border border-line bg-surface p-4 shadow-sm">
        <FigmaReviewLayout context={context} action={action} />
      </section>
    );
  };

  if (uiMode === "figma") {
    return (
      <div className="figma-dashboard-page figma-teacher-advisor-score">
        <FigmaPageHeader
          eyebrow="Advisor Score"
          title="คะแนนสรุปของอาจารย์ที่ปรึกษา 25%"
          description="แยกโครงการที่พร้อมให้คะแนน โครงการที่ยังรอเงื่อนไข และรายการที่บันทึกแล้ว โดยคง unlock logic เดิม"
        />
        <ActionFeedback success={params.success} error={params.error} />

        <div className="figma-kpi-grid">
          <FigmaMetricCard label="ต้องดำเนินการ" value={advisorQueueCount("action")} description="พร้อมบันทึกคะแนนที่ปรึกษา" tone="action" />
          <FigmaMetricCard label="รอ" value={advisorQueueCount("waiting")} description="รอรายงานผ่านครบก่อน" tone="waiting" />
          <FigmaMetricCard label="เสร็จแล้ว" value={advisorQueueCount("completed")} description="ส่งคะแนนแล้ว อ่านย้อนหลังได้" tone="success" />
          <FigmaMetricCard label="ส่งกลับ" value={0} description="ไม่ใช้กับคะแนนที่ปรึกษา" tone="muted" />
          <FigmaMetricCard label="ยังไม่พร้อม" value={advisorQueueCount("locked")} description="ยังไม่ถึงขั้นตอนบันทึกคะแนน" tone="muted" />
        </div>

        <FigmaPanel
          title="คิวคะแนนที่ปรึกษา"
          description="เลือกโครงการเพื่อดูรายงานล่าสุด สถานะ unlock และฟอร์มบันทึกคะแนน"
          tone={projects.length ? "action" : "muted"}
        >
          {projects.length ? (
            <div className="figma-action-list">
              {sortedProjects.map((project) => {
                const latestReport = project.reportVersions[0];
                const queueState = advisorQueueStateByProjectId.get(project.id) ?? "locked";
                return (
                  <a key={`${project.id}-figma-queue`} className="figma-action-row figma-advisor-score-row" data-tone={figmaAdvisorTone(queueState)} href={`#advisor-score-${project.id}`}>
                    <div>
                      <strong>{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</strong>
                      <p>
                        {project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}
                      </p>
                      <small>{latestReport ? `รายงานฉบับที่ ${latestReport.versionNo}` : "ยังไม่มีเล่มรายงาน"}</small>
                    </div>
                    <FigmaStatusBadge tone={figmaAdvisorTone(queueState)}>{advisorQueueLabels[queueState]}</FigmaStatusBadge>
                  </a>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="ยังไม่มีโครงการที่เป็นที่ปรึกษา"
              description="รายการจะแสดงเมื่อท่านเป็นอาจารย์ที่ปรึกษาของโครงการที่เข้าสู่ช่วงตรวจรายงานหรือบันทึกคะแนนสรุป"
            />
          )}
        </FigmaPanel>

        <FigmaPanel
          title="รายละเอียดและฟอร์มคะแนน"
          description="แสดงสถานะรายงานล่าสุด คะแนนที่บันทึกแล้ว หรือฟอร์มคะแนนเมื่อผ่านเงื่อนไข"
          tone={projects.length ? "action" : "muted"}
        >
          <div className="space-y-4">
            {projects.length ? sortedProjects.map(renderFigmaAdvisorProject) : (
              <EmptyState
                title="ยังไม่มีรายละเอียดคะแนนที่ปรึกษา"
                description="เมื่อมีโครงการในความรับผิดชอบ รายละเอียดจะแสดงในส่วนนี้"
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
        title="คะแนนสรุปของอาจารย์ที่ปรึกษา 25%"
        description="บันทึกคะแนนสรุปของอาจารย์ที่ปรึกษาหลังเล่มรายงานผ่านการตรวจแล้ว ระบบยังไม่ยืนยันจบโครงงานในขั้นตอนนี้"
      />
      <ActionFeedback success={params.success} error={params.error} />
      <GuidancePanel
        title="คะแนนสรุปของอาจารย์ที่ปรึกษา"
        current="เปิดให้บันทึกเมื่อรายงานฉบับสมบูรณ์ผ่านการตรวจแล้ว"
        next="เมื่อบันทึกแล้ว โครงงานจะรอผู้ดูแลระบบตรวจเงื่อนไขและยืนยันจบโครงงาน"
        actor="อาจารย์ที่ปรึกษาของโครงงานเท่านั้น"
      />
      <TeacherWorkloadSummary
        metrics={[
          { label: "ต้องดำเนินการ", count: advisorQueueCount("action"), tone: "action", description: "พร้อมบันทึกคะแนนที่ปรึกษา" },
          { label: "รอ", count: advisorQueueCount("waiting"), tone: "waiting", description: "รอรายงานผ่านครบก่อน" },
          { label: "เสร็จแล้ว", count: advisorQueueCount("completed"), tone: "completed", description: "ส่งคะแนนแล้ว อ่านย้อนหลังได้" },
          { label: "ส่งกลับ", count: 0, tone: "returned", description: "ไม่ใช้กับคะแนนที่ปรึกษา" },
          { label: "ยังไม่พร้อม", count: advisorQueueCount("locked"), tone: "locked", description: "ยังไม่ถึงขั้นตอนบันทึกคะแนน" }
        ]}
      />

      <div className="space-y-4">
        {projects.length ? (
          sortedProjects.map((project) => {
            const previous = project.advisorScore;
            const submitted = previous?.status === "SUBMITTED" && previous.score != null;
            const editable = !submitted && (project.status === "REPORT_APPROVED" || project.status === "ADVISOR_SCORING");
            const latestReport = project.reportVersions[0];
            const queueState = advisorQueueStateByProjectId.get(project.id) ?? "locked";
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
                    <TeacherQueueBadge tone={advisorQueueTones[queueState]}>{advisorQueueLabels[queueState]}</TeacherQueueBadge>
                    <StatusBadge status={project.status} />
                  </div>
                </div>

                <div className="mt-3 rounded-md border border-line bg-paper p-3 text-sm text-muted">
                  รายงาน: {latestReport ? `ฉบับที่ ${latestReport.versionNo}` : "ยังไม่มีเล่มรายงาน"} · คะแนนที่ปรึกษา:{" "}
                  {previous?.status === "SUBMITTED" ? `บันทึกแล้ว ${Number(previous.score ?? 0)}/100` : editable ? "พร้อมบันทึก" : "ยังล็อก"}
                </div>

                {submitted ? (
                  <div className="mt-4 space-y-4 rounded-md border border-line bg-paper p-3 text-sm">
                    <div>
                      <div className="font-semibold text-ink">บันทึกคะแนนสรุปแล้ว</div>
                      <p className="mt-1 text-muted">
                        คะแนนรวม {Number(previous.score ?? 0)}/100
                        {previous.submittedAt ? ` · ${formatThaiDateTime24(previous.submittedAt)}` : ""}
                      </p>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {advisorScoreSummary(previous).map((item) => (
                        <div key={item.label} className="rounded-md border border-line bg-surface p-2">
                          <div className="font-medium">{item.label}</div>
                          <div className="mt-1 text-muted">{item.value ?? 0}/{item.max}</div>
                        </div>
                      ))}
                    </div>
                    {previous.comment ? (
                      <div className="rounded-md border border-line bg-surface p-3">
                        <div className="font-semibold text-ink">ข้อเสนอแนะสำหรับนักศึกษา</div>
                        <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0 text-muted" value={previous.comment} />
                      </div>
                    ) : null}
                  </div>
                ) : !editable ? (
                  <div className="mt-4 rounded-md border border-line p-3 text-sm text-muted">
                    ยังไม่สามารถบันทึกคะแนนสรุปของอาจารย์ที่ปรึกษาได้ ต้องรอให้เล่มรายงานผ่านการตรวจก่อน
                  </div>
                ) : (
                  <form action={submitAdvisorScore} className="mt-4 space-y-4">
                    <input type="hidden" name="project_id" value={project.id} />
                    <div className="rounded-md border border-line bg-paper p-3">
                      <h3 className="text-sm font-semibold">เกณฑ์คะแนนสรุปของอาจารย์ที่ปรึกษา</h3>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {advisorCriteria.map((criterion) => (
                          <label key={criterion.key} className="rounded-md border border-line bg-surface p-3 text-sm">
                            <span className="font-medium">{criterion.labelTh}</span>
                            <span className="ml-2 text-xs text-muted">{criterion.labelEn}</span>
                            <span className="ml-2 text-muted">เต็ม {criterion.max}</span>
                            <input
                              className="mt-2"
                              name={fieldName(criterion.key)}
                              type="number"
                              min="0"
                              max={criterion.max}
                              step="1"
                              defaultValue={previousValue(previous, criterion.key)}
                              required
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                    <MarkdownLatexEditor name="comment" label="ข้อเสนอแนะสำหรับนักศึกษา" defaultValue={previous?.comment ?? ""} rows={4} required={false} />
                    <div>
                      <SubmitButton pendingText="กำลังบันทึกคะแนน..." confirmMessage="ยืนยันการบันทึกคะแนนสรุปของอาจารย์ที่ปรึกษา 25% หรือไม่?">
                        บันทึกคะแนนสรุป 25%
                      </SubmitButton>
                    </div>
                  </form>
                )}
              </section>
            );
          })
        ) : (
          <EmptyState
            title="ยังไม่มีโครงงานที่เป็นที่ปรึกษา"
            description="รายการจะแสดงเมื่อท่านเป็นอาจารย์ที่ปรึกษาของโครงงานที่เข้าสู่ช่วงตรวจรายงานหรือบันทึกคะแนนสรุป"
          />
        )}
      </div>
    </div>
  );
}
