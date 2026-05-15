type EnvLike = Record<string, string | undefined>;

function isNormalProductionDeployment(env: EnvLike) {
  return env.NODE_ENV === "production" && env.VERCEL_ENV === "production";
}

function isQaEnvironment(env: EnvLike) {
  return env.NODE_ENV !== "production" || env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "development";
}

export function isQaAunEvidenceAlignmentEnabled(env: EnvLike = process.env) {
  if (env.ENABLE_QA_AUN_EVIDENCE_ALIGNMENT !== "1") return false;
  if (isNormalProductionDeployment(env)) return false;
  return isQaEnvironment(env);
}
