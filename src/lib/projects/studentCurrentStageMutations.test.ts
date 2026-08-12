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
        findUniqueOrThrow: vi.fn(async () => ({ id: "teacher-1", userId: "teacher-user-1", academicPrefix: "อ.", firstNameTh: "หนึ่ง", lastNameTh: "ทดสอบ" }))
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
      assessmentAttempt: { findUnique: vi.fn(async () => ({ id: "attempt-1", presentationSubmission: committed })) }
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
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(async () => ({ id: "attempt-1" }))
      },
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
});
