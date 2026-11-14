import type { Prisma } from "@prisma/client";
import { AcademicWorkflowError } from "./errors";

/** Faculty mutations are pinned to a real project, never to a browser context cookie. */
export async function assertTeacherProjectWritable(db: Pick<Prisma.TransactionClient, "project">, projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { courseOffering: { select: { status: true } } } });
  if (project?.courseOffering?.status !== "ACTIVE") throw new AcademicWorkflowError("อาจารย์จัดการได้เฉพาะรายวิชาที่เปิดอยู่ งาน I ของรายวิชาปิดให้ผู้ดูแลระบบบันทึก");
}
export async function lockTeacherProject(tx: Prisma.TransactionClient, projectId: string) {
  // Same lock order as closing a course: course first, then project.
  await tx.$queryRaw`SELECT co.id FROM course_offerings co JOIN projects p ON p.course_offering_id=co.id WHERE p.id=${projectId} FOR SHARE OF co`;
  await tx.$queryRaw`SELECT id FROM projects WHERE id=${projectId} FOR UPDATE`;
  await assertTeacherProjectWritable(tx, projectId);
}
