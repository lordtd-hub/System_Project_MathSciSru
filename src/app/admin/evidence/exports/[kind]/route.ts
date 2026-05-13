import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  courseGradeExportCsvRows,
  courseGradeExportHeaders,
  getEvidenceDashboardData,
  getCourseGradeExportRows,
  projectEvidenceCsvRows,
  projectEvidenceHeaders
} from "@/lib/evidence/adminEvidence";
import { evidenceFileName, toCsv, type CsvValue } from "@/lib/evidence/csv";
import { toXlsxBuffer } from "@/lib/evidence/xlsx";
import { checkRateLimit, pilotRateLimits } from "@/lib/security/rateLimit";
import { requestSizeLimits, textByteLength } from "@/lib/security/requestSize";

const exportKinds = ["projects", "timeline", "scores", "reports", "audit", "grades"] as const;
type ExportKind = (typeof exportKinds)[number];
type ExportFormat = "csv" | "xlsx";

function exportResponse(prefix: string, headers: string[], rows: CsvValue[][], format: ExportFormat) {
  if (format === "xlsx") {
    const buffer = toXlsxBuffer(headers, rows, prefix.replace(/^evidence-/, ""));
    const body = Uint8Array.from(buffer);
    return new Response(body, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${evidenceFileName(prefix, new Date(), "xlsx")}"`,
        "cache-control": "no-store"
      }
    });
  }

  return new Response(toCsv(headers, rows), {
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

function getExportFormat(value: string | null): ExportFormat | null {
  if (!value) return "csv";
  if (value === "csv" || value === "xlsx") return value;
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string }> }
) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return new Response("Forbidden", { status: 403 });
  }
  const limit = checkRateLimit(`admin:${session.user.id ?? "unknown"}:evidence-export`, pilotRateLimits.importExport);
  if (!limit.allowed) {
    return new Response("Too many export requests", { status: 429 });
  }

  const { kind } = await params;
  if (!isExportKind(kind)) {
    return new Response("Unknown evidence export", { status: 404 });
  }

  const url = new URL(request.url);
  const courseOfferingId = url.searchParams.get("course_offering_id") ?? undefined;
  if (courseOfferingId && textByteLength(courseOfferingId) > requestSizeLimits.queryParamBytes) {
    return new Response("Invalid course offering filter", { status: 400 });
  }
  const format = getExportFormat(url.searchParams.get("format"));
  if (!format) {
    return new Response("Unknown evidence export format", { status: 400 });
  }

  if (kind === "audit") {
    const logs = await prisma.auditLog.findMany({
      orderBy: { occurredAt: "desc" },
      include: { actor: true }
    });
    return exportResponse(
      "evidence-audit",
      ["audit_id", "scope", "action", "entity_type", "entity_id", "actor", "occurred_at"],
      logs.map((log) => [
        log.id,
        "global",
        log.action,
        log.entityType,
        log.entityId,
        log.actor?.name ?? log.actor?.email ?? "ระบบ",
        log.occurredAt
      ]),
      format
    );
  }

  const data = await getEvidenceDashboardData(courseOfferingId);
  if (data.invalidCourseOfferingId) {
    return new Response("Unknown course offering", { status: 404 });
  }
  const selectedOfferingId = data.selectedOffering?.id;

  if (kind === "projects") {
    return exportResponse("evidence-projects", projectEvidenceHeaders, projectEvidenceCsvRows(data.projectRows), format);
  }

  if (kind === "grades") {
    const rows = selectedOfferingId ? await getCourseGradeExportRows(selectedOfferingId) : [];
    return exportResponse("grade-summary", courseGradeExportHeaders, courseGradeExportCsvRows(rows), format);
  }

  if (kind === "scores") {
    return exportResponse(
      "evidence-scores",
      ["round_type", "round_label", "rubric_name", "rubric_item_count", "rubric_attributed_score_submission_count", "rubric_attributed_score_item_count", "evaluator_count", "average_score"],
      data.rubricRows.map((row) => [
        row.roundType,
        row.roundLabel,
        row.rubricName,
        row.rubricItemCount,
        row.scoreSubmissionCount,
        row.scoreItemCount,
        row.evaluatorCount,
        row.averageScore ?? ""
      ]),
      format
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
    return exportResponse(
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
      ]),
      format
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
    return exportResponse(
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
      }),
      format
    );
  }

  return new Response("Unknown evidence export", { status: 404 });
}
