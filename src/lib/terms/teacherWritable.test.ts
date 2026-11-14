import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { assertTeacherProjectWritable, lockTeacherProject } from "./teacherWritable";
describe("faculty current-course write boundary", () => {
  it.each(["CLOSED", "DRAFT", "missing"])("denies %s even for an unresolved I", async status => {
    const db = { project: { findUnique: vi.fn(async () => status === "missing" ? null : { courseOffering: { status }, academicResult: { status: "INCOMPLETE" } }) } };
    await expect(assertTeacherProjectWritable(db as unknown as Prisma.TransactionClient, "p")).rejects.toThrow("เฉพาะรายวิชาที่เปิด");
  });
  it("locks the actual course before its project, then checks ACTIVE inside the transaction", async () => {
    const calls: string[] = [];
    const db = { $queryRaw: vi.fn(async (query: TemplateStringsArray) => { calls.push(query.join("?")); return []; }),
      project: { findUnique: vi.fn(async () => { calls.push("read current status"); return { courseOffering: { status: "ACTIVE" } }; }) } };
    await lockTeacherProject(db as unknown as Prisma.TransactionClient, "p");
    expect(calls[0]).toContain("FOR SHARE OF co"); expect(calls[1]).toContain("FOR UPDATE"); expect(calls[2]).toBe("read current status");
  });
});
