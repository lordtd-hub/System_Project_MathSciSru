import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, unlink, rmdir, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";

export type PrivateOwnerDelivery = { directory: string; deliveryFile: string };

export async function removePrivateOwnerDelivery(delivery: PrivateOwnerDelivery) {
  const root = await realpath(tmpdir());
  const directory = await realpath(delivery.directory);
  if (!directory.toLowerCase().startsWith(`${root}${sep}`.toLowerCase()) || !basename(directory).startsWith("owner-password-enrollment-") ||
    resolve(delivery.deliveryFile).toLowerCase() !== join(directory, "owner-enrollment.txt").toLowerCase()) throw new Error("Unsafe delivery cleanup target");
  await unlink(delivery.deliveryFile);
  await rmdir(directory); // Empty, newly created directory only; never recursive.
}

export async function writePrivateOwnerDelivery(content: string): Promise<PrivateOwnerDelivery> {
  const directory = await mkdtemp(join(tmpdir(), "owner-password-enrollment-"));
  const deliveryFile = join(directory, "owner-enrollment.txt");
  try {
    if (process.platform === "win32") {
      const identity = execFileSync("whoami.exe", ["/user", "/fo", "csv", "/nh"], { encoding: "utf8", windowsHide: true });
      const sid = identity.match(/S-1-\d+(?:-\d+)+/)?.[0];
      if (!sid) throw new Error("Cannot establish private delivery ACL");
      execFileSync("icacls.exe", [directory, "/inheritance:r", "/grant:r", `*${sid}:(OI)(CI)F`], { stdio: "pipe", windowsHide: true });
    }
    await writeFile(deliveryFile, content, { flag: "wx", mode: 0o600 });
    return { directory, deliveryFile };
  } catch (error) {
    await unlink(deliveryFile).catch(() => undefined);
    await rmdir(directory).catch(() => undefined);
    throw error;
  }
}
