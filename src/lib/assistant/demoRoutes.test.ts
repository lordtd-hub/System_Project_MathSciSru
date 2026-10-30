import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => { throw Error("Machine routes must not import human authentication"); });
vi.mock("@/lib/db", () => { throw Error("Machine routes must not import database access"); });
const root = "/api/assistant/v1/demo/projects";
const origin = "http://127.0.0.1:31415";
const fakeToken = "FAKE_UNIT_TEST_ONLY_NEVER_AN_OPERATIONAL_CREDENTIAL";
const methods = ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"] as const;

function configureFakeLocal() {
  const now = Date.now();
  const config: Record<string, string | undefined> = {
    ENABLE_ASSISTANT_DEMO_API: "1", ASSISTANT_DEMO_LOCAL_TEST: "1", NODE_ENV: "test", VERCEL_ENV: undefined,
    ASSISTANT_DEMO_ORIGIN: origin, ASSISTANT_DEMO_AUDIENCE: "fake-route-unit-audience",
    ASSISTANT_DEMO_CREDENTIAL_ID: "fake-route-reader", ASSISTANT_DEMO_CREDENTIAL_REVOKED: "0",
    ASSISTANT_DEMO_CREDENTIAL_SHA256: createHash("sha256").update(fakeToken).digest("hex"),
    ASSISTANT_DEMO_CREDENTIAL_NOT_BEFORE: new Date(now - 1000).toISOString(),
    ASSISTANT_DEMO_CREDENTIAL_EXPIRES_AT: new Date(now + 60_000).toISOString()
  };
  for (const [key, value] of Object.entries(config)) vi.stubEnv(key, value);
}

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.resetModules(); });

describe("actual Next.js route adapter modules", () => {
  it("exports dynamic Node routes and explicit method handlers, disabled by default", async () => {
    vi.stubEnv("ENABLE_ASSISTANT_DEMO_API", undefined);
    const routes = [await import("@/app/api/assistant/v1/demo/projects/route"),
      await import("@/app/api/assistant/v1/demo/projects/[id]/route")];
    vi.spyOn(console, "info").mockImplementation(() => {});
    for (const route of routes) {
      expect(route.runtime).toBe("nodejs");
      expect(route.dynamic).toBe("force-dynamic");
      expect(route.revalidate).toBe(0);
      expect(route.fetchCache).toBe("force-no-store");
      for (const method of methods) expect((await route[method](new Request(origin + root, { method }))).status).toBe(404);
    }
  });
  it("list/detail accept only fake test configuration, with actual hash verifier and no human auth", async () => {
    configureFakeLocal();
    vi.spyOn(console, "info").mockImplementation(() => {});
    const list = await import("@/app/api/assistant/v1/demo/projects/route");
    const detail = await import("@/app/api/assistant/v1/demo/projects/[id]/route");
    const headers = { Authorization: `Bearer ${fakeToken}` };
    const result = await list.GET(new Request(origin + root, { headers }));
    expect(result.status).toBe(200);
    expect((await result.json()).projects).toHaveLength(3);
    const one = await detail.GET(new Request(`${origin}${root}/nia-demo-001`, { headers }));
    expect((await one.json()).project.id).toBe("nia-demo-001");
    expect((await list.GET(new Request(origin + root))).status).toBe(401);
    for (const method of methods.filter((method) => method !== "GET")) {
      expect((await detail[method](new Request(`${origin}${root}/nia-demo-001`, { method, headers }))).status).toBe(405);
    }
  });
  it("production remains closed with fake valid config and caller environment assertions", async () => {
    configureFakeLocal();
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("QA_LOGIN_ALLOW_PRODUCTION", "1");
    vi.spyOn(console, "info").mockImplementation(() => {});
    const route = await import("@/app/api/assistant/v1/demo/projects/route");
    const result = await route.GET(new Request(origin + root, {
      headers: { Authorization: `Bearer ${fakeToken}`, "X-Vercel-Env": "preview", Cookie: "fake-admin-session" }
    }));
    expect(result.status).toBe(404);
    expect(result.headers.get("location")).toBeNull();
  });
  it("route runtime does not import DB, human sessions, workflow actions or public token config", () => {
    const files = ["demoApi.ts", "demoFixtures.ts", "demoPolicy.ts", "demoRuntime.ts", "machineAuth.ts"];
    for (const file of files) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source).not.toMatch(/from ["'](?:@\/auth|@\/lib\/db|@prisma\/client|next\/headers|next-auth)/);
      expect(source).not.toMatch(/NEXT_PUBLIC_|prisma\.|signIn\(|fetch\(|writeFile\(/);
    }
  });
});
