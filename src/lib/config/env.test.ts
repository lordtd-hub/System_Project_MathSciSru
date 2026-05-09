import { describe, expect, it } from "vitest";
import { assertProductionRuntimeEnv, getAuthSecret, getGoogleOAuthCredentials, isProductionRuntime, validateProductionEnv } from "./env";

describe("production environment validation", () => {
  it("accepts AUTH_SECRET or NEXTAUTH_SECRET", () => {
    expect(getAuthSecret({ AUTH_SECRET: "auth-secret" })).toBe("auth-secret");
    expect(getAuthSecret({ NEXTAUTH_SECRET: "nextauth-secret" })).toBe("nextauth-secret");
  });

  it("does not treat Next.js production build phase as runtime", () => {
    expect(isProductionRuntime({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).toBe(false);
    expect(isProductionRuntime({ NODE_ENV: "production" })).toBe(true);
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

  it("throws before Google sign-in in production when OAuth credentials are missing", () => {
    expect(() => getGoogleOAuthCredentials({ NODE_ENV: "production" })).toThrow("Missing production Google OAuth credentials");
    expect(() =>
      getGoogleOAuthCredentials({
        NODE_ENV: "production",
        GOOGLE_CLIENT_ID: "client-id",
        GOOGLE_CLIENT_SECRET: "client-secret"
      })
    ).not.toThrow();
  });
});
