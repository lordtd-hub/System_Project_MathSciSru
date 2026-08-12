import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  saveProjectOriginAtomic,
  saveProposalSubmissionAtomic,
  saveStudentProfileAtomic,
  type ProjectOriginInput,
  type ProposalSubmissionInput,
  type StudentMutationContext
} from "./studentCurrentStageMutations";

const context: StudentMutationContext = {
  userId: "user-1",
  studentId: "student-1",
  projectId: "project-1",
  studentCode: "650000001",
  studentFirstNameTh: "ทดสอบ",
  studentLastNameTh: "ระบบ"
};

function transactionalHarness<T extends object>(initial: T, createTx: (read: () => T, write: (next: T) => void) => object) {
  let state = structuredClone(initial);
  const read = () => state;
  const write = (next: T) => { state = next; };
  const tx = createTx(read, write);
  let transactionQueue = Promise.resolve();
  const db = {
    $transaction: vi.fn((operation: (client: object) => Promise<unknown>) => {
      const result = transactionQueue.then(async () => {
        const before = structuredClone(state);
        try {
          return await operation(tx);
        } catch (error) {
          state = before;
          throw error;
        }
      });
      transactionQueue = result.then(() => undefined, () => undefined);
      return result;
    })
  } as unknown as Pick<PrismaClient, "$transaction">;
  return { db, read };
}

const reproposalInput: ProposalSubmissionInput = {
  titleTh: "หัวข้อเสนอใหม่",
  titleEn: "A new proposal",
  abstractText: "บทคัดย่อสำหรับการเสนอหัวข้อใหม่",
  content: {
    motivationBackground: "ที่มาใหม่",
    objectives: "วัตถุประสงค์ใหม่",
    proposedMethods: "วิธีการใหม่",
    expectedOutcomes: "ผลลัพธ์ใหม่",
    timeline: "16 สัปดาห์",
    timelineItems: [{ activity: "ทบทวน", startWeek: 1, endWeek: 2, deliverable: "กรอบงาน" }],
    questionsForTeachers: ""
  },
  materialLink: "https://drive.google.com/file/d/reproposal",
  declarationAccepted: true
};

function reproposalInputFor(failedAttemptNo: number): ProposalSubmissionInput {
  return {
    ...reproposalInput,
    expectedReproposalPredecessor: {
      attemptId: `attempt-${failedAttemptNo}`,
      resultId: `result-${failedAttemptNo}`
    }
  };
}

type ReproposalAttemptState = {
  project: { id: string; courseOfferingId: string; status: string; currentTitleTh: string | null; currentTitleEn: string | null };
  attempts: Array<{
    id: string;
    projectId: string;
    assessmentRoundId: string;
    attemptNo: number;
    attemptType: string;
    previousAttemptId: string | null;
    status: string;
    presentationSubmission: Record<string, unknown> | null;
  }>;
  results: Array<{ id: string; assessmentAttemptId: string; projectId: string; finalDecision: string; decidedAt: Date }>;
  versions: Array<Record<string, unknown>>;
  assignments: Array<Record<string, unknown>>;
  history: Array<Record<string, unknown>>;
  timeline: Array<Record<string, unknown>>;
  audits: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
};

function reproposalHarness(latestFailedAttemptNo: 1 | 2 | 3) {
  const attempts: ReproposalAttemptState["attempts"] = Array.from({ length: latestFailedAttemptNo }, (_, index) => {
    const attemptNo = index + 1;
    return {
      id: `attempt-${attemptNo}`,
      projectId: context.projectId,
      assessmentRoundId: "round-1",
      attemptNo,
      attemptType: attemptNo === 1 ? "MAIN_PROPOSAL" : "REPROPOSAL",
      previousAttemptId: attemptNo === 1 ? null : `attempt-${attemptNo - 1}`,
      status: "SCORING_CLOSED",
      presentationSubmission: {
        id: `submission-${attemptNo}`,
        titleTh: `หัวข้อเดิม ${attemptNo}`,
        titleEn: null,
        abstractText: "ฉบับไม่ผ่าน",
        contentJson: {},
        materialLink: "https://drive.google.com/file/d/failed",
        declarationAccepted: true,
        status: "LOCKED"
      }
    };
  });
  const initial: ReproposalAttemptState = {
    project: {
      id: context.projectId,
      courseOfferingId: "course-1",
      status: "PROPOSAL_PENDING",
      currentTitleTh: "หัวข้อเดิม",
      currentTitleEn: null
    },
    attempts,
    results: Array.from({ length: latestFailedAttemptNo }, (_, index) => {
      const attemptNo = index + 1;
      return {
        id: `result-${attemptNo}`,
        assessmentAttemptId: `attempt-${attemptNo}`,
        projectId: context.projectId,
        finalDecision: "NOT_PASS",
        decidedAt: new Date(`2026-0${attemptNo}-01T00:00:00.000Z`)
      };
    }),
    versions: [],
    assignments: [{
      assessmentAttemptId: `attempt-${latestFailedAttemptNo}`,
      evaluatorUserId: "old-evaluator-user",
      teacherId: "old-teacher",
      status: "SUBMITTED"
    }],
    history: [],
    timeline: [],
    audits: [],
    notifications: []
  };
  const lateExceptionLookup = vi.fn(async () => [{ exceptionType: "LATE_SUBMISSION", status: "OPEN" }]);
  const harness = transactionalHarness(initial, (read) => ({
    $queryRaw: vi.fn(async () => [{ id: context.projectId }]),
    project: {
      findUniqueOrThrow: vi.fn(async () => ({ ...read().project })),
      update: vi.fn(async ({ data }) => Object.assign(read().project, data))
    },
    assessmentRound: {
      findUnique: vi.fn(async () => ({
        id: "round-1",
        status: "SCORING_CLOSED",
        submissionDeadline: new Date("2025-01-01T00:00:00.000Z")
      }))
    },
    assessmentAttempt: {
      findFirst: vi.fn(async () => {
        const latest = [...read().attempts].sort((left, right) => right.attemptNo - left.attemptNo)[0];
        return latest ? structuredClone(latest) : null;
      }),
      upsert: vi.fn(async ({ where, update, create }) => {
        const attemptNo = where.projectId_assessmentRoundId_attemptNo.attemptNo;
        const existing = read().attempts.find((attempt) => attempt.attemptNo === attemptNo);
        if (existing) {
          Object.assign(existing, update);
          return structuredClone(existing);
        }
        const created = { id: `attempt-${attemptNo}`, ...create, presentationSubmission: null };
        read().attempts.push(created);
        return structuredClone(created);
      })
    },
    projectProposalResult: {
      findFirst: vi.fn(async () => structuredClone(
        [...read().results].sort((left, right) => right.decidedAt.getTime() - left.decidedAt.getTime())[0] ?? null
      ))
    },
    projectOrigin: { findUnique: vi.fn(async () => ({ status: "SUBMITTED" })) },
    projectRoundException: { findMany: lateExceptionLookup },
    presentationSubmission: {
      upsert: vi.fn(async ({ where, update, create }) => {
        const attempt = read().attempts.find((candidate) => candidate.id === where.assessmentAttemptId);
        if (!attempt) throw new Error("attempt missing");
        if (attempt.presentationSubmission) {
          Object.assign(attempt.presentationSubmission, update);
        } else {
          attempt.presentationSubmission = { id: `submission-${attempt.attemptNo}`, ...create };
        }
        return structuredClone(attempt.presentationSubmission);
      })
    },
    presentationSubmissionVersion: {
      findFirst: vi.fn(async ({ where }) => {
        const latest = read().versions
          .filter((version) => version.presentationSubmissionId === where.presentationSubmissionId)
          .sort((left, right) => Number(right.versionNo) - Number(left.versionNo))[0];
        return latest ? { versionNo: latest.versionNo } : null;
      }),
      create: vi.fn(async ({ data }) => {
        read().versions.push(structuredClone(data));
        return data;
      })
    },
    teacher: {
      findMany: vi.fn(async () => [{
        id: "current-teacher",
        userId: "current-evaluator-user",
        academicPrefix: "อ.",
        firstNameTh: "ผู้ประเมิน",
        lastNameTh: "ปัจจุบัน"
      }])
    },
    evaluatorAssignment: {
      upsert: vi.fn(async ({ where, update, create }) => {
        const key = where.assessmentAttemptId_evaluatorUserId;
        const existing = read().assignments.find((assignment) => assignment.assessmentAttemptId === key.assessmentAttemptId
          && assignment.evaluatorUserId === key.evaluatorUserId);
        if (existing) Object.assign(existing, update);
        else read().assignments.push(structuredClone(create));
      })
    },
    projectStatusHistory: { create: vi.fn(async ({ data }) => read().history.push(structuredClone(data))) },
    projectTimelineEvent: { create: vi.fn(async ({ data }) => read().timeline.push(structuredClone(data))) },
    auditLog: { create: vi.fn(async ({ data }) => read().audits.push(structuredClone(data))) },
    notification: { createMany: vi.fn(async ({ data }) => read().notifications.push(...structuredClone(data))) }
  }));
  return { ...harness, initial, lateExceptionLookup };
}

describe("student current-stage atomic persistence", () => {
  it("rolls profile and lifecycle evidence back together on a fault", async () => {
    const harness = transactionalHarness({
      project: { id: context.projectId, status: "STUDENT_PROFILE" },
      profile: null as null | { id: string; studentId: string; preferredName: string | null; phone: string | null; lineId: string | null },
      history: [] as unknown[],
      timeline: [] as unknown[]
    }, (read) => ({
      $queryRaw: vi.fn(async () => [{ id: context.projectId }]),
      project: {
        findUniqueOrThrow: vi.fn(async () => ({ ...read().project })),
        update: vi.fn(async ({ data }) => Object.assign(read().project, data))
      },
      studentProfile: {
        findUnique: vi.fn(async () => read().profile),
        upsert: vi.fn(async ({ create, update }) => {
          read().profile = read().profile
            ? { ...read().profile, ...update }
            : { id: "profile-1", ...create };
          return read().profile;
        })
      },
      projectStatusHistory: { create: vi.fn(async ({ data }) => read().history.push(data)) },
      projectTimelineEvent: { create: vi.fn(async ({ data }) => read().timeline.push(data)) }
    }));

    await expect(saveStudentProfileAtomic(
      harness.db,
      context,
      { preferredName: "เมย์", phone: null, lineId: null },
      { fault: (point) => { if (point === "profile_saved") throw new Error("fault"); } }
    )).rejects.toThrow("fault");

    expect(harness.read()).toEqual({
      project: { id: context.projectId, status: "STUDENT_PROFILE" },
      profile: null,
      history: [],
      timeline: []
    });
  });

  it("treats an identical committed origin retry as unchanged without duplicate evidence", async () => {
    const input: ProjectOriginInput = {
      initialProjectTitleTh: "หัวข้อทดสอบ",
      initialProjectTitleEn: null,
      sourceType: "STUDENT_INITIATED",
      reasonForTopic: "เหตุผล",
      expectedMathArea: "พีชคณิต",
      tentativeAdvisorId: "teacher-1",
      consultationSummary: "ปรึกษาแล้ว",
      initialReferences: "เอกสารอ้างอิง",
      materialLink: "https://drive.google.com/file/d/example",
      declarationAccepted: true
    };
    const harness = transactionalHarness({
      project: { id: context.projectId, status: "PENDING_ADVISOR", currentTitleTh: input.initialProjectTitleTh, currentTitleEn: null },
      origin: { id: "origin-1", projectId: context.projectId, ...input, status: "SUBMITTED" },
      versions: [] as unknown[],
      history: [] as unknown[],
      timeline: [] as unknown[],
      audits: [] as unknown[],
      notifications: [] as unknown[]
    }, (read) => ({
      $queryRaw: vi.fn(async () => [{ id: context.projectId }]),
      project: { findUniqueOrThrow: vi.fn(async () => ({ ...read().project })) },
      projectOrigin: { findUnique: vi.fn(async () => read().origin) }
    }));

    const outcome = await saveProjectOriginAtomic(harness.db, context, input);

    expect(outcome).toEqual({ unchanged: true });
    expect(harness.read().versions).toHaveLength(0);
    expect(harness.read().history).toHaveLength(0);
    expect(harness.read().timeline).toHaveLength(0);
    expect(harness.read().audits).toHaveLength(0);
    expect(harness.read().notifications).toHaveLength(0);
  });

  it("rolls origin/version/advisor/lifecycle/audit/notification writes back on a fault", async () => {
    const input: ProjectOriginInput = {
      initialProjectTitleTh: "หัวข้อใหม่",
      initialProjectTitleEn: null,
      sourceType: "RESEARCH_EXTENSION",
      reasonForTopic: "เหตุผล",
      expectedMathArea: "การวิเคราะห์",
      tentativeAdvisorId: "teacher-1",
      consultationSummary: "สรุปการปรึกษา",
      initialReferences: "อ้างอิง",
      materialLink: "https://docs.google.com/document/d/example",
      declarationAccepted: true
    };
    const initial = {
      project: { id: context.projectId, status: "DRAFT", currentTitleTh: null as string | null, currentTitleEn: null as string | null },
      origin: null as Record<string, unknown> | null,
      versions: [] as unknown[], advisorRequests: [] as unknown[], history: [] as unknown[], timeline: [] as unknown[], audits: [] as unknown[], notifications: [] as unknown[]
    };
    const harness = transactionalHarness(initial, (read) => ({
      $queryRaw: vi.fn(async () => [{ id: context.projectId }]),
      project: {
        findUniqueOrThrow: vi.fn(async () => ({ ...read().project })),
        update: vi.fn(async ({ data }) => Object.assign(read().project, data))
      },
      projectOrigin: {
        findUnique: vi.fn(async () => read().origin),
        upsert: vi.fn(async ({ create, update }) => {
          read().origin = read().origin ? { ...read().origin, ...update } : { id: "origin-1", ...create };
          return read().origin;
        })
      },
      projectProposalResult: { findFirst: vi.fn(async () => null) },
      projectOriginVersion: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }) => read().versions.push(data))
      },
      advisorRequest: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }) => read().advisorRequests.push(data)),
        update: vi.fn()
      },
      projectStatusHistory: { create: vi.fn(async ({ data }) => read().history.push(data)) },
      projectTimelineEvent: { create: vi.fn(async ({ data }) => read().timeline.push(data)) },
      auditLog: { create: vi.fn(async ({ data }) => read().audits.push(data)) },
      teacher: {
        findUnique: vi.fn(async () => ({ id: "teacher-1", userId: "teacher-user-1", academicPrefix: "อ.", firstNameTh: "หนึ่ง", lastNameTh: "ทดสอบ" }))
      },
      notification: { create: vi.fn(async ({ data }) => read().notifications.push(data)) }
    }));

    await expect(saveProjectOriginAtomic(
      harness.db,
      context,
      input,
      { fault: (point) => { if (point === "origin_evidence_saved") throw new Error("fault"); } }
    )).rejects.toThrow("fault");

    expect(harness.read()).toEqual(initial);
  });

  it("rejects a stale advisor selection as a typed conflict before writing", async () => {
    const input: ProjectOriginInput = {
      initialProjectTitleTh: "หัวข้อทดสอบ",
      initialProjectTitleEn: null,
      sourceType: "STUDENT_INITIATED",
      reasonForTopic: "เหตุผล",
      expectedMathArea: "สถิติ",
      tentativeAdvisorId: "missing-teacher",
      consultationSummary: "สรุป",
      initialReferences: "อ้างอิง",
      materialLink: "https://drive.google.com/file/d/example",
      declarationAccepted: true
    };
    const harness = transactionalHarness({ writes: 0 }, () => ({
      $queryRaw: vi.fn(async () => [{ id: context.projectId }]),
      project: { findUniqueOrThrow: vi.fn(async () => ({ id: context.projectId, status: "DRAFT" })) },
      projectOrigin: { findUnique: vi.fn(async () => null) },
      projectProposalResult: { findFirst: vi.fn(async () => null) },
      teacher: { findUnique: vi.fn(async () => null) }
    }));

    await expect(saveProjectOriginAtomic(harness.db, context, input)).rejects.toMatchObject({
      code: "ADVISOR_NOT_AVAILABLE"
    });
    expect(harness.read().writes).toBe(0);
  });

  it("rejects a stale topic restart form after a newer NOT_PASS cycle without writing evidence", async () => {
    const input: ProjectOriginInput = {
      initialProjectTitleTh: "หัวข้อจากฟอร์มรอบเก่า",
      initialProjectTitleEn: null,
      sourceType: "STUDENT_INITIATED",
      reasonForTopic: "เหตุผลเดิม",
      expectedMathArea: "คณิตศาสตร์",
      tentativeAdvisorId: "teacher-1",
      consultationSummary: "สรุปเดิม",
      initialReferences: "อ้างอิงเดิม",
      materialLink: "https://drive.google.com/file/d/stale-restart",
      declarationAccepted: true,
      expectedReproposalPredecessor: { attemptId: "attempt-1", resultId: "result-1" }
    };
    const initial = {
      project: { id: context.projectId, status: "DRAFT" },
      origin: { id: "origin-1", projectId: context.projectId, status: "SUBMITTED" },
      versions: [] as unknown[],
      advisorRequests: [] as unknown[],
      history: [] as unknown[],
      timeline: [] as unknown[],
      audits: [] as unknown[],
      notifications: [] as unknown[]
    };
    const harness = transactionalHarness(initial, (read) => ({
      $queryRaw: vi.fn(async () => [{ id: context.projectId }]),
      project: { findUniqueOrThrow: vi.fn(async () => ({ ...read().project })) },
      projectOrigin: { findUnique: vi.fn(async () => structuredClone(read().origin)) },
      projectProposalResult: {
        findFirst: vi.fn(async () => ({
          id: "result-2",
          assessmentAttemptId: "attempt-2",
          finalDecision: "NOT_PASS"
        }))
      }
    }));
    const before = structuredClone(harness.read());

    await expect(saveProjectOriginAtomic(harness.db, context, input)).rejects.toMatchObject({
      code: "REPROPOSAL_RESTART_STALE"
    });

    expect(harness.read()).toEqual(before);
    expect(harness.read().versions).toHaveLength(0);
    expect(harness.read().advisorRequests).toHaveLength(0);
    expect(harness.read().history).toHaveLength(0);
    expect(harness.read().timeline).toHaveLength(0);
    expect(harness.read().audits).toHaveLength(0);
    expect(harness.read().notifications).toHaveLength(0);
  });

  it("stores audit metadata without copying student text or material links", async () => {
    const source = await import("node:fs/promises").then((fs) => fs.readFile(
      new URL("./studentCurrentStageMutations.ts", import.meta.url),
      "utf8"
    ));
    const originAuditBlock = source.slice(source.indexOf('action: "PROJECT_ORIGIN_SUBMITTED"'), source.indexOf("const advisorName"));
    const proposalAuditBlock = source.slice(source.indexOf('action: "PROPOSAL_SUBMITTED"'), source.indexOf("if (proposalTeachers.length)"));

    for (const block of [originAuditBlock, proposalAuditBlock]) {
      expect(block).not.toContain("materialLink:");
      expect(block).not.toContain("abstractText:");
      expect(block).not.toContain("contentJson:");
      expect(block).not.toContain("reasonForTopic:");
    }
  });

  it("treats an identical committed proposal retry as unchanged without duplicate version or notification", async () => {
    const input: ProposalSubmissionInput = {
      titleTh: "Proposal ทดสอบ",
      titleEn: null,
      abstractText: "บทคัดย่อ",
      content: {
        motivationBackground: "ที่มา",
        objectives: "วัตถุประสงค์",
        proposedMethods: "วิธีการ",
        expectedOutcomes: "ผลลัพธ์",
        timeline: "16 สัปดาห์",
        timelineItems: [{ activity: "ศึกษา", startWeek: 1, endWeek: 2, deliverable: "สรุป" }],
        questionsForTeachers: ""
      },
      materialLink: "https://classroom.google.com/example",
      declarationAccepted: true
    };
    const committed = {
      id: "submission-1",
      titleTh: input.titleTh,
      titleEn: input.titleEn,
      abstractText: input.abstractText,
      contentJson: input.content,
      materialLink: input.materialLink,
      declarationAccepted: true,
      status: "SUBMITTED"
    };
    const harness = transactionalHarness({ versions: [] as unknown[], notifications: [] as unknown[] }, () => ({
      $queryRaw: vi.fn(async () => [{ id: context.projectId }]),
      project: { findUniqueOrThrow: vi.fn(async () => ({ id: context.projectId, courseOfferingId: "course-1", status: "PROPOSAL_REVIEW" })) },
      assessmentRound: { findUnique: vi.fn(async () => ({ id: "round-1" })) },
      assessmentAttempt: { findFirst: vi.fn(async () => ({ id: "attempt-1", presentationSubmission: committed })) }
    }));

    const outcome = await saveProposalSubmissionAtomic(harness.db, context, input);

    expect(outcome).toEqual({ unchanged: true });
    expect(harness.read().versions).toHaveLength(0);
    expect(harness.read().notifications).toHaveLength(0);
  });

  it("rolls a Proposal submission and version back when the transaction fails", async () => {
    const input: ProposalSubmissionInput = {
      titleTh: "Proposal สำหรับทดสอบ rollback",
      titleEn: null,
      abstractText: "บทคัดย่อ",
      content: {
        motivationBackground: "ที่มา",
        objectives: "วัตถุประสงค์",
        proposedMethods: "วิธีการ",
        expectedOutcomes: "ผลลัพธ์",
        timeline: "16 สัปดาห์",
        timelineItems: [{ activity: "ศึกษา", startWeek: 1, endWeek: 2, deliverable: "สรุป" }],
        questionsForTeachers: ""
      },
      materialLink: "https://drive.google.com/file/d/example",
      declarationAccepted: true
    };
    const initial = {
      submission: null as Record<string, unknown> | null,
      versions: [] as unknown[]
    };
    const harness = transactionalHarness(initial, (read) => ({
      $queryRaw: vi.fn(async () => [{ id: context.projectId }]),
      project: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: context.projectId,
          courseOfferingId: "course-1",
          status: "PROPOSAL_PENDING"
        }))
      },
      assessmentRound: {
        findUnique: vi.fn(async () => ({
          id: "round-1",
          status: "SUBMISSION_OPEN",
          submissionDeadline: null
        }))
      },
      assessmentAttempt: {
        findFirst: vi.fn(async () => null),
        upsert: vi.fn(async () => ({ id: "attempt-1" }))
      },
      projectProposalResult: { findFirst: vi.fn(async () => null) },
      projectOrigin: { findUnique: vi.fn(async () => ({ status: "SUBMITTED" })) },
      projectRoundException: { findMany: vi.fn(async () => []) },
      presentationSubmission: {
        upsert: vi.fn(async ({ create }) => {
          read().submission = { id: "submission-1", ...create };
          return read().submission;
        })
      },
      presentationSubmissionVersion: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }) => read().versions.push(data))
      }
    }));

    await expect(saveProposalSubmissionAtomic(
      harness.db,
      context,
      input,
      { fault: (point) => { if (point === "proposal_version_saved") throw new Error("fault"); } }
    )).rejects.toThrow("fault");

    expect(harness.read()).toEqual(initial);
  });

  it.each([
    { latestFailedAttemptNo: 1 as const, expectedAttemptNo: 2 },
    { latestFailedAttemptNo: 2 as const, expectedAttemptNo: 3 }
  ])("creates re-proposal attempt $expectedAttemptNo chained to the latest failed attempt", async ({
    latestFailedAttemptNo,
    expectedAttemptNo
  }) => {
    const harness = reproposalHarness(latestFailedAttemptNo);

    const outcome = await saveProposalSubmissionAtomic(harness.db, context, reproposalInputFor(latestFailedAttemptNo), {
      now: () => new Date("2026-08-12T10:00:00.000Z")
    });

    expect(outcome).toEqual({ unchanged: false });
    const createdAttempt = harness.read().attempts.find((attempt) => attempt.attemptNo === expectedAttemptNo);
    expect(createdAttempt).toMatchObject({
      id: `attempt-${expectedAttemptNo}`,
      attemptType: "REPROPOSAL",
      previousAttemptId: `attempt-${latestFailedAttemptNo}`,
      status: "SCORING_OPEN",
      presentationSubmission: {
        id: `submission-${expectedAttemptNo}`,
        status: "SUBMITTED",
        titleTh: reproposalInput.titleTh
      }
    });
    expect(harness.read().versions).toEqual([expect.objectContaining({
      presentationSubmissionId: `submission-${expectedAttemptNo}`,
      versionNo: 1
    })]);
    expect(harness.read().assignments.filter((assignment) => assignment.assessmentAttemptId === createdAttempt?.id)).toEqual([
      expect.objectContaining({
        evaluatorUserId: "current-evaluator-user",
        teacherId: "current-teacher",
        status: "ASSIGNED"
      })
    ]);
    expect(harness.lateExceptionLookup).not.toHaveBeenCalled();
    expect(harness.read().timeline).toEqual([expect.objectContaining({
      eventType: "REPROPOSAL_SUBMITTED",
      relatedEntityId: `submission-${expectedAttemptNo}`,
      metadataJson: {
        attemptNo: expectedAttemptNo,
        attemptType: "REPROPOSAL"
      }
    })]);
    expect(harness.read().timeline[0]?.metadataJson).not.toHaveProperty("latePenaltyRequired");
    expect(harness.read().timeline[0]?.metadataJson).not.toHaveProperty("latePenaltyPercent");
  });

  it("serializes a re-proposal double submit and reuses the committed attempt, submission, and assignments", async () => {
    const harness = reproposalHarness(1);

    const outcomes = await Promise.all([
      saveProposalSubmissionAtomic(harness.db, context, reproposalInputFor(1)),
      saveProposalSubmissionAtomic(harness.db, context, reproposalInputFor(1))
    ]);

    expect(outcomes).toEqual([{ unchanged: false }, { unchanged: true }]);
    expect(harness.read().attempts.map((attempt) => attempt.attemptNo)).toEqual([1, 2]);
    expect(harness.read().attempts[1]?.presentationSubmission).toMatchObject({ id: "submission-2" });
    expect(harness.read().versions).toHaveLength(1);
    expect(harness.read().assignments.filter((assignment) => assignment.assessmentAttemptId === "attempt-2")).toHaveLength(1);
    expect(harness.read().history).toHaveLength(1);
    expect(harness.read().timeline).toHaveLength(1);
    expect(harness.read().audits).toHaveLength(1);
    expect(harness.read().notifications).toHaveLength(1);
  });

  it("rolls the re-proposal attempt chain, submission, assignments, and evidence back on a fault", async () => {
    const harness = reproposalHarness(2);

    await expect(saveProposalSubmissionAtomic(
      harness.db,
      context,
      reproposalInputFor(2),
      { fault: (point) => { if (point === "proposal_evidence_saved") throw new Error("fault"); } }
    )).rejects.toThrow("fault");

    expect(harness.read()).toEqual(harness.initial);
  });

  it("rejects a stale Attempt 2 form after Attempt 3 becomes the current failed predecessor", async () => {
    const harness = reproposalHarness(3);
    const before = structuredClone(harness.read());

    await expect(saveProposalSubmissionAtomic(
      harness.db,
      context,
      reproposalInputFor(2)
    )).rejects.toMatchObject({
      code: "REPROPOSAL_PREDECESSOR_STALE"
    });

    expect(harness.read()).toEqual(before);
    expect(harness.read().attempts.map((attempt) => attempt.attemptNo)).toEqual([1, 2, 3]);
    expect(harness.read().versions).toHaveLength(0);
    expect(harness.read().assignments).toHaveLength(1);
    expect(harness.read().audits).toHaveLength(0);
    expect(harness.read().notifications).toHaveLength(0);
  });

  it("emits and parses both re-proposal predecessor identifiers", async () => {
    const fs = await import("node:fs/promises");
    const [pageSource, projectPageSource, actionSource] = await Promise.all([
      fs.readFile(new URL("../../app/student/proposal/page.tsx", import.meta.url), "utf8"),
      fs.readFile(new URL("../../app/student/project/page.tsx", import.meta.url), "utf8"),
      fs.readFile(new URL("../../app/student/actions.ts", import.meta.url), "utf8")
    ]);

    expect(pageSource).toContain('name="expected_reproposal_attempt_id" value={latestProposalAttempt.id}');
    expect(pageSource).toContain('name="expected_reproposal_result_id" value={currentProposalResult.id}');
    expect(projectPageSource).toContain('name="expected_reproposal_restart_attempt_id" value={latestProposalResult.assessmentAttemptId}');
    expect(projectPageSource).toContain('name="expected_reproposal_restart_result_id" value={latestProposalResult.id}');
    expect(actionSource).toContain('formData.get("expected_reproposal_attempt_id")');
    expect(actionSource).toContain('formData.get("expected_reproposal_result_id")');
    expect(actionSource).toContain('formData.get("expected_reproposal_restart_attempt_id")');
    expect(actionSource).toContain('formData.get("expected_reproposal_restart_result_id")');
  });
});
