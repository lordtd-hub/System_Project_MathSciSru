import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  deliverExamScheduleExternalNotification,
  saveAssessmentEvidenceAtomic,
  submitExamScheduleAtomic,
  submitReportVersionAtomic,
  type AssessmentEvidenceInput,
  type ExamScheduleInput,
  type FutureStageMutationContext,
  type ReportVersionInput
} from "./studentFutureStageMutations";

const context: FutureStageMutationContext = {
  userId: "user-1",
  studentId: "student-1",
  projectId: "project-1",
  studentCode: "650000001",
  studentFirstNameTh: "ทดสอบ",
  studentLastNameTh: "ระบบ"
};

function transactionalHarness<T extends object>(
  initial: T,
  createTx: (read: () => T) => object
) {
  let state = structuredClone(initial);
  const read = () => state;
  const tx = createTx(read);
  const db = {
    $transaction: vi.fn(async (operation: (client: object) => Promise<unknown>) => {
      const before = structuredClone(state);
      try {
        return await operation(tx);
      } catch (error) {
        state = before;
        throw error;
      }
    })
  } as unknown as Pick<PrismaClient, "$transaction">;
  return { db, read };
}

const evidenceInput: AssessmentEvidenceInput = {
  kind: "PROGRESS_1",
  roundType: "PROGRESS_1",
  title: "หลักฐานรอบที่ 1",
  materialLink: "https://drive.google.com/file/d/evidence",
  contentJson: {
    progressPlanTasks: "งานตามแผน",
    progressEvidence: "หลักฐาน",
    progressStatus: "เสร็จแล้ว",
    progressChallengesNext: "ขั้นตอนถัดไป",
    summary: "งานตามแผน\n\nหลักฐาน\n\nเสร็จแล้ว\n\nขั้นตอนถัดไป"
  },
  summary: "งานตามแผน\n\nหลักฐาน\n\nเสร็จแล้ว\n\nขั้นตอนถัดไป"
};

describe("student future-stage atomic persistence", () => {
  it("rolls assessment evidence and timeline back together, then treats the committed retry as unchanged", async () => {
    const initial = {
      project: { id: context.projectId, courseOfferingId: "course-1", status: "IN_PROGRESS", currentTitleTh: "หัวข้อ" },
      submission: null as Record<string, unknown> | null,
      timeline: [] as unknown[]
    };
    const harness = transactionalHarness(initial, (read) => ({
      $queryRaw: vi.fn(async () => [{ id: context.projectId }]),
      project: { findUnique: vi.fn(async () => ({ ...read().project })) },
      assessmentSubmission: {
        findFirst: vi.fn(async () => read().submission),
        create: vi.fn(async ({ data }) => {
          read().submission = { id: "evidence-1", ...data };
          return read().submission;
        }),
        update: vi.fn(async ({ data }) => {
          read().submission = { ...read().submission, ...data };
          return read().submission;
        })
      },
      assessmentRound: { findUnique: vi.fn(async () => ({ id: "round-1", status: "SUBMISSION_OPEN" })) },
      projectRoundException: { findMany: vi.fn(async () => []) },
      examScheduleProposal: { findFirst: vi.fn(async () => null) },
      projectTimelineEvent: { create: vi.fn(async ({ data }) => read().timeline.push(data)) },
      proposalResult: undefined,
      projectProposalResult: { findFirst: vi.fn(async () => ({ finalDecision: "PASS" })) },
      assessmentAttempt: { findFirst: vi.fn(async () => null) },
      committeeAssignment: {
        findMany: vi.fn(async () => [
          { role: "ADVISOR", active: true, teacherId: "advisor" },
          { role: "HEAD", active: true, teacherId: "head" },
          { role: "MEMBER", active: true, teacherId: "member" }
        ])
      }
    }));

    await expect(saveAssessmentEvidenceAtomic(
      harness.db,
      context,
      evidenceInput,
      { fault: (point) => { if (point === "assessment_submission_saved") throw new Error("fault"); } }
    )).rejects.toThrow("fault");
    expect(harness.read()).toEqual(initial);

    const committed = await saveAssessmentEvidenceAtomic(harness.db, context, evidenceInput);
    const retry = await saveAssessmentEvidenceAtomic(harness.db, context, evidenceInput);

    expect(committed.unchanged).toBe(false);
    expect(retry).toMatchObject({ unchanged: true, submissionId: "evidence-1" });
    expect(harness.read().timeline).toHaveLength(1);
  });

  it.each([
    { label: "PASS after Re-proposal", decision: "PASS", attemptNo: 2, submissionStatus: "LOCKED", allowed: true },
    { label: "certified PASS_WITH_REVISION after a third attempt", decision: "PASS_WITH_REVISION", attemptNo: 3, submissionStatus: "LOCKED", allowed: true },
    { label: "uncertified PASS_WITH_REVISION after a third attempt", decision: "PASS_WITH_REVISION", attemptNo: 3, submissionStatus: "SUBMITTED", allowed: false },
    { label: "NOT_PASS after a third attempt", decision: "NOT_PASS", attemptNo: 3, submissionStatus: "SUBMITTED", allowed: false }
  ] as const)("applies the latest Proposal outcome before Progress 1 evidence: $label", async ({
    decision,
    attemptNo,
    submissionStatus,
    allowed
  }) => {
    const initial = {
      project: { id: context.projectId, courseOfferingId: "course-1", status: "IN_PROGRESS", currentTitleTh: "หัวข้อ" },
      submission: null as Record<string, unknown> | null,
      timeline: [] as unknown[]
    };
    const latestProposalAttempt = vi.fn(async () => ({
      attemptNo,
      status: "SCORING_CLOSED",
      assessmentRound: { roundType: "PROPOSAL" },
      presentationSubmission: { status: submissionStatus },
      evaluatorAssignments: []
    }));
    const harness = transactionalHarness(initial, (read) => ({
      $queryRaw: vi.fn(async () => [{ id: context.projectId }]),
      project: { findUnique: vi.fn(async () => ({ ...read().project })) },
      assessmentSubmission: {
        findFirst: vi.fn(async () => read().submission),
        create: vi.fn(async ({ data }) => {
          read().submission = { id: "evidence-1", ...data };
          return read().submission;
        }),
        update: vi.fn(async ({ data }) => {
          read().submission = { ...read().submission, ...data };
          return read().submission;
        })
      },
      assessmentRound: { findUnique: vi.fn(async () => ({ id: "round-1", status: "SUBMISSION_OPEN" })) },
      projectRoundException: { findMany: vi.fn(async () => []) },
      examScheduleProposal: { findFirst: vi.fn(async () => null) },
      projectTimelineEvent: { create: vi.fn(async ({ data }) => read().timeline.push(data)) },
      projectProposalResult: { findFirst: vi.fn(async () => ({ finalDecision: decision })) },
      assessmentAttempt: { findFirst: latestProposalAttempt },
      committeeAssignment: {
        findMany: vi.fn(async () => [
          { role: "ADVISOR", active: true, teacherId: "advisor" },
          { role: "HEAD", active: true, teacherId: "head" },
          { role: "MEMBER", active: true, teacherId: "member" }
        ])
      }
    }));

    if (allowed) {
      await expect(saveAssessmentEvidenceAtomic(harness.db, context, evidenceInput)).resolves.toMatchObject({
        unchanged: false,
        submissionId: "evidence-1"
      });
      expect(harness.read().submission).not.toBeNull();
    } else {
      await expect(saveAssessmentEvidenceAtomic(harness.db, context, evidenceInput)).rejects.toMatchObject({
        code: "PROGRESS_1_PROJECT_NOT_READY"
      });
      expect(harness.read().submission).toBeNull();
    }
    expect(latestProposalAttempt).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { attemptNo: "desc" }
    }));
  });

  it("keeps project gates and evidence-before-schedule after a zero-ready Progress 1 round opens", async () => {
    const assessmentSubmissionFindFirst = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "evidence-1" });
    const tx = {
      $queryRaw: vi.fn(async () => [{ id: context.projectId }]),
      project: {
        findUnique: vi.fn(async () => ({
          id: context.projectId,
          courseOfferingId: "course-1",
          status: "IN_PROGRESS",
          currentTitleTh: "หัวข้อที่ยังขาดกรรมการ"
        }))
      },
      assessmentSubmission: { findFirst: assessmentSubmissionFindFirst },
      assessmentRound: { findUnique: vi.fn(async () => ({ id: "round-1", status: "SUBMISSION_OPEN" })) },
      projectRoundException: { findMany: vi.fn(async () => []) },
      projectProposalResult: { findFirst: vi.fn(async () => ({ finalDecision: "PASS" })) },
      committeeAssignment: { findMany: vi.fn(async () => []) },
      assessmentAttempt: { findFirst: vi.fn(async () => null) },
      examScheduleProposal: {
        findFirst: vi.fn(async () => null),
        findUnique: vi.fn(async () => null)
      }
    };
    const db = {
      $transaction: vi.fn(async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx))
    } as unknown as Pick<PrismaClient, "$transaction">;

    await expect(saveAssessmentEvidenceAtomic(db, context, evidenceInput)).rejects.toMatchObject({
      code: "PROGRESS_1_PROJECT_NOT_READY"
    });

    const scheduleInput: ExamScheduleInput = {
      roundType: "PROGRESS_1",
      assessmentKind: "PROGRESS_1",
      start: new Date("2026-08-20T02:00:00.000Z"),
      end: null,
      room: null,
      note: null
    };
    await expect(submitExamScheduleAtomic(db, context, scheduleInput)).rejects.toMatchObject({
      code: "PROGRESS_1_PROJECT_NOT_READY"
    });
  });

  it("still requires Progress 1 evidence before an otherwise ready project can propose a schedule", async () => {
    const tx = {
      $queryRaw: vi.fn(async () => [{ id: context.projectId }]),
      project: {
        findUnique: vi.fn(async () => ({
          id: context.projectId,
          courseOfferingId: "course-1",
          status: "IN_PROGRESS",
          currentTitleTh: "หัวข้อพร้อมสอบ"
        }))
      },
      assessmentRound: { findUnique: vi.fn(async () => ({ id: "round-1", status: "SUBMISSION_OPEN" })) },
      examScheduleProposal: { findUnique: vi.fn(async () => null) },
      projectRoundException: { findMany: vi.fn(async () => []) },
      assessmentSubmission: { findFirst: vi.fn(async () => null) }
    };
    const db = {
      $transaction: vi.fn(async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx))
    } as unknown as Pick<PrismaClient, "$transaction">;

    await expect(submitExamScheduleAtomic(db, context, {
      roundType: "PROGRESS_1",
      assessmentKind: "PROGRESS_1",
      start: new Date("2026-08-20T02:00:00.000Z"),
      end: null,
      room: null,
      note: null
    })).rejects.toMatchObject({ code: "ASSESSMENT_EVIDENCE_REQUIRED" });
  });

  it("rolls schedule, approvers, timeline, audit, and in-app notifications back together", async () => {
    const input: ExamScheduleInput = {
      roundType: "PROGRESS_1",
      assessmentKind: "PROGRESS_1",
      start: new Date("2026-08-20T02:00:00.000Z"),
      end: new Date("2026-08-20T03:00:00.000Z"),
      room: "MS-301",
      note: "ขอเสนอเวลาสอบ"
    };
    const initial = {
      project: { id: context.projectId, courseOfferingId: "course-1", status: "IN_PROGRESS", currentTitleTh: "หัวข้อ" },
      schedule: null as Record<string, unknown> | null,
      approvals: [] as unknown[],
      timeline: [] as unknown[],
      audits: [] as unknown[],
      notifications: [] as unknown[]
    };
    const harness = transactionalHarness(initial, (read) => ({
      $queryRaw: vi.fn(async () => [{ id: context.projectId }]),
      project: { findUnique: vi.fn(async () => ({ ...read().project })) },
      assessmentRound: { findUnique: vi.fn(async () => ({ id: "round-1", status: "SUBMISSION_OPEN" })) },
      projectRoundException: { findMany: vi.fn(async () => []) },
      assessmentSubmission: { findFirst: vi.fn(async () => ({ id: "evidence-1" })) },
      examScheduleProposal: {
        findUnique: vi.fn(async () => read().schedule),
        upsert: vi.fn(async ({ create, update }) => {
          read().schedule = read().schedule
            ? { ...read().schedule, ...update }
            : { id: "schedule-1", projectId: context.projectId, assessmentRoundId: "round-1", ...create };
          return read().schedule;
        })
      },
      committeeAssignment: {
        findMany: vi.fn(async () => [
          { teacherId: "advisor", role: "ADVISOR", active: true },
          { teacherId: "head", role: "HEAD", active: true },
          { teacherId: "member", role: "MEMBER", active: true }
        ])
      },
      advisorRequest: { findMany: vi.fn(async () => [{ advisorTeacherId: "advisor" }]) },
      teacher: {
        findMany: vi.fn(async () => ["advisor", "head", "member"].map((id) => ({
          id,
          userId: `user-${id}`,
          email: `${id}@sru.ac.th`,
          academicPrefix: "อ.",
          firstNameTh: id,
          lastNameTh: "ทดสอบ",
          user: { email: null }
        })))
      },
      examScheduleApproval: {
        upsert: vi.fn(async ({ create }) => read().approvals.push(create))
      },
      projectTimelineEvent: { create: vi.fn(async ({ data }) => read().timeline.push(data)) },
      auditLog: { create: vi.fn(async ({ data }) => read().audits.push(data)) },
      notification: { createMany: vi.fn(async ({ data }) => read().notifications.push(...data)) },
      projectProposalResult: { findFirst: vi.fn(async () => ({ finalDecision: "PASS" })) },
      assessmentAttempt: { findFirst: vi.fn(async () => null) }
    }));

    await expect(submitExamScheduleAtomic(
      harness.db,
      context,
      input,
      { fault: (point) => { if (point === "schedule_evidence_saved") throw new Error("fault"); } }
    )).rejects.toThrow("fault");

    expect(harness.read()).toEqual(initial);
  });

  it("keeps the committed schedule after LINE failure and does not resend evidence for an identical retry", async () => {
    const input: ExamScheduleInput = {
      roundType: "PROGRESS_2",
      assessmentKind: "PROGRESS_2",
      start: new Date("2026-09-20T02:00:00.000Z"),
      end: null,
      room: null,
      note: null
    };
    const state = {
      project: { id: context.projectId, courseOfferingId: "course-1", status: "IN_PROGRESS", currentTitleTh: "หัวข้อ" },
      schedule: null as Record<string, unknown> | null,
      approvals: [] as unknown[], timeline: [] as unknown[], audits: [] as unknown[], notifications: [] as unknown[]
    };
    const harness = transactionalHarness(state, (read) => ({
      $queryRaw: vi.fn(async () => [{ id: context.projectId }]),
      project: {
        findUnique: vi.fn(async ({ select } = {}) => select
          ? { committeeAssignments: [{ teacherId: "head", role: "HEAD", active: true }], attempts: [{ evaluatorAssignments: [{ teacherId: "head", scoreSubmission: { status: "SUBMITTED" } }] }] }
          : { ...read().project })
      },
      assessmentRound: { findUnique: vi.fn(async () => ({ id: "round-2", status: "SUBMISSION_OPEN" })) },
      projectRoundException: { findMany: vi.fn(async () => []) },
      assessmentSubmission: { findFirst: vi.fn(async () => ({ id: "evidence-2" })) },
      examScheduleProposal: {
        findUnique: vi.fn(async () => read().schedule),
        upsert: vi.fn(async ({ create, update }) => {
          read().schedule = read().schedule ? { ...read().schedule, ...update } : { id: "schedule-2", ...create };
          return read().schedule;
        })
      },
      committeeAssignment: { findMany: vi.fn(async () => [{ teacherId: "head" }]) },
      advisorRequest: { findMany: vi.fn(async () => []) },
      teacher: { findMany: vi.fn(async () => [{ id: "head", userId: "user-head", email: "head@sru.ac.th", academicPrefix: "อ.", firstNameTh: "หัวหน้า", lastNameTh: "ทดสอบ", user: { email: null } }]) },
      examScheduleApproval: { upsert: vi.fn(async ({ create }) => read().approvals.push(create)) },
      projectTimelineEvent: { create: vi.fn(async ({ data }) => read().timeline.push(data)) },
      auditLog: { create: vi.fn(async ({ data }) => read().audits.push(data)) },
      notification: { createMany: vi.fn(async ({ data }) => read().notifications.push(...data)) }
    }));

    const committed = await submitExamScheduleAtomic(harness.db, context, input);
    await expect(deliverExamScheduleExternalNotification(committed.externalNotification!, {
      buildActionUrl: () => "https://example.test/teacher/schedules",
      sendLine: vi.fn(async () => { throw new Error("LINE unavailable"); }),
      sendEmail: vi.fn(async () => ({ status: "sent" as const }))
    })).resolves.toBeUndefined();
    const retry = await submitExamScheduleAtomic(harness.db, context, input);

    expect(committed).toMatchObject({ unchanged: false, scheduleId: "schedule-2" });
    expect(committed.externalNotification).toBeDefined();
    expect(retry).toMatchObject({ unchanged: true, scheduleId: "schedule-2" });
    expect(retry.externalNotification).toBeUndefined();
    expect(harness.read().approvals).toHaveLength(1);
    expect(harness.read().timeline).toHaveLength(1);
    expect(harness.read().audits).toHaveLength(1);
    expect(harness.read().notifications).toHaveLength(1);
  });

  it("rolls report version/lifecycle/timeline back and normalizes an identical retry", async () => {
    const input: ReportVersionInput = {
      driveLink: "https://docs.google.com/document/d/report",
      note: "แก้ไขตามข้อเสนอแนะ\nเรียบร้อยแล้ว"
    };
    const initial = {
      project: { id: context.projectId, status: "FINAL_DONE" },
      versions: [] as Array<Record<string, unknown>>,
      history: [] as unknown[],
      timeline: [] as Array<Record<string, unknown>>
    };
    const harness = transactionalHarness(initial, (read) => ({
      $queryRaw: vi.fn(async () => [{ id: context.projectId }]),
      project: {
        findUnique: vi.fn(async () => ({ ...read().project })),
        update: vi.fn(async ({ data }) => Object.assign(read().project, data))
      },
      reportVersion: {
        findFirst: vi.fn(async () => read().versions.at(-1) ?? null),
        create: vi.fn(async ({ data }) => {
          const version = { id: `report-${read().versions.length + 1}`, reviews: [], ...data };
          read().versions.push(version);
          return version;
        })
      },
      projectTimelineEvent: {
        findFirst: vi.fn(async ({ where }) => read().timeline.find((item) => item.relatedEntityId === where.relatedEntityId) ?? null),
        create: vi.fn(async ({ data }) => read().timeline.push(data))
      },
      projectStatusHistory: { create: vi.fn(async ({ data }) => read().history.push(data)) }
    }));

    await expect(submitReportVersionAtomic(
      harness.db,
      context,
      input,
      { fault: (point) => { if (point === "report_version_saved") throw new Error("fault"); } }
    )).rejects.toThrow("fault");
    expect(harness.read()).toEqual(initial);

    const committed = await submitReportVersionAtomic(harness.db, context, input);
    const retry = await submitReportVersionAtomic(harness.db, context, {
      driveLink: "https://docs.google.com/document/d/report/",
      note: "  แก้ไขตามข้อเสนอแนะ\r\nเรียบร้อยแล้ว  "
    });

    expect(committed).toMatchObject({ unchanged: false, reportVersionId: "report-1", versionNo: 1 });
    expect(retry).toMatchObject({ unchanged: true, reportVersionId: "report-1", versionNo: 1 });
    expect(harness.read().versions).toHaveLength(1);
    expect(harness.read().history).toHaveLength(1);
    expect(harness.read().timeline).toHaveLength(1);

    const latestVersion = harness.read().versions.at(-1)!;
    (latestVersion.reviews as Array<{ decision: string }>).push({ decision: "FAIL" });
    const revision = await submitReportVersionAtomic(harness.db, context, input);

    expect(revision).toMatchObject({ unchanged: false, reportVersionId: "report-2", versionNo: 2 });
    expect(harness.read().versions).toHaveLength(2);
    expect(harness.read().history).toHaveLength(1);
    expect(harness.read().timeline).toHaveLength(2);
  });
});
