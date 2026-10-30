import { createDemoApi, type DemoAuditEvent } from "./demoApi";
import { readDemoConfiguration, type DemoEnvironment } from "./demoPolicy";
import { verifyConfiguredMachineBearer } from "./machineAuth";

export function createConfiguredDemoHandler(env: DemoEnvironment, now = Date.now, audit: (event: DemoAuditEvent) => void = () => {}) {
  const configuration = readDemoConfiguration(env);
  return createDemoApi({ configuration, now, audit,
    verifyBearer: (token) => configuration.state === "ready"
      ? verifyConfiguredMachineBearer(token, configuration.credential, now()) : null
  });
}

// No enabled feature/credential is included or supplied by this change.
// This reads only the dedicated server configuration after environment gating.
export const handleAssistantDemoRequest = createConfiguredDemoHandler(process.env, Date.now, (event) => {
  console.info("assistant_demo_request", JSON.stringify(event));
});
