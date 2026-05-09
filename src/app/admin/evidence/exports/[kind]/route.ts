import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  getEvidenceDashboardData,
  projectEvidenceCsvRows,
  projectEvidenceHeaders
} from "@/lib/evidence/adminEvidence";
import { evidenceFileName, toCsv, type CsvValue } from "@/lib/evidence/csv";

const exportKinds = ["projects", "timeline", "scores", "reports", "audit"] as const;
type ExportKind = (typeof exportKinds)[number];

function csvResponse(prefix: string, headers: string[], rows: CsvValue[][]) {
  const csv = toCsv(headers, rows);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${evidenceFileName(prefix)}"`,
      "cache-control": "no-store"
    }
  });
}

function isExportKind(value: string): value is ExportKind {
  return exportKinds.includes(value as ExportKind);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string }> }
) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return new Response("Forbidden", { status: 403 });
  }

  const { kind } = await params;
  if (!isExportKind(kind)) {
    return new Response("Unknown evidence export", { status: 404 });
  }

  const url = new URL(request.url);
  const courseOfferingId = url.searchParams.get("course_offering_id") ?? undefined;
  const data = await getEvidenceDashboardData(courseOfferingId);
  const selectedOfferingId = data.selectedOffering?.id;

  if (kind === "projects") {
    return csvResponse("evidence-projects", projectEvidenceHeaders, projectEvidenceCsvRows(data.projectRows));
  }

  if (kind === "scores") {
    return csvResponse(
      "evidence-scores",
      ["round_type", "round_label", "rubric_name", "rubric_item_count", "score_submission_count", "score_item_count", "evaluator_count", "average_score"],
      data.rubricRows.map((row) => [
        row.roundType,
        row.roundLabel,
        row.rubricName,
        row.rubricItemCount,
        row.scoreSubmissionCount,
        row.scoreItemCount,
        row.evaluatorCount,
        row.averageScore ?? ""
      ])
    );
  }

  if (kind === "timeline") {
    const events = selectedOfferingId
      ? await prisma.projectTimelineEvent.findMany({
          where: { project: { courseOfferingId: selectedOfferingId } },
          orderBy: { occurredAt: "desc" },
          include: { actor: true, project: { include: { student: true } } }
        })
      : [];
    return csvResponse(
      "evidence-timeline",
      ["event_id", "project_id", "student_code", "project_title", "event_type", "event_title", "event_description", "actor", "occurred_at", "related_entity_type", "related_entity_id"],
      events.map((event) => [
        event.id,
        event.projectId,
        event.project.student.studentCode,
        event.project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ",
        event.eventType,
        event.eventTitle,
        event.eventDescription ?? "",
        event.actor?.name ?? event.actor?.email ?? "ระบบ",
        event.occurredAt,
        event.relatedEntityType ?? "",
        event.relatedEntityId ?? ""
      ])
    );
  }

  if (kind === "reports") {
    const versions = selectedOfferingId
      ? await prisma.reportVersion.findMany({
          where: { project: { courseOfferingId: selectedOfferingId } },
          orderBy: [{ submittedAt: "desc" }],
          include: {
            project: { include: { student: true } },
            submittedByStudent: true,
            reviews: { include: { reviewerTeacher: true }, orderBy: { reviewedAt: "desc" } }
          }
        })
      : [];
    return csvResponse(
      "evidence-reports",
      ["report_version_id", "project_id", "student_code", "project_title", "version_no", "drive_link", "submitted_at", "reviewer", "decision", "reviewed_at", "comment"],
      versions.flatMap((version) => {
        if (!version.reviews.length) {
          return [[
            version.id,
            version.projectId,
            version.project.student.studentCode,
            version.project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ",
            version.versionNo,
            version.driveLink,
            version.submittedAt,
            "",
            "ยังไม่มี review",
            "",
            ""
          ]];
        }
        return version.reviews.map((review) => [
          version.id,
          version.projectId,
          version.project.student.studentCode,
          version.project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ",
          version.versionNo,
          version.driveLink,
          version.submittedAt,
          `${review.reviewerTeacher.academicPrefix}${review.reviewerTeacher.firstNameTh} ${review.reviewerTeacher.lastNameTh}`,
          review.decision,
          review.reviewedAt,
          review.comment ?? ""
        ]);
      })
    );
  }

  const logs = await prisma.auditLog.findMany({
    orderBy: { occurredAt: "desc" },
    include: { actor: true }
  });
  return csvResponse(
    "evidence-audit",
    ["audit_id", "action", "entity_type", "entity_id", "actor", "occurred_at"],
    logs.map((log) => [
      log.id,
      log.action,
      log.entityType,
      log.entityId,
      log.actor?.name ?? log.actor?.email ?? "ระบบ",
      log.occurredAt
    ])
  );
}
