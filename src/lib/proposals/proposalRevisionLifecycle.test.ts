import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  reviewProposalRevisionByAdvisorAtomic,
  saveAdminProposalFinalDecisionAtomic,
  submitProposalRevisionAtomic,
  unlockProposalRevisionAtomic,
  type ProposalRevisionInput
} from "./proposalRevisionLifecycle";

type State = {
  project: {
    id: string;
    status: string;
    currentTitleTh: string | null;
    currentTitleEn: string | null;
    student: { id: string; userId: string };
  };
  submission: {
    id: string;
    assessmentAttemptId: string;
    projectId: string;
    studentId: string;
    titleTh: string;
    titleEn: string | null;
    abstractText: string;
    contentJson: unknown;
    materialLink: string;
    declarationAccepted: boolean;
    status: string;
    submittedAt: Date | null;
    lockedAt: Date | null;
    createdAt: Date;
  };
  result: null | Record<string, unknown>;
  versions: Array<Record<string, unknown>>;
  histories: Array<Record<string, unknown>>;
  timeline: Array<Record<string, unknown>>;
  audits: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  activeCommitteeCount: number;
  latestAdvisorRequestStatus: "APPROVED" | "PENDING" | "REJECTED" | "CANCELLED";
};

const now = new Date("2026-08-12T03:00:00.000Z");

const revisionInput: ProposalRevisionInput = {
  actorUserId: "student-user",
  requestId: "request-revision",
  projectId: "project-1",
  titleTh: "หัวข้อฉบับแก้ไข",
  titleEn: null,
  abstractText: "บทคัดย่อฉบับแก้ไข",
  contentJson: { objectives: "วัตถุประสงค์ฉบับแก้ไข" },
  materialLink: "https://docs.google.com/document/d/revision",
  declarationAccepted: true
};

function initialState(): State {
  return {
    project: {
      id: "project-1",
      status: "PROPOSAL_ADMIN_DECISION",
      currentTitleTh: "หัวข้อเดิม",
      currentTitleEn: null,
      student: { id: "student-1", userId: "student-user" }
    },
    submission: {
      id: "submission-1",
      assessmentAttemptId: "attempt-1",
      projectId: "project-1",
      studentId: "student-1",
      titleTh: "หัวข้อเดิม",
      titleEn: null,
      abstractText: "บทคัดย่อเดิม",
      contentJson: { objectives: "เดิม" },
      materialLink: "https://drive.google.com/file/d/original",
      declarationAccepted: true,
      status: "SUBMITTED",
      submittedAt: new Date("2026-08-01T03:00:00.000Z"),
      lockedAt: null,
      createdAt: new Date("2026-08-01T03:00:00.000Z")
    },
    result: null,
    versions: [],
    histories: [],
    timeline: [],
    audits: [],
    notifications: [],
    activeCommitteeCount: 0,
    latestAdvisorRequestStatus: "APPROVED"
  };
}

function createHarness(seed: State = initialState()) {
  let state = structuredClone(seed);

  const tx = {
    $queryRaw: vi.fn(async () => [{ id: state.project.id }]),
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id === "admin-user") return { id: where.id, globalRole: "ADMIN", active: true };
        if (where.id === "student-user") return { id: where.id, globalRole: "STUDENT", active: true };
        if (where.id === "advisor-user" || where.id === "other-teacher-user") {
          return { id: where.id, globalRole: "TEACHER", active: true };
        }
        return null;
      })
    },
    teacher: {
      findUnique: vi.fn(async ({ where }: { where: { userId?: string } }) => {
        if (where.userId === "advisor-user") return { id: "advisor-1", userId: "advisor-user", active: true };
        if (where.userId === "other-teacher-user") return { id: "advisor-2", userId: "other-teacher-user", active: true };
        return null;
      })
    },
    project: {
      findUnique: vi.fn(async () => ({ ...state.project, student: { ...state.project.student } })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(state.project, data);
        return { ...state.project };
      })
    },
    assessmentAttempt: {
      findUnique: vi.fn(async ({ select }: { select?: unknown }) => select
        ? { projectId: state.project.id }
        : {
            id: "attempt-1",
            projectId: state.project.id,
            attemptType: "MAIN_PROPOSAL",
            project: { ...state.project, student: { ...state.project.student } },
            presentationSubmission: { ...state.submission },
            proposalResult: state.result ? { ...state.result } : null,
            evaluatorAssignments: [
              { scoreSubmission: { totalScore: 80, status: "SUBMITTED", proposalDecision: { decision: "PASS", reason: null } } },
              { scoreSubmission: { totalScore: 60, status: "SUBMITTED", proposalDecision: { decision: "PASS_WITH_REVISION", reason: "แก้ไข" } } }
            ]
          })
    },
    projectProposalResult: {
      findFirst: vi.fn(async () => state.result ? {
        ...state.result,
        assessmentAttempt: { presentationSubmission: { ...state.submission } }
      } : null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.result = { id: "result-1", decidedAt: now, ...data };
        return { ...state.result };
      }),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (!state.result) throw new Error("result missing");
        Object.assign(state.result, data);
        return { ...state.result };
      })
    },
    presentationSubmission: {
      findFirst: vi.fn(async () => ({ ...state.submission })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(state.submission, data);
        return { ...state.submission };
      })
    },
    presentationSubmissionVersion: {
      findFirst: vi.fn(async () => {
        const latest = state.versions.at(-1);
        return latest ? { versionNo: latest.versionNo } : null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const version = { id: `version-${state.versions.length + 1}`, ...data };
        state.versions.push(version);
        return version;
      })
    },
    advisorRequest: {
      findFirst: vi.fn(async () => ({
        id: "advisor-request-1",
        projectId: state.project.id,
        advisorTeacherId: "advisor-1",
        status: state.latestAdvisorRequestStatus,
        reviewedAt: new Date("2026-07-15T03:00:00.000Z"),
        advisorTeacher: { id: "advisor-1", userId: "advisor-user", active: true }
      }))
    },
    committeeAssignment: { count: vi.fn(async () => state.activeCommitteeCount) },
    projectStatusHistory: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => state.histories.push(data)) },
    projectTimelineEvent: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => state.timeline.push(data)) },
    auditLog: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => state.audits.push(data)) },
    notification: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => state.notifications.push(data)) }
  };

  const db = {
    $transaction: vi.fn(async (operation: (client: typeof tx) => Promise<unknown>) => {
      const before = structuredClone(state);
      try {
        return await operation(tx);
      } catch (error) {
        state = before;
        throw error;
      }
    })
  } as unknown as Pick<PrismaClient, "$transaction">;

  return { db, read: () => state, tx };
}

async function decideRevision(harness: ReturnType<typeof createHarness>) {
  return saveAdminProposalFinalDecisionAtomic(harness.db, {
    actorUserId: "admin-user",
    requestId: "request-admin",
    assessmentAttemptId: "attempt-1",
    finalDecision: "PASS_WITH_REVISION",
    finalDecisionReason: "แก้ไขตามมติ"
  }, { now: () => now });
}

describe("Proposal revision lifecycle transactional services", () => {
  let harness: ReturnType<typeof createHarness>;

  beforeEach(() => {
    harness = createHarness();
  });

  it.each([
    ["PASS", "TOPIC_APPROVED", "LOCKED"],
    ["PASS_WITH_REVISION", "PROPOSAL_REVISION_REQUIRED", "RETURNED_FOR_REVISION"],
    ["NOT_PASS", "DRAFT", "SUBMITTED"]
  ] as const)("stores canonical Admin %s result and lifecycle evidence atomically", async (decision, projectStatus, submissionStatus) => {
    const outcome = await saveAdminProposalFinalDecisionAtomic(harness.db, {
      actorUserId: "admin-user",
      requestId: `request-${decision}`,
      assessmentAttemptId: "attempt-1",
      finalDecision: decision,
      finalDecisionReason: decision === "PASS" ? null : "มติที่ประชุม"
    }, { now: () => now });

    expect(outcome).toMatchObject({ unchanged: false, projectId: "project-1", proposalResultId: "result-1" });
    expect(harness.read().result).toMatchObject({
      finalDecision: decision,
      averageScore: 70,
      submittedCount: 2,
      missingCount: 0,
      passCount: 1,
      revisionCount: 1,
      notPassCount: 0
    });
    expect(harness.read().project.status).toBe(projectStatus);
    expect(harness.read().submission.status).toBe(submissionStatus);
    expect(harness.read().histories).toHaveLength(1);
    expect(harness.read().timeline).toHaveLength(1);
    expect(harness.read().audits).toHaveLength(1);
    expect(harness.read().notifications).toHaveLength(1);
    expect((harness.tx.assessmentAttempt as Record<string, unknown>).update).toBeUndefined();
  });

  it("rolls every Admin write back on a fault and deduplicates a committed retry", async () => {
    const input = {
      actorUserId: "admin-user",
      requestId: "request-admin-revision",
      assessmentAttemptId: "attempt-1",
      finalDecision: "PASS_WITH_REVISION" as const,
      finalDecisionReason: "แก้ไขตามมติ"
    };
    const before = structuredClone(harness.read());
    await expect(saveAdminProposalFinalDecisionAtomic(harness.db, input, {
      now: () => now,
      fault: (point) => { if (point === "admin_decision_evidence_saved") throw new Error("fault"); }
    })).rejects.toThrow("fault");
    expect(harness.read()).toEqual(before);

    expect((await saveAdminProposalFinalDecisionAtomic(harness.db, input, { now: () => now })).unchanged).toBe(false);
    expect((await saveAdminProposalFinalDecisionAtomic(harness.db, input, { now: () => now })).unchanged).toBe(true);
    expect(harness.read().audits).toHaveLength(1);
    expect(harness.read().notifications).toHaveLength(1);
  });

  it("compare-and-set edits the canonical revision decision before advisor certification", async () => {
    await decideRevision(harness);

    const edited = await saveAdminProposalFinalDecisionAtomic(harness.db, {
      actorUserId: "admin-user",
      requestId: "request-edit-pass",
      assessmentAttemptId: "attempt-1",
      finalDecision: "PASS",
      finalDecisionReason: null
    }, { now: () => now });

    expect(edited).toMatchObject({ unchanged: false, proposalResultId: "result-1" });
    expect(harness.read().result).toMatchObject({ id: "result-1", finalDecision: "PASS" });
    expect(harness.read().project.status).toBe("TOPIC_APPROVED");
    expect(harness.read().submission.status).toBe("LOCKED");
    expect(harness.read().audits.at(-1)).toMatchObject({
      action: "PROPOSAL_FINAL_DECISION_EDITED",
      beforeJson: { finalDecision: "PASS_WITH_REVISION" },
      afterJson: { finalDecision: "PASS" }
    });
  });

  it("requires audited unlock after certification, then permits the compare-and-set edit", async () => {
    await decideRevision(harness);
    await submitProposalRevisionAtomic(harness.db, revisionInput, { now: () => now });
    await reviewProposalRevisionByAdvisorAtomic(harness.db, {
      actorUserId: "advisor-user", requestId: "request-certify", projectId: "project-1", decision: "CERTIFY", reason: null
    }, { now: () => now });

    const editInput = {
      actorUserId: "admin-user",
      requestId: "request-edit-after-certify",
      assessmentAttemptId: "attempt-1",
      finalDecision: "PASS" as const,
      finalDecisionReason: null
    };
    await expect(saveAdminProposalFinalDecisionAtomic(harness.db, editInput)).rejects.toMatchObject({
      code: "PROPOSAL_FINAL_DECISION_UNLOCK_REQUIRED"
    });

    await unlockProposalRevisionAtomic(harness.db, {
      actorUserId: "admin-user",
      requestId: "request-unlock-for-edit",
      projectId: "project-1",
      reason: "เปิดเพื่อแก้ไขมติที่บันทึกคลาดเคลื่อน"
    }, { now: () => now });
    const edited = await saveAdminProposalFinalDecisionAtomic(harness.db, editInput, { now: () => now });

    expect(edited.unchanged).toBe(false);
    expect(harness.read().result).toMatchObject({ id: "result-1", finalDecision: "PASS" });
    expect(harness.read().project.status).toBe("TOPIC_APPROVED");
    expect(harness.read().submission.status).toBe("LOCKED");
  });

  it("never edits an old NOT_PASS/DRAFT result or legacy pending revision state", async () => {
    await saveAdminProposalFinalDecisionAtomic(harness.db, {
      actorUserId: "admin-user",
      requestId: "request-not-pass",
      assessmentAttemptId: "attempt-1",
      finalDecision: "NOT_PASS",
      finalDecisionReason: "ไม่ผ่านตามมติ"
    }, { now: () => now });
    await expect(saveAdminProposalFinalDecisionAtomic(harness.db, {
      actorUserId: "admin-user",
      requestId: "request-edit-old-not-pass",
      assessmentAttemptId: "attempt-1",
      finalDecision: "PASS_WITH_REVISION",
      finalDecisionReason: "ขอเปลี่ยนมติ"
    })).rejects.toMatchObject({ code: "PROPOSAL_NOT_PASS_DECISION_IMMUTABLE" });

    harness = createHarness();
    await decideRevision(harness);
    harness.read().project.status = "PROPOSAL_PENDING";
    await expect(saveAdminProposalFinalDecisionAtomic(harness.db, {
      actorUserId: "admin-user",
      requestId: "request-pending-bypass",
      assessmentAttemptId: "attempt-1",
      finalDecision: "PASS",
      finalDecisionReason: null
    })).rejects.toMatchObject({ code: "PROPOSAL_FINAL_DECISION_EDIT_STALE_STATE" });
  });

  it("allows a direct PASS correction only before active committee assignment", async () => {
    await saveAdminProposalFinalDecisionAtomic(harness.db, {
      actorUserId: "admin-user",
      requestId: "request-pass",
      assessmentAttemptId: "attempt-1",
      finalDecision: "PASS",
      finalDecisionReason: null
    }, { now: () => now });
    harness.read().activeCommitteeCount = 1;

    await expect(saveAdminProposalFinalDecisionAtomic(harness.db, {
      actorUserId: "admin-user",
      requestId: "request-edit-pass",
      assessmentAttemptId: "attempt-1",
      finalDecision: "PASS_WITH_REVISION",
      finalDecisionReason: "แก้ไขมติ"
    })).rejects.toMatchObject({ code: "ACTIVE_COMMITTEE_EXISTS" });
  });

  it("updates the same returned submission, appends one version, and creates no scoring records", async () => {
    await decideRevision(harness);
    const committed = await submitProposalRevisionAtomic(harness.db, revisionInput, { now: () => now });
    const retry = await submitProposalRevisionAtomic(harness.db, revisionInput, { now: () => now });

    expect(committed).toMatchObject({ unchanged: false, submissionId: "submission-1", versionNo: 1 });
    expect(retry).toMatchObject({ unchanged: true, submissionId: "submission-1", versionNo: 1 });
    expect(harness.read().submission).toMatchObject({ id: "submission-1", assessmentAttemptId: "attempt-1", status: "SUBMITTED" });
    expect(harness.read().versions).toHaveLength(1);
    expect(harness.read().result).toMatchObject({ finalDecision: "PASS_WITH_REVISION" });
    expect((harness.tx as Record<string, unknown>).evaluatorAssignment).toBeUndefined();
    expect((harness.tx as Record<string, unknown>).proposalVote).toBeUndefined();
    expect((harness.tx as Record<string, unknown>).scoreSubmission).toBeUndefined();
  });

  it("requires the latest AdvisorRequest overall to be APPROVED", async () => {
    await decideRevision(harness);
    harness.read().latestAdvisorRequestStatus = "REJECTED";

    await expect(submitProposalRevisionAtomic(harness.db, revisionInput)).rejects.toMatchObject({
      code: "APPROVED_ADVISOR_NOT_FOUND"
    });
  });

  it("rolls a revision version, submission, evidence, and notification back together", async () => {
    await decideRevision(harness);
    const before = structuredClone(harness.read());
    await expect(submitProposalRevisionAtomic(harness.db, revisionInput, {
      now: () => now,
      fault: (point) => { if (point === "student_revision_evidence_saved") throw new Error("fault"); }
    })).rejects.toThrow("fault");
    expect(harness.read()).toEqual(before);
  });

  it("requires the latest approved advisor and a reason when returning a revision", async () => {
    await decideRevision(harness);
    await submitProposalRevisionAtomic(harness.db, revisionInput, { now: () => now });

    await expect(reviewProposalRevisionByAdvisorAtomic(harness.db, {
      actorUserId: "advisor-user", requestId: "request-return", projectId: "project-1", decision: "RETURN", reason: ""
    })).rejects.toMatchObject({ code: "ADVISOR_RETURN_REASON_REQUIRED" });
    await expect(reviewProposalRevisionByAdvisorAtomic(harness.db, {
      actorUserId: "other-teacher-user", requestId: "request-other", projectId: "project-1", decision: "CERTIFY", reason: null
    })).rejects.toMatchObject({ code: "ADVISOR_NOT_AUTHORIZED" });
  });

  it("returns or certifies the revision without changing the canonical Admin result", async () => {
    await decideRevision(harness);
    await submitProposalRevisionAtomic(harness.db, revisionInput, { now: () => now });
    await reviewProposalRevisionByAdvisorAtomic(harness.db, {
      actorUserId: "advisor-user", requestId: "request-return", projectId: "project-1", decision: "RETURN", reason: "กรุณาแก้วัตถุประสงค์"
    }, { now: () => now });
    expect(harness.read().submission.status).toBe("RETURNED_FOR_REVISION");

    await submitProposalRevisionAtomic(harness.db, {
      ...revisionInput,
      requestId: "request-revision-2",
      abstractText: "บทคัดย่อฉบับแก้ไขครั้งที่สอง"
    }, { now: () => now });
    const certifyInput = {
      actorUserId: "advisor-user",
      requestId: "request-certify",
      projectId: "project-1",
      decision: "CERTIFY" as const,
      reason: null
    };
    expect((await reviewProposalRevisionByAdvisorAtomic(harness.db, certifyInput, { now: () => now })).unchanged).toBe(false);
    expect((await reviewProposalRevisionByAdvisorAtomic(harness.db, { ...certifyInput, requestId: "retry" }, { now: () => now })).unchanged).toBe(true);
    expect(harness.read().project.status).toBe("TOPIC_APPROVED");
    expect(harness.read().submission.status).toBe("LOCKED");
    expect(harness.read().result).toMatchObject({ finalDecision: "PASS_WITH_REVISION" });
    expect(harness.read().versions).toHaveLength(2);
  });

  it("rolls advisor evidence back on a fault", async () => {
    await decideRevision(harness);
    await submitProposalRevisionAtomic(harness.db, revisionInput, { now: () => now });
    const before = structuredClone(harness.read());
    await expect(reviewProposalRevisionByAdvisorAtomic(harness.db, {
      actorUserId: "advisor-user", requestId: "request-certify", projectId: "project-1", decision: "CERTIFY", reason: null
    }, {
      now: () => now,
      fault: (point) => { if (point === "advisor_revision_evidence_saved") throw new Error("fault"); }
    })).rejects.toThrow("fault");
    expect(harness.read()).toEqual(before);
  });

  it("allows an audited Admin unlock only before an active committee and deduplicates retry evidence", async () => {
    await decideRevision(harness);
    await submitProposalRevisionAtomic(harness.db, revisionInput, { now: () => now });
    await reviewProposalRevisionByAdvisorAtomic(harness.db, {
      actorUserId: "advisor-user", requestId: "request-certify", projectId: "project-1", decision: "CERTIFY", reason: null
    }, { now: () => now });

    const input = {
      actorUserId: "admin-user",
      requestId: "request-unlock",
      projectId: "project-1",
      reason: "เปิดให้แก้ไขตามคำสั่งที่ประชุม"
    };
    expect((await unlockProposalRevisionAtomic(harness.db, input, { now: () => now })).unchanged).toBe(false);
    const evidenceCount = harness.read().audits.length;
    expect((await unlockProposalRevisionAtomic(harness.db, { ...input, requestId: "retry" }, { now: () => now })).unchanged).toBe(true);
    expect(harness.read().project.status).toBe("PROPOSAL_REVISION_REQUIRED");
    expect(harness.read().submission.status).toBe("RETURNED_FOR_REVISION");
    expect(harness.read().audits).toHaveLength(evidenceCount);
  });

  it("rejects unlock after committee assignment and rolls a failed unlock back", async () => {
    await decideRevision(harness);
    await submitProposalRevisionAtomic(harness.db, revisionInput, { now: () => now });
    await reviewProposalRevisionByAdvisorAtomic(harness.db, {
      actorUserId: "advisor-user", requestId: "request-certify", projectId: "project-1", decision: "CERTIFY", reason: null
    }, { now: () => now });
    const certified = structuredClone(harness.read());
    const input = { actorUserId: "admin-user", requestId: "request-unlock", projectId: "project-1", reason: "เปิดให้แก้ไข" };

    await expect(unlockProposalRevisionAtomic(harness.db, input, {
      now: () => now,
      fault: (point) => { if (point === "admin_unlock_evidence_saved") throw new Error("fault"); }
    })).rejects.toThrow("fault");
    expect(harness.read()).toEqual(certified);

    harness.read().activeCommitteeCount = 1;
    await expect(unlockProposalRevisionAtomic(harness.db, input)).rejects.toMatchObject({ code: "ACTIVE_COMMITTEE_EXISTS" });
  });
});
