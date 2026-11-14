import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("admin closeout source guards", () => {
  it("keeps closeout page admin guarded and decision-focused", () => {
    const page = read("src/app/admin/closeout/page.tsx");

    expect(page).toContain("auth()");
    expect(page).toContain('session?.user.role !== "ADMIN"');
    expect(page).toContain("getCompletionEligibility");
    expect(page).toContain("คะแนนสอบความก้าวหน้าครั้งที่ 1");
    expect(page).toContain("คะแนนสอบความก้าวหน้าครั้งที่ 2");
    expect(page).toContain("คะแนนสอบนำเสนอขั้นสุดท้าย");
    expect(page).toContain("คะแนนสรุปของอาจารย์ที่ปรึกษา 25%");
    expect(page).toContain("completeProjectCloseout");
  });

  it("keeps completion action admin-only and server-side eligibility gated", () => {
    const actions = read("src/app/admin/actions.ts");
    const start = actions.indexOf("export async function completeProjectCloseout");
    const slice = actions.slice(start);

    expect(slice).toContain("requireAdminUserId()");
    expect(slice).toContain("completeProjectAtomic(prisma");
    const service = read("src/lib/lifecycle/completeProject.ts");
    expect(service).toContain("getCompletionEligibilityFromDb(tx, project.id)");
    expect(service).toContain("!eligibility.eligible");
    expect(service).toContain("project.updateMany");
    expect(service).toContain("eligibility.workflowVersion !== input.expectedVersion");
    expect(service).toContain("changed.count !== 1");
    expect(service).toContain('toStatus: "COMPLETED"');
    expect(service).toContain('"ADMIN_MARKED_COMPLETED"');
    expect(service).toContain('eventType: "PROJECT_COMPLETED"');
    expect(service).toContain('action: "PROJECT_COMPLETED"');
  });

  it("does not allow repeated closeout to write duplicate completion history", () => {
    const service = read("src/lib/lifecycle/completeProject.ts");
    expect(service).toContain('project.status === "COMPLETED"');
    expect(service).toContain("payloadHash");
    expect(service).toContain("unchanged: true");
    expect(service).toContain("โครงงานปิดจบแล้ว");
  });
});
