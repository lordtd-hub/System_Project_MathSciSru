import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  handlers: {
    GET: vi.fn(async () => new Response("next-auth-get", { status: 200 })),
    POST: vi.fn(async () => new Response("next-auth-post", { status: 200 }))
  }
}));

const authEnvNames = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "NEXTAUTH_SECRET",
  "AUTH_URL",
  "NEXTAUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET"
] as const;

function clearAuthEnv() {
  for (const name of authEnvNames) delete process.env[name];
}

function configureAuthEnv() {
  process.env.DATABASE_URL = "postgresql://db.example.test/project";
  process.env.AUTH_SECRET = "test-only-secret";
  process.env.AUTH_URL = "https://preview.example.test";
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
}

afterEach(() => {
  clearAuthEnv();
  delete process.env.VERCEL_ENV;
  vi.resetModules();
});

describe("NextAuth route configuration guard", () => {
  it("returns a controlled 503 in Preview when auth configuration is missing", async () => {
    clearAuthEnv();
    process.env.VERCEL_ENV = "preview";
    vi.resetModules();

    const route = await import("./[...nextauth]/route");
    const response = await (route.GET as () => Promise<Response> | Response)();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Authentication is not configured for this environment." });
  });

  it("delegates to NextAuth when runtime configuration is complete", async () => {
    configureAuthEnv();
    process.env.VERCEL_ENV = "preview";
    vi.resetModules();

    const route = await import("./[...nextauth]/route");
    const response = await (route.GET as (request: Request) => Promise<Response>)(
      new Request("https://preview.example.test/api/auth/session")
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("next-auth-get");
  });
});
