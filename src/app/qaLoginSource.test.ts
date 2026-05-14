import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const placeholderSecret = "do-not-hard-code-qa-secret";

describe("QA login source guards", () => {
  it("keeps QA login off public homepage and only links it for active QA sessions", () => {
    const homePage = readFileSync(join(root, "src/app/page.tsx"), "utf8");
    const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");

    expect(homePage).not.toContain("/qa-login");
    expect(layout).toContain("isQaLoginEnabled()");
    expect(layout).toContain("DEV_SESSION_COOKIE");
    expect(layout).toContain("decodeDevSession");
    expect(layout).toContain("กลับหน้า QA Login");
  });

  it("rate-limits and secret-protects QA login action", () => {
    const actionSource = readFileSync(join(root, "src/app/qa-login/actions.ts"), "utf8");

    expect(actionSource).toContain("assertRateLimit");
    expect(actionSource).toContain("verifyQaLoginSecret");
    expect(actionSource).toContain("QA_LOGIN_SECRET");
    expect(actionSource).toContain("encodeDevSession");
    expect(actionSource).toContain("clearRealAuthCookies");
  });

  it("lets auth read QA sessions only through the QA gate", () => {
    const authSource = readFileSync(join(root, "src/auth.ts"), "utf8");

    expect(authSource).toContain("isDevLoginEnabled() || isQaLoginEnabled()");
    expect(authSource).toContain("decodeDevSession");
  });

  it("explains the multi-user QA identity design without exposing secrets", () => {
    const pageSource = readFileSync(join(root, "src/app/qa-login/page.tsx"), "utf8");

    expect(pageSource).toContain("Multi-User Pilot");
    expect(pageSource).toContain("MULTI-PILOT-R2 operational simulation");
    expect(pageSource).toContain("prepareMultiPilotR2Data");
    expect(pageSource).toContain("prepareMultiPilotR2Wave2Data");
    expect(pageSource).toContain("QA Mode");
    expect(pageSource).toContain('defaultValue=""');
    expect(pageSource).toContain('<option value="" disabled>เลือกบทบาท</option>');
    expect(pageSource).not.toContain(placeholderSecret);
  });

  it("keeps the QA pilot setup guarded by QA login controls", () => {
    const actionSource = readFileSync(join(root, "src/app/qa-login/actions.ts"), "utf8");

    expect(actionSource).toContain("prepareQaPilotIdentities");
    expect(actionSource).toContain("prepareMultiPilotR2Data");
    expect(actionSource).toContain("prepareMultiPilotR2Wave2Data");
    expect(actionSource).toContain("verifyQaLoginSecret");
    expect(actionSource).toContain("isQaLoginEnabled");
    expect(actionSource).toContain("prisma.project.upsert");
    expect(actionSource).toContain("status: \"STUDENT_PROFILE\"");
    expect(actionSource).toContain("MULTI_PILOT_R2_COURSE_TITLE");
    expect(actionSource).toContain("MULTI_PILOT_R2_WAVE2_COURSE_TITLE");
    expect(actionSource).not.toContain("deleteMany");
    expect(actionSource).not.toContain(placeholderSecret);
  });
});
