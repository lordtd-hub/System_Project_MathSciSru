import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("LINE webhook source", () => {
  it("keeps the LINE webhook on the Node runtime and verifies LINE signatures", () => {
    const route = read("src/app/api/line/webhook/route.ts");

    expect(route).toContain('export const runtime = "nodejs"');
    expect(route).toContain("process.env.LINE_CHANNEL_SECRET");
    expect(route).toContain("request.headers.get(\"x-line-signature\")");
    expect(route).toContain("verifyLineSignature");
    expect(route).toContain("invalid_line_signature");
  });

  it("only logs setup metadata needed to find the groupId", () => {
    const route = read("src/app/api/line/webhook/route.ts");
    const helper = read("src/lib/notifications/lineWebhook.ts");

    expect(route).toContain("LINE webhook group source detected");
    expect(route).toContain("groupIds");
    expect(helper).toContain("groupId");
    expect(helper).toContain("messageType");
    expect(helper).not.toContain("text");
  });

  it("documents LINE setup env values without storing secrets", () => {
    const envExample = read(".env.example");
    const notes = read("e2e-artifacts/line-notifications/LINE_NOTIFICATION_SETUP_NOTES.md");

    expect(envExample).toContain("LINE_NOTIFICATIONS_ENABLED");
    expect(envExample).toContain("LINE_CHANNEL_ACCESS_TOKEN");
    expect(envExample).toContain("LINE_CHANNEL_SECRET");
    expect(envExample).toContain("LINE_TEACHER_GROUP_ID");
    expect(notes).toContain("@428chrry");
    expect(notes).toContain("/api/line/webhook");
  });
});
