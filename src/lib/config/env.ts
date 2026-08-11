const productionBuildPhase = "phase-production-build";

export type EnvValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

type EnvLike = Record<string, string | undefined>;

export type AuthRuntimeConfiguration = {
  ready: boolean;
  missing: string[];
};

function readEnv(env: EnvLike, name: string) {
  const value = env[name]?.trim();
  return value || undefined;
}

function looksUnset(value: string | undefined) {
  return !value || value === "change-me" || value === "change-me-dev-only";
}

function isLocalUrl(value: string | undefined) {
  return Boolean(value && /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(value));
}

function isHttpsUrl(value: string | undefined) {
  return Boolean(value && /^https:\/\//i.test(value));
}

function isLocalDatabaseUrl(value: string | undefined) {
  return Boolean(value && /(localhost|127\.0\.0\.1)/i.test(value));
}

export function isProductionRuntime(env: EnvLike = process.env) {
  if (env.NEXT_PHASE === productionBuildPhase) return false;
  const vercelEnvironment = readEnv(env, "VERCEL_ENV");
  if (vercelEnvironment) return vercelEnvironment === "production";
  return env.NODE_ENV === "production";
}

export function isVercelProductionDeployment(env: EnvLike = process.env) {
  return readEnv(env, "VERCEL_ENV") === "production";
}

export function getAuthSecret(env: EnvLike = process.env) {
  return readEnv(env, "AUTH_SECRET") ?? readEnv(env, "NEXTAUTH_SECRET");
}

export function getAuthBaseUrl(env: EnvLike = process.env) {
  return readEnv(env, "AUTH_URL") ?? readEnv(env, "NEXTAUTH_URL");
}

export function getGoogleOAuthCredentials(env: EnvLike = process.env) {
  const clientId = readEnv(env, "GOOGLE_CLIENT_ID");
  const clientSecret = readEnv(env, "GOOGLE_CLIENT_SECRET");
  return {
    clientId: clientId ?? "",
    clientSecret: clientSecret ?? ""
  };
}

export function getAuthRuntimeConfiguration(env: EnvLike = process.env): AuthRuntimeConfiguration {
  const required = [
    ["DATABASE_URL", readEnv(env, "DATABASE_URL")],
    ["AUTH_SECRET or NEXTAUTH_SECRET", getAuthSecret(env)],
    ["AUTH_URL or NEXTAUTH_URL", getAuthBaseUrl(env)],
    ["GOOGLE_CLIENT_ID", readEnv(env, "GOOGLE_CLIENT_ID")],
    ["GOOGLE_CLIENT_SECRET", readEnv(env, "GOOGLE_CLIENT_SECRET")]
  ] as const;
  const missing = required.filter(([, value]) => looksUnset(value)).map(([name]) => name);
  return { ready: missing.length === 0, missing };
}

export function getInitialAdminEmail(env: EnvLike = process.env) {
  return readEnv(env, "INITIAL_ADMIN_EMAIL")?.toLowerCase();
}

export function validateProductionEnv(env: EnvLike = process.env): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const databaseUrl = readEnv(env, "DATABASE_URL");
  const authSecret = getAuthSecret(env);
  const authUrl = getAuthBaseUrl(env);
  const googleClientId = readEnv(env, "GOOGLE_CLIENT_ID");
  const googleClientSecret = readEnv(env, "GOOGLE_CLIENT_SECRET");
  const initialAdminEmail = getInitialAdminEmail(env);

  if (looksUnset(databaseUrl)) errors.push("DATABASE_URL is required.");
  if (looksUnset(authSecret)) errors.push("AUTH_SECRET or NEXTAUTH_SECRET is required.");
  if (looksUnset(authUrl)) errors.push("AUTH_URL or NEXTAUTH_URL is required.");
  if (looksUnset(googleClientId)) errors.push("GOOGLE_CLIENT_ID is required.");
  if (looksUnset(googleClientSecret)) errors.push("GOOGLE_CLIENT_SECRET is required.");
  if (looksUnset(initialAdminEmail)) errors.push("INITIAL_ADMIN_EMAIL is required for the first production Admin.");
  if (initialAdminEmail && !initialAdminEmail.endsWith("@sru.ac.th")) {
    errors.push("INITIAL_ADMIN_EMAIL must be an @sru.ac.th address.");
  }

  if (isLocalDatabaseUrl(databaseUrl)) warnings.push("DATABASE_URL points to localhost; use Supabase/PostgreSQL in production.");
  if (isProductionRuntime(env)) {
    if (isLocalUrl(authUrl)) errors.push("AUTH_URL/NEXTAUTH_URL must not point to localhost in production.");
    if (authUrl && !isHttpsUrl(authUrl)) errors.push("AUTH_URL/NEXTAUTH_URL must use HTTPS in production.");
  } else if (isLocalUrl(authUrl)) {
    warnings.push("AUTH_URL/NEXTAUTH_URL points to localhost; use the production HTTPS URL in production.");
  }
  if (env.AUTH_TRUST_HOST !== "true") {
    warnings.push("AUTH_TRUST_HOST=true is usually required behind Vercel/reverse proxies. Confirm before launch.");
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function assertProductionRuntimeEnv(env: EnvLike = process.env) {
  if (!isProductionRuntime(env)) return;
  const result = validateProductionEnv(env);
  if (!result.ok) {
    throw new Error(`Production environment is not ready:\n${result.errors.join("\n")}`);
  }
}
