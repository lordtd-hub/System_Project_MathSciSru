import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { openCourseRoundAtomic, type OpenCourseRoundInput } from "./openCourseRoundAtomic";

type State = {
  proposalStatus: "DRAFT" | "SCORING_OPEN" | "SCORING_CLOSED";
  progress1: Record<string, unknown> | null;
  audits: Array<Record<string, unknown>>;
  projects: Array<Record<string, unknown>>;
};

const baseInput: OpenCourseRoundInput = {
  actorUserId: "admin-1",
  requestId: "request-1",
  courseOfferingId: "course-1",
  roundType: "PROGRESS_1",
  openMode: "SCHEDULED_ZERO_READY",
  reason: "เปิดตามปฏิทินรายวิชา"
};

function eligibleProject() {
  return {
    id: "project-1",
    status: "TOPIC_APPROVED",
    currentTitleTh: "หัวข้อทดสอบ",
    student: { studentCode: "650000001", firstNameTh: "ทดสอบ", lastNameTh: "ระบบ" },
    proposalResults: [{ finalDecision: "PASS" }],
    committeeAssignments: [
      { role: "ADVISOR", active: true, teacherId: "advisor" },
      { role: "HEAD", active: true, teacherId: "head" },
      { role: "MEMBER", active: true, teacherId: "member" }
    ],
    assessmentSubmissions: [],
    attempts: [],
    roundExceptions: []
  };
}

function transactionalHarness(initial: State) {
  let state = structuredClone(initial);
  let serial = Promise.resolve();
  const read = () => state;
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: "course-1" }]),
    assessmentRound: {
      findMany: vi.fn(async () => [
        { id: "proposal-round", roundType: "PROPOSAL", status: read().proposalStatus },
        ...(read().progress1 ? [read().progress1] : [])
      ]),
      upsert: vi.fn(async ({ create, update }) => {
        const committed = read().progress1
          ? { ...read().progress1, ...update }
          : { id: "progress-1-round", ...create };
        read().progress1 = committed;
        return committed;
      })
    },
    project: { findMany: vi.fn(async () => read().projects) },
    auditLog: { create: vi.fn(async ({ data }) => read().audits.push(data)) }
  };
  const db = {
    $transaction: vi.fn((operation: (client: typeof tx) => Promise<unknown>) => {
      const run = async () => {
        const before = structuredClone(state);
        try {
          return await operation(tx);
        } catch (error) {
          state = before;
          throw error;
        }
      };
      const result = serial.then(run, run);
      serial = result.then(() => undefined, () => undefined);
      return result;
    })
  } as unknown as Pick<PrismaClient, "$transaction">;
  return { db, read };
}

describe("atomic course round opening", () => {
  it("blocks the zero-ready override until Proposal is closed", async () => {
    const harness = transactionalHarness({ proposalStatus: "SCORING_OPEN", progress1: null, audits: [], projects: [] });
    await expect(openCourseRoundAtomic(harness.db, baseInput)).rejects.toMatchObject({
      code: "ROUND_OPEN_BLOCKED_proposal_must_close_first"
    });
    expect(harness.read().progress1).toBeNull();
    expect(harness.read().audits).toHaveLength(0);
  });

  it("requires an explicit mode and reason when no project is ready", async () => {
    const normalHarness = transactionalHarness({ proposalStatus: "SCORING_CLOSED", progress1: null, audits: [], projects: [] });
    await expect(openCourseRoundAtomic(normalHarness.db, { ...baseInput, openMode: "NORMAL", reason: null }))
      .rejects.toMatchObject({ code: "ROUND_OPEN_BLOCKED_progress_1_not_ready" });

    const noReasonHarness = transactionalHarness({ proposalStatus: "SCORING_CLOSED", progress1: null, audits: [], projects: [] });
    await expect(openCourseRoundAtomic(noReasonHarness.db, { ...baseInput, reason: null }))
      .rejects.toMatchObject({ code: "OVERRIDE_REASON_REQUIRED" });
    expect(noReasonHarness.read().audits).toHaveLength(0);
  });

  it("opens Progress 1 with zero ready projects and records complete audit metadata", async () => {
    const harness = transactionalHarness({ proposalStatus: "SCORING_CLOSED", progress1: null, audits: [], projects: [] });
    const outcome = await openCourseRoundAtomic(harness.db, baseInput, {
      now: () => new Date("2026-08-15T09:00:00.000Z")
    });

    expect(outcome).toMatchObject({ unchanged: false, eligibleProjectCount: 0, scheduledZeroReady: true });
    expect(harness.read().progress1).toMatchObject({ status: "SUBMISSION_OPEN" });
    expect(harness.read().audits).toHaveLength(1);
    expect(harness.read().audits[0]).toMatchObject({
      action: "ASSESSMENT_ROUND_OPENED",
      metadataJson: {
        eligibleProjectCount: 0,
        scheduledZeroReady: true,
        reason: baseInput.reason,
        requestId: baseInput.requestId
      }
    });
  });

  it("uses the normal flow once a project is ready", async () => {
    const harness = transactionalHarness({
      proposalStatus: "SCORING_CLOSED",
      progress1: null,
      audits: [],
      projects: [eligibleProject()]
    });
    const outcome = await openCourseRoundAtomic(harness.db, { ...baseInput, openMode: "NORMAL", reason: null });

    expect(outcome).toMatchObject({ eligibleProjectCount: 1, scheduledZeroReady: false });
    expect(harness.read().audits[0]).toMatchObject({
      metadataJson: { eligibleProjectCount: 1, scheduledZeroReady: false, reason: null }
    });
  });

  it("serializes concurrent requests and creates one round and one audit", async () => {
    const harness = transactionalHarness({ proposalStatus: "SCORING_CLOSED", progress1: null, audits: [], projects: [] });
    const [first, second] = await Promise.all([
      openCourseRoundAtomic(harness.db, baseInput),
      openCourseRoundAtomic(harness.db, { ...baseInput, requestId: "request-2" })
    ]);

    expect([first.unchanged, second.unchanged].sort()).toEqual([false, true]);
    expect(harness.read().audits).toHaveLength(1);
  });

  it("rolls the round back if audit creation cannot complete", async () => {
    const harness = transactionalHarness({ proposalStatus: "SCORING_CLOSED", progress1: null, audits: [], projects: [] });
    await expect(openCourseRoundAtomic(harness.db, baseInput, {
      fault: (point) => { if (point === "round_opened") throw new Error("fault after round write"); }
    })).rejects.toThrow("fault after round write");

    expect(harness.read().progress1).toBeNull();
    expect(harness.read().audits).toHaveLength(0);
  });
});
