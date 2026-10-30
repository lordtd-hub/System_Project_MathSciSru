import { describe, expect, it, vi } from "vitest";
import { authorizeMcpRequest, createDemoMcp, DEMO_MCP_PATH, readMcpConfiguration,
  type VerifiedOAuthGrant } from "./demoMcp";
import { demoProjects } from "./demoFixtures";
import type { DemoEnvironment } from "./demoPolicy";

const timestamp = Date.parse("2026-10-30T00:01:00Z");
const origin = "http://127.0.0.1:31415";
const env: DemoEnvironment = { ENABLE_ASSISTANT_DEMO_MCP: "1", ASSISTANT_DEMO_LOCAL_TEST: "1", NODE_ENV: "test",
  ASSISTANT_DEMO_ORIGIN: origin, ASSISTANT_DEMO_MCP_MODE: "oauth", ASSISTANT_DEMO_MCP_ISSUER: "https://issuer.example.invalid/" };
const config = readMcpConfiguration(env);
// Injected public test grant only. No JWT, token, keys, OAuth account or operational verifier.
const grant: VerifiedOAuthGrant = { subject: "FAKE_TEST_SUBJECT", issuer: "https://issuer.example.invalid/",
  resource: origin + DEMO_MCP_PATH, scopes: ["demo:projects:read"], notBeforeEpochMs: timestamp - 1000, expiresAtEpochMs: timestamp + 1000 };
const create = (changes = {}) => createDemoMcp({ configuration: config, now: () => timestamp, ...changes });
const req = (path = DEMO_MCP_PATH, method = "POST", headers = {}) => new Request(origin + path, { method, headers });

describe("MCP fixed synthetic adapter (no transport/operational OAuth)", () => {
  it("preserves the exact configured OAuth issuer without adding a slash", () => {
    expect(readMcpConfiguration({ ...env, ASSISTANT_DEMO_MCP_ISSUER: "https://issuer.example.invalid" }))
      .toMatchObject({ state: "ready", issuer: "https://issuer.example.invalid" });
    expect(readMcpConfiguration({ ...env, ASSISTANT_DEMO_MCP_ISSUER: " https://issuer.example.invalid/" }).state).toBe("misconfigured");
  });
  it("denies defaults, missing mode and missing verifier", async () => {
    expect(() => createDemoMcp().definitions()).toThrow("not_found");
    expect(readMcpConfiguration({ ...env, ASSISTANT_DEMO_MCP_MODE: undefined })).toEqual({ state: "misconfigured" });
    await expect(authorizeMcpRequest(req(), config)).rejects.toMatchObject({ status: 401 });
  });
  it.each([
    { ENABLE_ASSISTANT_DEMO_MCP: undefined }, { VERCEL_ENV: "production" }, { VERCEL_ENV: "development" },
    { NODE_ENV: "production" }, { ASSISTANT_DEMO_LOCAL_TEST: undefined },
    { VERCEL_ENV: "preview", VERCEL_PROJECT_ID: "wrong", VERCEL_GIT_COMMIT_REF: "test" }
  ])("closes excluded environments %j", (change) => {
    expect(readMcpConfiguration({ ...env, ...change })).toEqual({ state: "disabled" });
  });
  it("uses the shared Preview branch/project/origin gates independently of disabled REST", () => {
    const preview = { ...env, ENABLE_ASSISTANT_DEMO_API: undefined, VERCEL_ENV: "preview", VERCEL_PROJECT_ID: "test-project",
      ASSISTANT_DEMO_EXPECTED_PROJECT_ID: "test-project", VERCEL_GIT_COMMIT_REF: "codex/test-only",
      ASSISTANT_DEMO_PREVIEW_BRANCH: "codex/test-only", ASSISTANT_DEMO_ORIGIN: "https://preview.example.invalid" };
    expect(readMcpConfiguration(preview)).toMatchObject({ state: "ready", environment: "qa-preview" });
    expect(readMcpConfiguration({ ...preview, VERCEL_GIT_COMMIT_REF: "main" }).state).toBe("disabled");
    expect(readMcpConfiguration({ ...preview, VERCEL_PROJECT_ID: "another-project" }).state).toBe("disabled");
    expect(readMcpConfiguration({ ...preview, ASSISTANT_DEMO_ORIGIN: "http://preview.example.invalid" }).state).toBe("misconfigured");
  });
  it("rejects production before reading mode, issuer or origin", () => {
    const input = { ...env, VERCEL_ENV: "production" };
    Object.defineProperty(input, "ASSISTANT_DEMO_MCP_ISSUER", { get: () => { throw new Error("must not read"); } });
    expect(readMcpConfiguration(input)).toEqual({ state: "disabled" });
  });
  it.each(["", "http://issuer.example.invalid", "https://user:password@issuer.example.invalid", "https://issuer.example.invalid?x=1", "https://issuer.example.invalid#fragment"])(
    "rejects invalid configured issuer %s", (issuer) => expect(readMcpConfiguration({ ...env, ASSISTANT_DEMO_MCP_ISSUER: issuer }).state).toBe("misconfigured")
  );
  it("exposes exactly two strict schemas with read-only/OAuth descriptions", () => {
    const tools = create().definitions(grant);
    expect(tools.map((x) => x.name)).toEqual(["list_synthetic_projects", "get_synthetic_project"]);
    for (const tool of tools) {
      expect(tool.inputSchema.additionalProperties).toBe(false);
      expect(tool.outputSchema.additionalProperties).toBe(false);
      expect(tool.outputSchema.properties.synthetic).toEqual({ const: true });
      expect(tool.annotations).toEqual({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
      expect(tool.securitySchemes).toEqual([{ type: "oauth2", scopes: ["demo:projects:read"] }]);
      expect(tool.description).toMatch(/invented/);
    }
    Reflect.set(tools[0], "name", "mutated");
    expect(create().definitions(grant)[0].name).toBe("list_synthetic_projects");
  });
  it("returns the same projected fixtures for list/detail with explicit synthetic marker", async () => {
    const adapter = create();
    const list = await adapter.call("list_synthetic_projects", {}, grant);
    expect(list.structuredContent).toEqual({ schemaVersion: "1.0", synthetic: true, fixtureSet: "nia-demo-v1",
      environment: "local-test", projects: demoProjects });
    expect(JSON.parse(list.content[0].text)).toEqual(list.structuredContent);
    const detail = await adapter.call("get_synthetic_project", { id: "nia-demo-001" }, grant);
    expect(detail.structuredContent.project).toEqual(demoProjects[0]);
    expect(Object.keys(detail.structuredContent.project as object).sort()).toEqual(["id", "status", "titleTh", "updatedAt"]);
    expect(JSON.stringify(detail)).not.toMatch(/FAKE_TEST_SUBJECT|issuer\.example|password|Bearer/);
  });
  it.each([
    { expiresAtEpochMs: timestamp }, { notBeforeEpochMs: timestamp + 1 }, { subject: "" },
    { expiresAtEpochMs: NaN }, { expiresAtEpochMs: timestamp + 3_600_000 }, { notBeforeEpochMs: NaN }
  ])("rejects invalid/expired grants %j", async (change) => {
    await expect(create().call("list_synthetic_projects", {}, { ...grant, ...change })).rejects.toMatchObject({ status: 401 });
  });
  it.each([{ issuer: "https://other.example.invalid/" }, { resource: "https://other.example.invalid/api/assistant/mcp" },
    { scopes: [] }, { scopes: ["admin"] }])("rejects wrong capability %j", async (change) => {
    await expect(create().call("list_synthetic_projects", {}, { ...grant, ...change })).rejects.toMatchObject({ status: 403 });
  });
  it("authorizes before reading tool arguments or exposing discovery", async () => {
    const args = new Proxy({}, { ownKeys: () => { throw new Error("arguments accessed"); } });
    expect(() => create().definitions()).toThrow("unauthorized");
    await expect(create().call("list_synthetic_projects", args)).rejects.toMatchObject({ status: 401 });
  });
  it.each([
    ["list_synthetic_projects", { extra: true }], ["list_synthetic_projects", null], ["list_synthetic_projects", []],
    ["get_synthetic_project", {}], ["get_synthetic_project", { id: 1 }], ["get_synthetic_project", { id: "../private" }],
    ["get_synthetic_project", { id: "nia-demo-001", role: "admin" }]
  ])("rejects arguments %s %j", async (name, args) => {
    await expect(create().call(name as string, args, grant)).rejects.toMatchObject({ status: 400 });
  });
  it("has no write tool and no live ID fallback", async () => {
    await expect(create().call("delete_project", { id: "nia-demo-001" }, grant)).rejects.toMatchObject({ code: "unknown_tool" });
    await expect(create().call("get_synthetic_project", { id: "nia-demo-999" }, grant)).rejects.toMatchObject({ code: "not_found" });
  });
  it("permits anonymous fixtures only after exact explicit public-synthetic opt-in", async () => {
    const publicConfig = readMcpConfiguration({ ...env, ASSISTANT_DEMO_MCP_MODE: "public-synthetic", ASSISTANT_DEMO_MCP_ISSUER: undefined });
    const adapter = create({ configuration: publicConfig });
    expect(adapter.definitions()[0].securitySchemes).toEqual([{ type: "noauth" }]);
    const verifier = vi.fn(async () => { throw new Error("not called in public fixture mode"); });
    expect(await authorizeMcpRequest(req(), publicConfig, verifier, () => timestamp)).toBeNull();
    expect(verifier).not.toHaveBeenCalled();
    expect((await adapter.call("list_synthetic_projects", {})).structuredContent.synthetic).toBe(true);
    await expect(adapter.call("get_student", {})).rejects.toMatchObject({ code: "unknown_tool" });
    expect(readMcpConfiguration({ ...env, ASSISTANT_DEMO_MCP_MODE: "public-synthetic", VERCEL_ENV: "production" }).state).toBe("disabled");
  });
  it("checks authorization anew for every request and call", async () => {
    const verifier = vi.fn(async () => grant);
    expect(await authorizeMcpRequest(req(), config, verifier, () => timestamp)).toEqual(grant);
    await expect(authorizeMcpRequest(req(), config, async () => null, () => timestamp)).rejects.toMatchObject({ status: 401 });
    await expect(authorizeMcpRequest(req(), config, async () => { throw new Error("secret exception"); }, () => timestamp))
      .rejects.toMatchObject({ status: 503, message: "service_unavailable" });
    await expect(create({ now: () => grant.expiresAtEpochMs }).call("list_synthetic_projects", {}, grant)).rejects.toMatchObject({ status: 401 });
  });
  it.each([["/api/assistant/mcp?extra=1", "POST", {}, 404], ["/private", "POST", {}, 404],
    [DEMO_MCP_PATH, "DELETE", {}, 405], [DEMO_MCP_PATH, "POST", { Origin: "https://evil.example.invalid" }, 403]])(
    "denies request boundary %s %s", async (path, method, headers, status) => {
      const verifier = vi.fn(async () => grant);
      await expect(authorizeMcpRequest(req(path as string, method as string, headers as Record<string, string>), config, verifier))
        .rejects.toMatchObject({ status });
      expect(verifier).not.toHaveBeenCalled();
    }
  );
  it("limits successful reads per retained instance and resets after a minute", async () => {
    let clock = timestamp;
    const publicConfig = readMcpConfiguration({ ...env, ASSISTANT_DEMO_MCP_MODE: "public-synthetic" });
    const adapter = create({ configuration: publicConfig, now: () => clock });
    for (let i = 0; i < 20; i++) await adapter.call("list_synthetic_projects", {});
    await expect(adapter.call("list_synthetic_projects", {})).rejects.toMatchObject({ status: 429 });
    clock += 60_000;
    expect((await adapter.call("list_synthetic_projects", {})).structuredContent.synthetic).toBe(true);
  });
});
