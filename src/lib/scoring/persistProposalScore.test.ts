import { beforeEach, describe, expect, it, vi } from "vitest";

type ProposalState = {
  submission: null | {
    id: string;
    totalScore: number;
    overallComment: string | null;
    status: "DRAFT" | "SUBMITTED";
    proposalDecision: { decision: string; reason: string | null } | null;
    scoreItems: Array<{
      rubricItemId: string;
      checked: boolean;
      pointsAwarded: number;
      comment: null;
      rubricItem: { itemKey: string };
    }>;
  };
  assignmentStatus: "ASSIGNED" | "SUBMITTED";
  projectStatus: "PROPOSAL_REVIEW" | "PROPOSAL_ADMIN_DECISION";
  voteCount: number;
  auditCount: number;
  timelineCount: number;
  historyCount: number;
  latestAudit: unknown;
};

const fake = vi.hoisted(() => {
  const initialState = (): ProposalState => ({
    submission: null,
    assignmentStatus: "ASSIGNED",
    projectStatus: "PROPOSAL_REVIEW",
    voteCount: 0,
    auditCount: 0,
    timelineCount: 0,
    historyCount: 0,
    latestAudit: null
  });
  let committed = initialState();
  let working = committed;
  let failAfterWrite: number | null = null;
  let writeCount = 0;

  const write = async <T>(mutation: () => T) => {
    writeCount += 1;
    const result = mutation();
    if (failAfterWrite === writeCount) throw new Error(`fault-after-write-${writeCount}`);
    return result;
  };

  const assignment = () => ({
    id: "assignment-1",
    assessmentAttemptId: "attempt-1",
    evaluatorUserId: "user-1",
    teacherId: "teacher-1",
    status: working.assignmentStatus,
    assessmentAttempt: {
      id: "attempt-1",
      projectId: "project-1",
      assessmentRoundId: "round-1",
      proposalResult: null,
      assessmentRound: { id: "round-1", status: "SCORING_OPEN" }
    },
    scoreSubmission: working.submission
  });

  const tx = {
    $executeRawUnsafe: async () => 0,
    $queryRaw: async () => [{ id: "locked" }],
    evaluatorAssignment: {
      findUnique: async ({ select }: { select?: unknown }) => select
        ? { assessmentAttempt: { projectId: "project-1" } }
        : assignment(),
      update: async () => write(() => {
        working.assignmentStatus = "SUBMITTED";
        return assignment();
      }),
      count: async () => 0
    },
    projectRoundException: { findMany: async () => [] },
    scoreSubmission: {
      upsert: async ({ update, create }: {
        update: { totalScore: number; overallComment: string | null; status: "DRAFT" | "SUBMITTED" };
        create: { totalScore: number; overallComment: string | null; status: "DRAFT" | "SUBMITTED" };
      }) => write(() => {
        const values = working.submission ? update : create;
        working.submission = {
          id: "submission-1",
          totalScore: Number(values.totalScore),
          overallComment: values.overallComment,
          status: values.status,
          proposalDecision: working.submission?.proposalDecision ?? null,
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
        working.submission?.scoreItems.push({
          rubricItemId: create.rubricItemId,
          checked: create.checked,
          pointsAwarded: create.pointsAwarded,
          comment: null,
          rubricItem: { itemKey: "proposal-criterion" }
        });
        return create;
      })
    },
    proposalEvaluatorDecision: {
      upsert: async ({ create }: { create: { decision: string; reason: string | null } }) => write(() => {
        if (working.submission) working.submission.proposalDecision = create;
        return create;
      }),
      deleteMany: async () => write(() => {
        if (working.submission) working.submission.proposalDecision = null;
        return { count: 0 };
      })
    },
    proposalVote: {
      upsert: async () => write(() => {
        working.voteCount = 1;
        return { id: "vote-1" };
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
    project: {
      findUniqueOrThrow: async () => ({ id: "project-1", status: working.projectStatus }),
      update: async () => write(() => {
        working.projectStatus = "PROPOSAL_ADMIN_DECISION";
        return { id: "project-1", status: working.projectStatus };
      })
    },
    projectStatusHistory: {
      create: async () => write(() => {
        working.historyCount += 1;
        return { id: `history-${working.historyCount}` };
      })
    },
    projectTimelineEvent: {
      create: async () => write(() => {
        working.timelineCount += 1;
        return { id: `timeline-${working.timelineCount}` };
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
    },
    failAt(step: number | null) {
      failAfterWrite = step;
    },
    state() {
      return structuredClone(committed) as ProposalState;
    },
    writes() {
      return writeCount;
    }
  };
});

vi.mock("@/lib/db", () => ({ prisma: fake.prisma }));

import { persistProposalScore } from "./persistProposalScore";

const baseInput = {
  requestId: "request-proposal",
  actorUserId: "user-1",
  assignmentId: "assignment-1",
  submit: false,
  decision: "PASS" as const,
  reason: "",
  overallComment: "ตรวจแล้ว",
  rawTotalScore: 10,
  items: [{
    id: "rubric-1",
    itemKey: "proposal-criterion",
    checked: true,
    pointsAwarded: 10,
    conditionCount: 2,
    isCritical: false,
    itemLabelTh: "เกณฑ์ทดสอบ"
  }]
};

const emptyState = (): ProposalState => ({
  submission: null,
  assignmentStatus: "ASSIGNED",
  projectStatus: "PROPOSAL_REVIEW",
  voteCount: 0,
  auditCount: 0,
  timelineCount: 0,
  historyCount: 0,
  latestAudit: null
});

async function expectEveryWriteToRollback(input: typeof baseInput) {
  await persistProposalScore(input);
  const writePositions = fake.writes();
  expect(writePositions).toBeGreaterThan(3);

  for (let step = 1; step <= writePositions; step += 1) {
    fake.reset();
    fake.failAt(step);
    await expect(persistProposalScore(input)).rejects.toThrow(`fault-after-write-${step}`);
    expect(fake.state()).toEqual(emptyState());
  }
}

describe("atomic Proposal score persistence", () => {
  beforeEach(() => fake.reset());

  it("rolls back Draft and final Submit at every write position", async () => {
    await expectEveryWriteToRollback(baseInput);
    fake.reset();
    await expectEveryWriteToRollback({ ...baseInput, submit: true });
  });

  it("rolls back a submitted score revision without changing prior evidence", async () => {
    const submitInput = { ...baseInput, submit: true };
    const revisionInput = {
      ...submitInput,
      requestId: "request-revision",
      decision: "PASS_WITH_REVISION" as const,
      reason: "แก้ไขเอกสาร",
      overallComment: "ตรวจแก้แล้ว",
      rawTotalScore: 5,
      items: [{ ...baseInput.items[0], pointsAwarded: 5, conditionCount: 1 }]
    };

    await persistProposalScore(submitInput);
    await persistProposalScore(revisionInput);
    const revisionWritePositions = fake.writes();

    for (let step = 1; step <= revisionWritePositions; step += 1) {
      fake.reset();
      await persistProposalScore(submitInput);
      const beforeRevision = fake.state();
      fake.failAt(step);
      await expect(persistProposalScore(revisionInput)).rejects.toThrow(`fault-after-write-${step}`);
      expect(fake.state()).toEqual(beforeRevision);
    }
  });
});
