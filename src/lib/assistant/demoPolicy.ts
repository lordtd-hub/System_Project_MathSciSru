import { validMachineCredentialRecord, type MachineCredentialRecord } from "./machineAuth";

export type DemoEnvironment = Readonly<Record<string, string | undefined>>;
export type ReadyDemoConfiguration = Readonly<{
  state: "ready";
  environment: "local-test" | "qa-preview";
  origin: string;
  audience: string;
  credential: MachineCredentialRecord;
}>;
export type DemoConfiguration = ReadyDemoConfiguration | Readonly<{ state: "disabled" | "misconfigured" }>;

function validOrigin(origin: string, environment: ReadyDemoConfiguration["environment"]) {
  try {
    const url = new URL(origin);
    if (url.origin !== origin || url.username || url.password) return false;
    if (environment === "qa-preview") return url.protocol === "https:";
    return url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  } catch { return false; }
}

/** Environment values are server configuration, never caller headers/cookies. */
export function readDemoConfiguration(env: DemoEnvironment): DemoConfiguration {
  // Do not even read credential configuration outside an explicitly allowed env.
  if (env.ENABLE_ASSISTANT_DEMO_API !== "1" || env.VERCEL_ENV === "production") {
    return Object.freeze({ state: "disabled" });
  }
  let environment: ReadyDemoConfiguration["environment"];
  if (env.VERCEL_ENV === "preview") {
    if (!env.ASSISTANT_DEMO_PREVIEW_BRANCH || env.VERCEL_GIT_COMMIT_REF !== env.ASSISTANT_DEMO_PREVIEW_BRANCH ||
      !env.ASSISTANT_DEMO_EXPECTED_PROJECT_ID || env.VERCEL_PROJECT_ID !== env.ASSISTANT_DEMO_EXPECTED_PROJECT_ID) {
      return Object.freeze({ state: "disabled" });
    }
    environment = "qa-preview";
  } else if (env.VERCEL_ENV === undefined && env.ASSISTANT_DEMO_LOCAL_TEST === "1" &&
    (env.NODE_ENV === "development" || env.NODE_ENV === "test")) {
    environment = "local-test";
  } else {
    return Object.freeze({ state: "disabled" });
  }

  const origin = env.ASSISTANT_DEMO_ORIGIN ?? "";
  const audience = env.ASSISTANT_DEMO_AUDIENCE ?? "";
  const credential: MachineCredentialRecord = Object.freeze({
    credentialId: env.ASSISTANT_DEMO_CREDENTIAL_ID ?? "",
    tokenSha256: env.ASSISTANT_DEMO_CREDENTIAL_SHA256 ?? "",
    audience,
    notBeforeEpochMs: Date.parse(env.ASSISTANT_DEMO_CREDENTIAL_NOT_BEFORE ?? ""),
    expiresAtEpochMs: Date.parse(env.ASSISTANT_DEMO_CREDENTIAL_EXPIRES_AT ?? ""),
    // Missing revocation config is not interpreted as active approval.
    revoked: env.ASSISTANT_DEMO_CREDENTIAL_REVOKED !== "0"
  });
  if (!validOrigin(origin, environment) || !validMachineCredentialRecord(credential)) {
    return Object.freeze({ state: "misconfigured" });
  }
  return Object.freeze({ state: "ready", environment, origin, audience, credential });
}
