import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

type HeartbeatTarget = {
  label: string;
  url: string;
};

const explicitTargetSpecs = [
  { label: "production", envNames: ["SUPABASE_PROD_DATABASE_URL", "PRODUCTION_DATABASE_URL"] },
  { label: "qa", envNames: ["SUPABASE_QA_DATABASE_URL", "QA_DATABASE_URL"] }
] as const;

function firstConfiguredEnv(env: NodeJS.ProcessEnv, names: readonly string[]) {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return null;
}

function unquoteDotEnvValue(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function loadHeartbeatEnvFile(env: NodeJS.ProcessEnv = process.env, filePath = ".env.heartbeat.local") {
  if (!existsSync(filePath)) return;

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [rawKey, ...rawValueParts] = trimmed.split("=");
    const key = rawKey.trim();
    if (!key) continue;
    if (env[key]) continue;
    env[key] = unquoteDotEnvValue(rawValueParts.join("="));
  }
}

function isLocalDatabaseUrl(url: string) {
  return /(?:localhost|127\.0\.0\.1|::1)/i.test(url);
}

export function collectHeartbeatTargets(env: NodeJS.ProcessEnv = process.env): HeartbeatTarget[] {
  const explicitTargets = explicitTargetSpecs.flatMap((spec) => {
    const url = firstConfiguredEnv(env, spec.envNames);
    return url ? [{ label: spec.label, url }] : [];
  });

  const targets = explicitTargets.length
    ? explicitTargets
    : firstConfiguredEnv(env, ["DATABASE_URL"])
      ? [{ label: "current", url: firstConfiguredEnv(env, ["DATABASE_URL"])! }]
      : [];

  const seenUrls = new Map<string, string>();
  for (const target of targets) {
    if (isLocalDatabaseUrl(target.url) && env.SUPABASE_HEARTBEAT_ALLOW_LOCAL !== "1") {
      throw new Error(`Refusing to heartbeat local database for ${target.label}.`);
    }

    const existingLabel = seenUrls.get(target.url);
    if (existingLabel && existingLabel !== target.label) {
      throw new Error(`Heartbeat targets ${existingLabel} and ${target.label} point to the same database URL.`);
    }
    seenUrls.set(target.url, target.label);
  }

  return targets;
}

async function pingTarget(target: HeartbeatTarget) {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: target.url
      }
    }
  });

  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      label: target.label,
      ok: true,
      checkedAt: new Date().toISOString()
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  loadHeartbeatEnvFile();
  const targets = collectHeartbeatTargets();
  if (!targets.length) {
    throw new Error("No heartbeat database URL configured. Set SUPABASE_PROD_DATABASE_URL and/or SUPABASE_QA_DATABASE_URL.");
  }

  const results = [];
  for (const target of targets) {
    results.push(await pingTarget(target));
  }

  for (const result of results) {
    console.log(`[${result.label}] heartbeat ok at ${result.checkedAt}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
