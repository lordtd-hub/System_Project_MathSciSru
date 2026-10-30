import { describe, expect, it, vi } from "vitest";
import { createProtectedPreviewRoutes, MCP_RESOURCE_METADATA_PATH } from "./mcpPreviewRoutes";
import { DEMO_MCP_PATH, type VerifiedOAuthGrant } from "./demoMcp";
import type { DemoEnvironment } from "./demoPolicy";
import * as mcpRoute from "../../app/api/assistant/mcp/route";
import * as metadataRoute from "../../app/.well-known/oauth-protected-resource/api/assistant/mcp/route";

const clock = Date.parse("2026-10-30T00:01:00Z");
const origin = "https://preview.example.invalid";
const env: DemoEnvironment = { ENABLE_ASSISTANT_DEMO_MCP: "1", VERCEL_ENV: "preview", VERCEL_PROJECT_ID: "FAKE-PROJECT",
  ASSISTANT_DEMO_EXPECTED_PROJECT_ID: "FAKE-PROJECT", VERCEL_GIT_COMMIT_REF: "codex/test-preview", ASSISTANT_DEMO_PREVIEW_BRANCH: "codex/test-preview",
  ASSISTANT_DEMO_ORIGIN: origin, ASSISTANT_DEMO_MCP_MODE: "oauth", ASSISTANT_DEMO_MCP_ISSUER: "https://issuer.example.invalid",
  ASSISTANT_DEMO_MCP_OWNER_SUBJECT: "FAKE_OWNER_SUBJECT", ASSISTANT_DEMO_MCP_NOT_BEFORE: new Date(clock - 1000).toISOString(),
  ASSISTANT_DEMO_MCP_EXPIRES_AT: new Date(clock + 60_000).toISOString() };
const grant: VerifiedOAuthGrant = { issuer: "https://issuer.example.invalid", resource: origin + DEMO_MCP_PATH,
  subject: "FAKE_OWNER_SUBJECT", scopes: ["demo:projects:read"], notBeforeEpochMs: clock - 1000, expiresAtEpochMs: clock + 1000 };
const request = (path = DEMO_MCP_PATH, method = "POST", headers = {}) => new Request(origin + path, { method, headers });
function setup(changes: Partial<Parameters<typeof createProtectedPreviewRoutes>[0]> = {}) {
  const createTransport = vi.fn((options: { verifyRequest: (req: Request) => Promise<VerifiedOAuthGrant | null> }) => async (req: Request) => {
    const trusted = await options.verifyRequest(req);
    return Response.json({ syntheticStub: true, allowed: Boolean(trusted) }, { status: trusted ? 200 : 401 });
  });
  const load = vi.fn(async () => ({ createSyntheticMcpTransport: createTransport }));
  return { load, createTransport, handle: createProtectedPreviewRoutes({ environment: env, now: () => clock,
    verifyRequest: async () => grant, loadTransport: load, ...changes }) };
}

describe("protected owner-only Next Preview integration boundary (injected transport; no SDK execution)", () => {
  it("leaves disabled routes off without importing the MCP package", async () => {
    const { handle, load } = setup({ environment: {} });
    expect((await handle(request())).status).toBe(404);
    expect((await handle(request(MCP_RESOURCE_METADATA_PATH, "GET"))).status).toBe(404);
    expect(load).not.toHaveBeenCalled();
  });
  it("denies Production before reading owner identity settings", async () => {
    const production = { ...env, VERCEL_ENV: "production" };
    Object.defineProperty(production, "ASSISTANT_DEMO_MCP_OWNER_SUBJECT", { get() { throw new Error("must not read"); } });
    const { handle, load } = setup({ environment: production });
    expect((await handle(request())).status).toBe(404);
    expect(load).not.toHaveBeenCalled();
  });
  it.each([
    { VERCEL_PROJECT_ID: "WRONG" }, { VERCEL_GIT_COMMIT_REF: "main" }, { ENABLE_ASSISTANT_DEMO_MCP: undefined }
  ])("keeps excluded deploy environments closed %j", async (change) => {
    const { handle, load } = setup({ environment: { ...env, ...change } });
    expect((await handle(request())).status).toBe(404);
    expect(load).not.toHaveBeenCalled();
  });
  it("rejects anonymous mode even though fixtures are synthetic", async () => {
    const { handle, load } = setup({ environment: { ...env, ASSISTANT_DEMO_MCP_MODE: "public-synthetic" } });
    expect((await handle(request())).status).toBe(503);
    expect(load).not.toHaveBeenCalled();
  });
  it.each([
    { ASSISTANT_DEMO_MCP_OWNER_SUBJECT: undefined }, { ASSISTANT_DEMO_MCP_OWNER_SUBJECT: " " },
    { ASSISTANT_DEMO_MCP_OWNER_SUBJECT: "FAKE\nOWNER" }, { ASSISTANT_DEMO_MCP_NOT_BEFORE: undefined },
    { ASSISTANT_DEMO_MCP_EXPIRES_AT: undefined }, { ASSISTANT_DEMO_MCP_EXPIRES_AT: "invalid" },
    { ASSISTANT_DEMO_MCP_EXPIRES_AT: new Date(clock + 3_600_000).toISOString() },
    { ASSISTANT_DEMO_MCP_NOT_BEFORE: "2026-10-30T00:00:59" }
  ])("fails closed for incomplete owner/trial configuration %j", async (change) => {
    const { handle, load } = setup({ environment: { ...env, ...change } });
    expect((await handle(request())).status).toBe(503);
    expect(load).not.toHaveBeenCalled();
  });
  it("requires the real verifier seam; env configuration alone cannot activate data", async () => {
    const { handle, load } = setup({ verifyRequest: undefined });
    expect((await handle(request())).status).toBe(503);
    expect((await handle(request(MCP_RESOURCE_METADATA_PATH, "GET"))).status).toBe(503);
    expect(load).not.toHaveBeenCalled();
  });
  it.each([clock - 1001, clock + 60_000, NaN])("rechecks trial time before importing transport %s", async (time) => {
    const { handle, load } = setup({ now: () => time });
    expect((await handle(request())).status).toBe(Number.isNaN(time) ? 503 : 404);
    expect(load).not.toHaveBeenCalled();
  });
  it("stops even a previously loaded immutable copy when its fixed window expires", async () => {
    let time = clock;
    const { handle, load } = setup({ now: () => time });
    expect((await handle(request())).status).toBe(200);
    time = clock + 60_000;
    expect((await handle(request())).status).toBe(404);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it("accepts only the exact fake owner subject after the trusted verifier", async () => {
    const owner = setup();
    expect((await owner.handle(request())).status).toBe(200);
    const other = setup({ verifyRequest: async () => ({ ...grant, subject: "ANOTHER_FAKE_OWNER" }) });
    expect((await other.handle(request())).status).toBe(401);
    const anonymous = setup({ verifyRequest: async () => null });
    expect((await anonymous.handle(request())).status).toBe(401);
  });
  it("loads one shared handler for MCP and resource-metadata routes", async () => {
    const { handle, load, createTransport } = setup();
    expect((await handle(request())).status).toBe(200);
    expect((await handle(request(MCP_RESOURCE_METADATA_PATH, "GET"))).status).toBe(200);
    expect(load).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledTimes(1);
  });
  it("rejects wrong origin, query, browser origin, route and metadata method before load", async () => {
    const { handle, load } = setup();
    expect((await handle(new Request("https://other.example.invalid" + DEMO_MCP_PATH))).status).toBe(404);
    expect((await handle(request(DEMO_MCP_PATH + "?extra=1"))).status).toBe(404);
    expect((await handle(request(DEMO_MCP_PATH, "POST", { Origin: "https://other.example.invalid" }))).status).toBe(403);
    expect((await handle(request("/private"))).status).toBe(404);
    const denied = await handle(request(MCP_RESOURCE_METADATA_PATH, "POST"));
    expect(denied.status).toBe(405); expect(denied.headers.get("allow")).toBe("GET");
    expect(load).not.toHaveBeenCalled();
  });
  it("redacts loader and audit exceptions and never sends cookie/redirect responses", async () => {
    const { handle } = setup({ loadTransport: async () => { throw new Error("FAKE_SECRET_DO_NOT_OUTPUT"); }, audit: () => { throw new Error("FAKE_LOGGER_SECRET"); } });
    const response = await handle(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull(); expect(response.headers.get("location")).toBeNull();
    expect(await response.text()).not.toContain("FAKE");
  });
  it("exports Node/dynamic/no-cache adapters with all mutation verbs routed through denial gates", () => {
    for (const route of [mcpRoute, metadataRoute]) {
      expect(route.runtime).toBe("nodejs"); expect(route.dynamic).toBe("force-dynamic"); expect(route.revalidate).toBe(0);
      for (const verb of ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const) expect(route[verb]).toBe(route.GET);
    }
  });
});
