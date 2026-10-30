import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createDemoApi, type DemoAuditEvent } from "./demoApi";
import { readDemoConfiguration, type DemoEnvironment, type ReadyDemoConfiguration } from "./demoPolicy";
import { demoProjects, DEMO_ROOT } from "./demoFixtures";
import { createConfiguredDemoHandler } from "./demoRuntime";
import type { MachineIdentity } from "./machineAuth";

const fakeToken = "FAKE_UNIT_TEST_ONLY_NEVER_AN_OPERATIONAL_CREDENTIAL";
const clock = Date.parse("2026-10-30T00:01:00Z");
const origin = "http://127.0.0.1:31415";
const fakeEnv: DemoEnvironment = {
  ENABLE_ASSISTANT_DEMO_API: "1", ASSISTANT_DEMO_LOCAL_TEST: "1", NODE_ENV: "test",
  ASSISTANT_DEMO_ORIGIN: origin, ASSISTANT_DEMO_AUDIENCE: "synthetic-unit-audience",
  ASSISTANT_DEMO_CREDENTIAL_ID: "fake-unit-reader",
  ASSISTANT_DEMO_CREDENTIAL_SHA256: createHash("sha256").update(fakeToken).digest("hex"),
  ASSISTANT_DEMO_CREDENTIAL_NOT_BEFORE: new Date(clock - 1000).toISOString(),
  ASSISTANT_DEMO_CREDENTIAL_EXPIRES_AT: new Date(clock + 60_000).toISOString(),
  ASSISTANT_DEMO_CREDENTIAL_REVOKED: "0"
};
const configuration = readDemoConfiguration(fakeEnv) as ReadyDemoConfiguration;
const fakeIdentity: MachineIdentity = {
  principalId: "nia-demo-reader", credentialId: "fake-unit-reader", audience: configuration.audience,
  fixtureSet: "nia-demo-v1", scopes: ["demo:projects:read"], notBeforeEpochMs: clock - 1000, expiresAtEpochMs: clock + 60_000
};
const fakeVerifier = async (value: string) => value === fakeToken ? fakeIdentity : null;
function request(path = DEMO_ROOT, method = "GET", headers: Record<string, string> = {}, requestOrigin = origin) {
  return new Request(requestOrigin + path, { method, headers: { Authorization: `Bearer ${fakeToken}`, ...headers } });
}
function makeApi(changes: Parameters<typeof createDemoApi>[0] = {}) {
  return createDemoApi({ configuration, verifyBearer: fakeVerifier, now: () => clock, ...changes });
}

describe("synthetic read-only API policy", () => {
  it("denies default config and default verifier", async () => {
    expect((await createDemoApi()(request())).status).toBe(404);
    expect((await createDemoApi({ configuration })(request())).status).toBe(401);
  });
  it("returns the exact synthetic list and detail with no identity/grade extras", async () => {
    const handle = makeApi();
    const list = await handle(request());
    expect(list.status).toBe(200);
    const body = await list.json();
    expect(body).toEqual({ schemaVersion: "1.0", synthetic: true, fixtureSet: "nia-demo-v1", environment: "local-test",
      projects: demoProjects, requestId: expect.any(String) });
    for (const project of body.projects) expect(Object.keys(project).sort()).toEqual(["id", "status", "titleTh", "updatedAt"]);
    expect((await (await handle(request(`${DEMO_ROOT}/nia-demo-002`))).json()).project).toEqual(demoProjects[1]);
    expect(list.headers.get("cache-control")).toBe("no-store");
    expect(list.headers.get("set-cookie")).toBeNull();
    expect(list.headers.get("location")).toBeNull();
    expect(JSON.stringify(body)).toContain("โครงงานจำลอง");
  });
  it.each(["", "Basic FAKE", "Bearer short", `Bearer ${"x".repeat(257)}`, `Bearer ${fakeToken}, Bearer another`])(
    "rejects malformed authorization %s", async (Authorization) => {
      const result = await makeApi()(request(DEMO_ROOT, "GET", { Authorization, Cookie: "project_assessment_dev_session=FAKE" }));
      expect(result.status).toBe(401);
      expect(await result.text()).not.toContain("titleTh");
    }
  );
  it.each([
    { scopes: [] }, { audience: "production" }, { fixtureSet: "real-students" }, { principalId: "ADMIN" }
  ])("rejects server identity mismatch despite client assertions %j", async (change) => {
    const handle = makeApi({ verifyBearer: async () => ({ ...fakeIdentity, ...change }) });
    expect((await handle(request(DEMO_ROOT, "GET", { "X-Role": "ADMIN", "X-Scope": "demo:projects:read" }))).status).toBe(403);
  });
  it.each([{ expiresAtEpochMs: clock }, { notBeforeEpochMs: clock + 1 }, { expiresAtEpochMs: NaN }])(
    "independently enforces identity expiry from an injected verifier %j", async (change) => {
      expect((await makeApi({ verifyBearer: async () => ({ ...fakeIdentity, ...change }) })(request())).status).toBe(401);
    }
  );
  it.each(["POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])("rejects %s", async (method) => {
    const result = await makeApi()(request(DEMO_ROOT, method));
    expect(result.status).toBe(405);
    expect(result.headers.get("allow")).toBe("GET");
  });
  it.each([`${DEMO_ROOT}/nia-demo-999`, `${DEMO_ROOT}/student-123`, `${DEMO_ROOT}/nia-demo-001/extra`, `${DEMO_ROOT}/%2e%2e%2fstudent`])(
    "restricts reads to fixed IDs: %s", async (path) => expect((await makeApi()(request(path))).status).toBe(404)
  );
  it("rejects filters, body claims and other request origins", async () => {
    expect((await makeApi()(request(`${DEMO_ROOT}?courseOfferingId=real-course`))).status).toBe(400);
    expect((await makeApi()(request(DEMO_ROOT, "GET", { "Content-Length": "5" }))).status).toBe(400);
    expect((await makeApi()(request(DEMO_ROOT, "GET", {}, "http://localhost:31415"))).status).toBe(404);
  });
  it("redacts audit and verifier failures", async () => {
    const events: DemoAuditEvent[] = [];
    const handle = makeApi({ audit: (event) => events.push(event) });
    await handle(request());
    await handle(request(DEMO_ROOT, "GET", { Authorization: "" }));
    expect(Object.keys(events[0]).sort()).toEqual(["credentialId", "operation", "requestId", "status"]);
    expect(JSON.stringify(events)).not.toContain(fakeToken);
    expect(JSON.stringify(events)).not.toMatch(/Bearer|authorization|titleTh|studentCode/i);
    const failed = await makeApi({ verifyBearer: () => { throw Error("PRIVATE_EXCEPTION"); } })(request());
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("PRIVATE_EXCEPTION");
  });
  it("enforces per-instance read quota and rechecks expiry on each request", async () => {
    let time = clock;
    const handle = makeApi({ now: () => time });
    for (let n = 0; n < 20; n++) expect((await handle(request())).status).toBe(200);
    const throttled = await handle(request());
    expect(throttled.status).toBe(429);
    expect(throttled.headers.get("retry-after")).toBe("60");
    time = fakeIdentity.expiresAtEpochMs;
    expect((await handle(request())).status).toBe(401);
  });
});

describe("trusted environment isolation and configured verifier wiring", () => {
  it.each([
    {}, { ...fakeEnv, ENABLE_ASSISTANT_DEMO_API: "0" },
    { ...fakeEnv, NODE_ENV: "production" }, { ...fakeEnv, VERCEL_ENV: "production", QA_LOGIN_ALLOW_PRODUCTION: "1" },
    { ...fakeEnv, VERCEL_ENV: "other" }, { ...fakeEnv, ASSISTANT_DEMO_LOCAL_TEST: "0" },
    { ...fakeEnv, VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "main", ASSISTANT_DEMO_PREVIEW_BRANCH: "approved-qa" }
  ])("denies unapproved environment before credential lookup", async (env) => {
    expect(readDemoConfiguration(env).state).toBe("disabled");
    expect((await createConfiguredDemoHandler(env, () => clock)(request())).status).toBe(404);
  });
  it("does not read credential fields on production, even when feature and QA override are enabled", () => {
    const env = new Proxy({ ...fakeEnv, VERCEL_ENV: "production", QA_LOGIN_ALLOW_PRODUCTION: "1" }, {
      get(target, property, receiver) {
        if (String(property).startsWith("ASSISTANT_DEMO_CREDENTIAL")) throw Error("credential read forbidden");
        return Reflect.get(target, property, receiver);
      }
    });
    expect(readDemoConfiguration(env).state).toBe("disabled");
  });
  it("requires exact Preview branch/project and HTTPS origin", async () => {
    const qaEnv = { ...fakeEnv, NODE_ENV: "production", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "approved-qa",
      ASSISTANT_DEMO_PREVIEW_BRANCH: "approved-qa", VERCEL_PROJECT_ID: "fake-project",
      ASSISTANT_DEMO_EXPECTED_PROJECT_ID: "fake-project", ASSISTANT_DEMO_ORIGIN: "https://synthetic-qa.example.invalid" };
    expect((await createConfiguredDemoHandler(qaEnv, () => clock)(request(DEMO_ROOT, "GET", {}, qaEnv.ASSISTANT_DEMO_ORIGIN))).status).toBe(200);
    expect(readDemoConfiguration({ ...qaEnv, VERCEL_PROJECT_ID: "other-project" }).state).toBe("disabled");
    expect(readDemoConfiguration({ ...qaEnv, ASSISTANT_DEMO_ORIGIN: origin }).state).toBe("misconfigured");
  });
  it("requires complete config and explicit non-revocation; verifies public fake hash without a stub", async () => {
    expect((await createConfiguredDemoHandler(fakeEnv, () => clock)(request())).status).toBe(200);
    expect((await createConfiguredDemoHandler({ ...fakeEnv, ASSISTANT_DEMO_CREDENTIAL_SHA256: "" }, () => clock)(request())).status).toBe(503);
    for (const revoked of [undefined, "1"]) {
      expect((await createConfiguredDemoHandler({ ...fakeEnv, ASSISTANT_DEMO_CREDENTIAL_REVOKED: revoked }, () => clock)(request())).status).toBe(401);
    }
    expect((await createConfiguredDemoHandler(fakeEnv, () => clock + 60_000)(request())).status).toBe(401);
  });
});
