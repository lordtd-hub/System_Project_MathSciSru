import { beforeEach, describe, expect, it, vi } from "vitest";

type FakeState = {
  submission: null | {
    id: string;
    totalScore: number;
    overallComment: string | null;
    status: "SUBMITTED";
    scoreItems: Array<{
      rubricItemId: string;
      checked: boolean;
      pointsAwarded: number;
      comment: null;
      rubricItem: { itemKey: string };
    }>;
  };
  latestAudit: unknown;
  auditCount: number;
  timelineCount: number;
  projectStatus: "IN_PROGRESS" | "FINAL_DONE";
  historyCount: number;
};

const fake = vi.hoisted(() => {
  const initialState = (): FakeState => ({
    submission: null,
    latestAudit: null,
    auditCount: 0,
    timelineCount: 0,
    projectStatus: "IN_PROGRESS",
    historyCount: 0
  });
  let committed = initialState();
  let working = committed;
  let failAfterWrite: number | null = null;
  let writeCount = 0;
  let roundType: "PROGRESS_1" | "FINAL_PRESENTATION" = "PROGRESS_1";

  const write = async <T>(mutation: () => T) => {
    writeCount += 1;
    const result = mutation();
    if (failAfterWrite === writeCount) throw new Error(`fault-after-write-${writeCount}`);
    return result;
  };

  const tx = {
    $executeRawUnsafe: async () => 0,
    $queryRaw: async () => [{ id: "locked" }],
    project: {
      findUnique: async () => ({
        id: "project-1",
        status: working.projectStatus,
        committeeAssignments: [{ active: true, teacherId: "teacher-1", role: "MEMBER" }]
      }),
      update: async () => write(() => {
        working.projectStatus = "FINAL_DONE";
        return { id: "project-1", status: working.projectStatus };
      })
    },
    assessmentRound: { findUnique: async () => ({ id: "round-1", roundType, status: "SCORING_OPEN" }) },
    projectRoundException: { findMany: async () => [] },
    examScheduleProposal: { findFirst: async () => ({ id: "schedule-1" }) },
    assessmentAttempt: {
      upsert: async () => write(() => ({ id: "attempt-1" }))
    },
    evaluatorAssignment: {
      upsert: async () => write(() => ({ id: "assignment-1" })),
      update: async () => write(() => ({ id: "assignment-1" })),
      findMany: async () => [{ teacherId: "teacher-1", scoreSubmission: { status: "SUBMITTED" } }]
    },
    scoreSubmission: {
      findUnique: async () => working.submission,
      upsert: async ({ update, create }: { update: { totalScore: number; overallComment: string | null }; create: { totalScore: number; overallComment: string | null } }) => write(() => {
        const values = working.submission ? update : create;
        working.submission = {
          id: "submission-1",
          totalScore: Number(values.totalScore),
          overallComment: values.overallComment,
          status: "SUBMITTED",
          scoreItems: working.submission?.scoreItems ?? []
        };
        return working.submission;
      })
    },
    scoreItem: {
      deleteMany: async () => write(() => {
        if (working.submission) working.submission.scoreItems = [];
        return { count: 0 };
      }),
      upsert: async ({ create }: { create: { rubricItemId: string; checked: boolean; pointsAwarded: number } }) => write(() => {
        if (working.submission) {
          working.submission.scoreItems.push({
            rubricItemId: create.rubricItemId,
            checked: create.checked,
            pointsAwarded: create.pointsAwarded,
            comment: null,
            rubricItem: { itemKey: "criterion-a" }
          });
        }
        return create;
      })
    },
    auditLog: {
      findFirst: async () => working.latestAudit ? { afterJson: working.latestAudit } : null,
      create: async ({ data }: { data: { afterJson: unknown } }) => write(() => {
        working.latestAudit = data.afterJson;
        working.auditCount += 1;
        return { id: `audit-${working.auditCount}` };
      })
    },
    projectTimelineEvent: {
      create: async () => write(() => {
        working.timelineCount += 1;
        return { id: `timeline-${working.timelineCount}` };
      })
    },
    projectStatusHistory: {
      create: async () => write(() => {
        working.historyCount += 1;
        return { id: `history-${working.historyCount}` };
      })
    }
  };

  return {
    prisma: {
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => {
        working = structuredClone(committed);
        writeCount = 0;
        try {
          const result = await callback(tx);
          committed = structuredClone(working);
          return result;
        } finally {
          working = committed;
        }
      }
    },
    reset() {
      committed = initialState();
      working = committed;
      failAfterWrite = null;
      writeCount = 0;
      roundType = "PROGRESS_1";
    },
    failAt(step: number | null) {
      failAfterWrite = step;
    },
    state() {
      return structuredClone(committed) as FakeState;
    },
    writes() {
      return writeCount;
    },
    useRound(value: "PROGRESS_1" | "FINAL_PRESENTATION") {
      roundType = value;
    }
  };
});

vi.mock("@/lib/db", () => ({ prisma: fake.prisma }));

import { persistPresentationScore } from "./persistPresentationScore";

const input = {
  requestId: "request-1",
  actorUserId: "user-1",
  teacherId: "teacher-1",
  evaluatorDisplayName: "อาจารย์ทดสอบ",
  projectId: "project-1",
  assessmentRoundId: "round-1",
  roundType: "PROGRESS_1" as const,
  attemptType: "PROGRESS_1" as const,
  assessmentKind: "PROGRESS_1" as const,
  allowedProjectStatuses: ["IN_PROGRESS" as const],
  rawTotalScore: 10,
  overallComment: "ตรวจแล้ว",
  items: [{ id: "rubric-1", itemKey: "criterion-a", checked: true, pointsAwarded: 10, conditionCount: 2 }],
  eventType: "PROGRESS_1_SCORE_SUBMITTED",
  createEventTitle: "บันทึกคะแนน",
  updateEventTitle: "แก้ไขคะแนน",
  auditAction: "PROGRESS_1_SCORE_SAVED"
};

const finalInput = {
  ...input,
  requestId: "request-final",
  roundType: "FINAL_PRESENTATION" as const,
  attemptType: "FINAL_PRESENTATION" as const,
  assessmentKind: "FINAL_PRESENT" as const,
  eventType: "FINAL_PRESENTATION_SCORE_SUBMITTED",
  auditAction: "FINAL_PRESENTATION_SCORE_SAVED",
  completeFinalWhenReady: true
};

const emptyState = (): FakeState => ({
  submission: null,
  latestAudit: null,
  auditCount: 0,
  timelineCount: 0,
  projectStatus: "IN_PROGRESS",
  historyCount: 0
});

describe("atomic presentation score persistence", () => {
  beforeEach(() => fake.reset());

  it("rolls back the complete mutation when every individual write position is faulted", async () => {
    await persistPresentationScore(input);
    const writePositions = fake.writes();
    expect(writePositions).toBeGreaterThan(5);

    for (let step = 1; step <= writePositions; step += 1) {
      fake.reset();
      fake.failAt(step);
      await expect(persistPresentationScore(input)).rejects.toThrow(`fault-after-write-${step}`);
      expect(fake.state()).toEqual(emptyState());
    }
  });

  it("treats an identical retry as a no-op without duplicate audit or timeline evidence", async () => {
    const first = await persistPresentationScore(input);
    const second = await persistPresentationScore(input);

    expect(first.unchanged).toBe(false);
    expect(second.unchanged).toBe(true);
    expect(fake.state().auditCount).toBe(1);
    expect(fake.state().timelineCount).toBe(1);
  });

  it("rolls back Final project completion, history, and both timeline writes at every fault position", async () => {
    fake.useRound("FINAL_PRESENTATION");
    await persistPresentationScore(finalInput);
    const writePositions = fake.writes();
    expect(fake.state()).toMatchObject({ projectStatus: "FINAL_DONE", historyCount: 1, timelineCount: 2 });

    for (let step = 1; step <= writePositions; step += 1) {
      fake.reset();
      fake.useRound("FINAL_PRESENTATION");
      fake.failAt(step);
      await expect(persistPresentationScore(finalInput)).rejects.toThrow(`fault-after-write-${step}`);
      expect(fake.state()).toEqual(emptyState());
    }
  });
});
