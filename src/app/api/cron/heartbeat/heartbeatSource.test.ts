import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Supabase heartbeat cron source", () => {
  it("keeps the cron endpoint protected with CRON_SECRET", () => {
    const route = read("src/app/api/cron/heartbeat/route.ts");

    expect(route).toContain("process.env.CRON_SECRET");
    expect(route).toContain('request.headers.get("authorization")');
    expect(route).toContain("Bearer ${secret}");
    expect(route).toContain("unauthorized");
  });

  it("uses a read-only database query and node runtime", () => {
    const route = read("src/app/api/cron/heartbeat/route.ts");

    expect(route).toContain('export const runtime = "nodejs"');
    expect(route).toContain("prisma.$queryRaw`SELECT 1`");
    expect(route).not.toContain("prisma.project.update");
    expect(route).not.toContain("prisma.timelineEvent.create");
  });

  it("registers the daily Vercel cron path", () => {
    const vercelConfig = JSON.parse(read("vercel.json")) as {
      crons?: Array<{ path?: string; schedule?: string }>;
    };

    const heartbeat = vercelConfig.crons?.find((cron) => cron.path === "/api/cron/heartbeat");
    expect(heartbeat?.schedule).toBe("0 2 * * *");
  });

  it("documents the required secret in the env example", () => {
    const envExample = read(".env.example");
    expect(envExample).toContain("CRON_SECRET");
  });
});
