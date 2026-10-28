import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { removePrivateOwnerDelivery, writePrivateOwnerDelivery } from "../src/lib/auth/ownerPasswordPrivateDelivery";

async function main() {
  // Non-secret placeholder only. This rehearsal creates no enrollment code/user/DB row.
  const placeholder = "SYNTHETIC DELIVERY PERMISSION REHEARSAL — NOT A CREDENTIAL";
  const delivery = await writePrivateOwnerDelivery(placeholder);
  try {
    if (await readFile(delivery.deliveryFile, "utf8") !== placeholder) throw new Error("Synthetic file unreadable");
    if (process.platform === "win32") {
      const sid = execFileSync("whoami.exe", ["/user", "/fo", "csv", "/nh"], { encoding: "utf8", windowsHide: true }).match(/S-1-\d+(?:-\d+)+/)?.[0];
      if (!sid) throw new Error("Missing current SID");
      const inspect = (path: string) => {
        const escaped = path.replaceAll("'", "''");
        const command = `$a=Get-Acl -LiteralPath '${escaped}'; $r=@($a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]) | ForEach-Object { @{sid=$_.IdentityReference.Value;allow=($_.AccessControlType -eq 'Allow')} }); @{protected=$a.AreAccessRulesProtected;rules=$r} | ConvertTo-Json -Compress -Depth 4`;
        // Use the existing PowerShell Core matching the inherited Core modules;
        // Windows PowerShell 5 cannot load that Core-only Security module.
        return JSON.parse(execFileSync("pwsh.exe", ["-NoProfile", "-EncodedCommand", Buffer.from(command, "utf16le").toString("base64")],
          { encoding: "utf8", windowsHide: true })) as { protected: boolean; rules: Array<{ sid: string; allow: boolean }> };
      };
      const directoryAcl = inspect(delivery.directory);
      const fileAcl = inspect(delivery.deliveryFile);
      if (!directoryAcl.protected || !directoryAcl.rules.length || !fileAcl.rules.length ||
        [...directoryAcl.rules, ...fileAcl.rules].some((rule) => !rule.allow || rule.sid !== sid)) throw new Error("Unexpected delivery access rule");
      console.log("PASS: Windows directory inheritance disabled; directory/file allow only current SID; synthetic file readable.");
    } else {
      if (((await stat(delivery.directory)).mode & 0o077) || ((await stat(delivery.deliveryFile)).mode & 0o077)) throw new Error("Private mode missing");
      console.log("PASS: owner-only Unix directory/file modes; synthetic file readable.");
    }
  } finally { await removePrivateOwnerDelivery(delivery); }
  console.log("PASS: verified private temporary directory/file cleaned up; no credentials issued.");
}
main().catch((error: unknown) => {
  const detail = error as { code?: string; syscall?: string; message?: string };
  console.error(`FAIL: synthetic delivery rehearsal (${detail.code ?? "assertion"}, ${detail.syscall ?? detail.message ?? "unknown"}); no real credentials involved.`);
  process.exitCode = 1;
});
