import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const privateRoot = resolve(root, "packages/nia-mcp");
const metadataOnly = process.argv.includes("--metadata-only");
if (process.argv.slice(2).some((arg) => arg !== "--metadata-only")) throw new Error("Unknown validation option");
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const pkg = json(resolve(privateRoot, "package.json"));
const rootPkg = json(resolve(root, "package.json"));
const lock = json(resolve(privateRoot, "package-lock.json"));
const expected = { "mcp-handler": "2.3.0", "@modelcontextprotocol/server": "2.4.0", zod: "4.6.6",
  "@modelcontextprotocol/core": "2.4.0", chalk: "5.6.2", commander: "11.1.0" };
const direct = { "mcp-handler": "2.3.0", "@modelcontextprotocol/server": "2.4.0", zod: "4.6.6" };
const same = (a, b) => JSON.stringify(Object.entries(a ?? {}).sort()) === JSON.stringify(Object.entries(b).sort());
if (!pkg.private || pkg.type !== "module" || !same(pkg.dependencies, direct) || lock.lockfileVersion !== 3 ||
  !same(lock.packages[""].dependencies, direct)) throw new Error("Unexpected private package identity/pins");
if (!/^\^?3\./.test(rootPkg.dependencies.zod) || rootPkg.dependencies["mcp-handler"] || rootPkg.dependencies["@modelcontextprotocol/server"]) throw new Error("Root application dependency boundary changed");
const entries = Object.entries(lock.packages).filter(([path]) => path);
if (entries.length !== Object.keys(expected).length) throw new Error("Unexpected graph size");
for (const [path, entry] of entries) {
  const name = entry.name ?? path.replace(/^.*node_modules\//, "");
  if (entry.version !== expected[name] || entry.hasInstallScript || entry.link ||
    new URL(entry.resolved).origin !== "https://registry.npmjs.org" || !/^sha512-/.test(entry.integrity)) throw new Error("Unexpected package source/version/hook");
  if (!metadataOnly) {
    const installedPath = resolve(privateRoot, path, "package.json");
    if (!existsSync(installedPath)) throw new Error("Isolated packages must be installed before Next build");
    const installed = json(installedPath);
    if (installed.name !== name || installed.version !== entry.version) throw new Error("Installed package mismatch");
  }
}
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const source = json(resolve(privateRoot, "SOURCE_DIGESTS.json"));
if (digest(resolve(privateRoot, "src/transport.ts")) !== source.sourceSha256 ||
  digest(resolve(privateRoot, "dist/transport.js")) !== source.generatedSha256) throw new Error("Generated artifact/source mismatch");
console.log(JSON.stringify({ status: "passed", metadataOnly, packageCount: entries.length,
  rootZodUnchangedMajor: 3, privateZod: "4.6.6", privateInstalledTreeChecked: !metadataOnly }));
