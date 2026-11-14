import type { Prisma } from "@prisma/client";
import { AcademicWorkflowError } from "./errors";
export async function lockWritableProject(tx: Prisma.TransactionClient, projectId: string) {
  await tx.$queryRaw`SELECT co.id FROM course_offerings co JOIN projects p ON p.course_offering_id=co.id WHERE p.id=${projectId} FOR SHARE OF co`;
  await tx.$queryRaw`SELECT id FROM projects WHERE id=${projectId} FOR UPDATE`;
  await assertProjectCourseWritable(tx, projectId);
}
export async function assertProjectCourseWritable(db: Pick<Prisma.TransactionClient, "project">, projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { courseOffering: { select: { status: true } }, academicResult: { select: { status: true } } } });
  if (!project || (project.courseOffering.status === "CLOSED" && project.academicResult?.status !== "INCOMPLETE")) throw new AcademicWorkflowError("รายวิชาปิดผลแล้ว ต้องตรวจภาคเรียนและผล I ก่อนแก้คะแนน");
}
