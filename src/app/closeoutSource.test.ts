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
    expect(page).toContain("Progress 1 score");
    expect(page).toContain("Progress 2 score");
    expect(page).toContain("Final Presentation score");
    expect(page).toContain("Advisor score 25%");
    expect(page).toContain("completeProjectCloseout");
  });

  it("keeps completion action admin-only and server-side eligibility gated", () => {
    const actions = read("src/app/admin/actions.ts");
    const start = actions.indexOf("export async function completeProjectCloseout");
    const slice = actions.slice(start);

    expect(slice).toContain("requireAdminUserId()");
    expect(slice).toContain("getCompletionEligibility(projectId)");
    expect(slice).toContain("!eligibility.eligible");
    expect(slice).toContain("project.updateMany");
    expect(slice).toContain('status: "ADVISOR_SCORING"');
    expect(slice).toContain("updated.count !== 1");
    expect(slice).toContain('toStatus: "COMPLETED"');
    expect(slice).toContain('reason: "ADMIN_MARKED_COMPLETED"');
    expect(slice).toContain('eventType: "PROJECT_COMPLETED"');
    expect(slice).toContain('action: "PROJECT_COMPLETED"');
  });

  it("does not allow repeated closeout to write duplicate completion history", () => {
    const actions = read("src/app/admin/actions.ts");
    const start = actions.indexOf("export async function completeProjectCloseout");
    const slice = actions.slice(start);

    expect(slice).toContain('project.status === "COMPLETED"');
    expect(slice).toContain("โครงงานนี้เสร็จสมบูรณ์แล้ว");
  });
});
