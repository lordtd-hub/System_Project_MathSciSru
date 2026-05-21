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

  it("keeps the multi-database operator heartbeat read-only and separated by env names", () => {
    const script = read("scripts/supabase-heartbeat.ts");
    const packageJson = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
    const envExample = read(".env.example");
    const workflow = read(".github/workflows/supabase-heartbeat.yml");

    expect(packageJson.scripts?.["supabase:heartbeat"]).toBe("tsx scripts/supabase-heartbeat.ts");
    expect(script).toContain("SUPABASE_PROD_DATABASE_URL");
    expect(script).toContain("SUPABASE_QA_DATABASE_URL");
    expect(script).toContain(".env.heartbeat.local");
    expect(script).toContain("loadHeartbeatEnvFile");
    expect(script).toContain("prisma.$queryRaw`SELECT 1`");
    expect(script).toContain("Refusing to heartbeat local database");
    expect(script).toContain("point to the same database URL");
    expect(script).not.toContain("project.update");
    expect(script).not.toContain("deleteMany");
    expect(envExample).toContain("SUPABASE_PROD_DATABASE_URL");
    expect(envExample).toContain("SUPABASE_QA_DATABASE_URL");
    expect(workflow).toContain('cron: "15 2 * * *"');
    expect(workflow).toContain("npm run supabase:heartbeat");
    expect(workflow).toContain("secrets.SUPABASE_PROD_DATABASE_URL");
    expect(workflow).toContain("secrets.SUPABASE_QA_DATABASE_URL");
  });
});
