import { parseArgs } from "node:util";
import { prisma } from "../src/lib/db";
import { provisionOwnerPassword, revokeOwnerPassword } from "../src/lib/auth/ownerPasswordProvision";
import { getAuthBaseUrl } from "../src/lib/config/env";
import { writePrivateOwnerDelivery, removePrivateOwnerDelivery, type PrivateOwnerDelivery } from "../src/lib/auth/ownerPasswordPrivateDelivery";

async function main() {
  const { values } = parseArgs({ options: {
    mode: { type: "string" }, "user-id": { type: "string" }, "current-email": { type: "string" },
    "login-email": { type: "string" }, "verification-reference": { type: "string" }, "expected-app-origin": { type: "string" },
    "confirm-owner-provisioning": { type: "boolean", default: false }, "confirm-owner-revocation": { type: "boolean", default: false },
    "confirm-production": { type: "boolean", default: false }, "replace-existing": { type: "boolean", default: false }
  } });
  const base = new URL(getAuthBaseUrl() ?? "invalid");
  if (base.origin !== values["expected-app-origin"] || base.username || base.password ||
    (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname)))) throw new Error("Unexpected target origin");
  const dbHost = new URL(process.env.DATABASE_URL ?? "invalid").hostname;
  if (!["localhost", "127.0.0.1"].includes(dbHost) && !values["confirm-production"]) throw new Error("Production confirmation required");
  const userId = values["user-id"] ?? "";
  const reference = values["verification-reference"] ?? "";
  if (values.mode === "revoke") {
    if (!values["confirm-owner-revocation"]) throw new Error("Explicit revocation confirmation required");
    await revokeOwnerPassword(userId, reference);
    console.log("Owner password credential revoked. No user identity or records changed.");
    return;
  }
  if (values.mode !== "provision" || !values["confirm-owner-provisioning"]) throw new Error("Explicit provisioning confirmation required");
  let delivery: PrivateOwnerDelivery | undefined;
  try {
    await provisionOwnerPassword({ userId, expectedEmail: values["current-email"] ?? "",
      loginEmail: (values["login-email"] ?? "").trim().toLowerCase(), verificationReference: reference, replaceExisting: values["replace-existing"] },
    async (code, expiresAt) => {
      delivery = await writePrivateOwnerDelivery(
        `Setup page: ${base.origin}/owner-setup\nLogin email: ${values["login-email"]}\nExpires UTC: ${expiresAt.toISOString()}\nOne-time setup code: ${code}\n\nEnter this code on the setup page, choose your own password, then sign in. This code cannot sign in or access admin pages. Delete this private file after use.\n`);
    });
    console.log(`Private owner delivery file created: ${delivery?.deliveryFile}`);
    console.log("Transfer privately to the verified owner. Never paste its contents into chat or logs.");
  } catch (error) {
    if (delivery) await removePrivateOwnerDelivery(delivery).catch(() => undefined);
    throw error;
  }
}

main().catch(() => {
  console.error("Owner credential operation failed. No secret values logged. If outcome is uncertain, inspect the audit record before retrying; do not regenerate blindly.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
