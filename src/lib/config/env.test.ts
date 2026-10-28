import { describe, expect, it } from "vitest";
import {
  assertProductionRuntimeEnv,
  getAdditionalAdminEmails,
  getAuthRuntimeConfiguration,
  getAuthSecret,
  getGoogleOAuthCredentials,
  isProductionRuntime,
  isVercelProductionDeployment,
  validateProductionEnv
} from "./env";

describe("production environment validation", () => {
  it("normalizes and deduplicates optional exact staff admin designations", () => {
    expect([...getAdditionalAdminEmails({ ADDITIONAL_ADMIN_EMAILS:" Backup@SRU.AC.TH , backup@sru.ac.th,second@sru.ac.th " })]).toEqual(["backup@sru.ac.th","second@sru.ac.th"]);
    expect([...getAdditionalAdminEmails({})]).toEqual([]);
  });
  it.each(["backup@gmail.com", "backup@sru.ac.th.evil.test", "backup@sub.sru.ac.th", "backup@evil@sru.ac.th", "backup@student.sru.ac.th", "valid@sru.ac.th,", "bad address@sru.ac.th"])("fails closed on an invalid additional admin configuration: %s", (email) => {
    expect([...getAdditionalAdminEmails({ ADDITIONAL_ADMIN_EMAILS:email })]).toEqual([]);
    expect(validateProductionEnv({ ADDITIONAL_ADMIN_EMAILS:email }).errors).toContain("ADDITIONAL_ADMIN_EMAILS must contain only exact @sru.ac.th addresses separated by commas.");
  });
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

  it("allows explicitly configured owner passwords without a functioning or configured Google client", () => {
    const base = { DATABASE_URL: "postgresql://synthetic@127.0.0.1:1/test", AUTH_SECRET: "synthetic-auth-secret", AUTH_URL: "https://app.example.test" };
    expect(getAuthRuntimeConfiguration({ ...base, ENABLE_OWNER_PASSWORD_LOGIN: "1", OWNER_PASSWORD_USER_ID: "existing-owner" }).ready).toBe(true);
    expect(getAuthRuntimeConfiguration({ ...base, ENABLE_OWNER_PASSWORD_LOGIN: "1" }).ready).toBe(false);
    expect(getAuthRuntimeConfiguration({ ...base, ENABLE_OWNER_PASSWORD_LOGIN: "0", OWNER_PASSWORD_USER_ID: "existing-owner" }).ready).toBe(false);
  });
});
