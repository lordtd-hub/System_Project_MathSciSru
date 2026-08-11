import { describe, expect, it } from "vitest";
import {
  assertProductionRuntimeEnv,
  getAuthRuntimeConfiguration,
  getAuthSecret,
  getGoogleOAuthCredentials,
  isProductionRuntime,
  isVercelProductionDeployment,
  validateProductionEnv
} from "./env";

describe("production environment validation", () => {
  it("accepts AUTH_SECRET or NEXTAUTH_SECRET", () => {
    expect(getAuthSecret({ AUTH_SECRET: "auth-secret" })).toBe("auth-secret");
    expect(getAuthSecret({ NEXTAUTH_SECRET: "nextauth-secret" })).toBe("nextauth-secret");
  });

  it("does not treat Next.js production build phase as runtime", () => {
    expect(isProductionRuntime({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).toBe(false);
    expect(isProductionRuntime({ NODE_ENV: "production" })).toBe(true);
  });

  it("distinguishes Vercel Preview from Vercel Production", () => {
    expect(isProductionRuntime({ NODE_ENV: "production", VERCEL_ENV: "preview" })).toBe(false);
    expect(isProductionRuntime({ NODE_ENV: "production", VERCEL_ENV: "development" })).toBe(false);
    expect(isProductionRuntime({ NODE_ENV: "production", VERCEL_ENV: "production" })).toBe(true);
    expect(isVercelProductionDeployment({ VERCEL_ENV: "preview" })).toBe(false);
    expect(isVercelProductionDeployment({ VERCEL_ENV: "production" })).toBe(true);
  });

  it("fails production validation when critical variables are missing", () => {
    const result = validateProductionEnv({ NODE_ENV: "production" });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("DATABASE_URL is required.");
    expect(result.errors).toContain("GOOGLE_CLIENT_ID is required.");
    expect(result.errors).toContain("INITIAL_ADMIN_EMAIL is required for the first production Admin.");
  });

  it("warns when production-like env still points at localhost", () => {
    const result = validateProductionEnv({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/project",
      AUTH_SECRET: "super-secret-production-value",
      AUTH_URL: "http://localhost:3000",
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      INITIAL_ADMIN_EMAIL: "admin@sru.ac.th"
    });

    expect(result.ok).toBe(true);
    expect(result.warnings).toContain("DATABASE_URL points to localhost; use Supabase/PostgreSQL in production.");
    expect(result.warnings).toContain("AUTH_URL/NEXTAUTH_URL points to localhost; use the production HTTPS URL in production.");
  });

  it("rejects missing secrets and localhost auth URLs during production runtime", () => {
    expect(() => assertProductionRuntimeEnv({ NODE_ENV: "production" })).toThrow("AUTH_SECRET or NEXTAUTH_SECRET is required.");

    expect(() =>
      assertProductionRuntimeEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://postgres:postgres@db.example.test:5432/project",
        AUTH_SECRET: "super-secret-production-value",
        AUTH_URL: "http://localhost:3000",
        GOOGLE_CLIENT_ID: "client-id",
        GOOGLE_CLIENT_SECRET: "client-secret",
        INITIAL_ADMIN_EMAIL: "admin@sru.ac.th"
      })
    ).toThrow("AUTH_URL/NEXTAUTH_URL must not point to localhost in production.");
  });

  it("accepts HTTPS auth URLs during production runtime", () => {
    expect(() =>
      assertProductionRuntimeEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://postgres:postgres@db.example.test:5432/project",
        AUTH_SECRET: "super-secret-production-value",
        AUTH_URL: "https://project.example.test",
        GOOGLE_CLIENT_ID: "client-id",
        GOOGLE_CLIENT_SECRET: "client-secret",
        INITIAL_ADMIN_EMAIL: "admin@sru.ac.th"
      })
    ).not.toThrow();
  });

  it("keeps OAuth initialization non-throwing and reports request-time readiness", () => {
    expect(getGoogleOAuthCredentials({ NODE_ENV: "production" })).toEqual({ clientId: "", clientSecret: "" });

    const missing = getAuthRuntimeConfiguration({ NODE_ENV: "production", VERCEL_ENV: "preview" });
    expect(missing.ready).toBe(false);
    expect(missing.missing).toEqual([
      "DATABASE_URL",
      "AUTH_SECRET or NEXTAUTH_SECRET",
      "AUTH_URL or NEXTAUTH_URL",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET"
    ]);

    expect(getAuthRuntimeConfiguration({
      DATABASE_URL: "postgresql://db.example.test/project",
      AUTH_SECRET: "auth-secret",
      AUTH_URL: "https://preview.example.test",
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret"
    }).ready).toBe(true);
  });
});
