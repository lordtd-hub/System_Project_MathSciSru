import type { Prisma } from "@prisma/client";

// Separate from late exceptions: this grants access, never creates/waives a penalty.
export async function hasIncompleteRoundAccess(db: Pick<Prisma.TransactionClient, "incompleteContinuation">, projectId: string, assessmentRoundId: string) {
  return Boolean(await db.incompleteContinuation.findFirst({ where: {
    projectId, assessmentRoundId, status: "OPEN", academicResult: { status: "INCOMPLETE" }
  }, select: { id: true } }));
}
