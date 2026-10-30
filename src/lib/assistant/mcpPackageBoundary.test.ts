import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";

const root = process.cwd();
const privateRoot = resolve(root, "packages/nia-mcp");
const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const hash = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const portableTextHash = (path: string) => createHash("sha256").update(readFileSync(path, "utf8").replaceAll("\r\n", "\n")).digest("hex");

describe("isolated hosting package boundary and source artifact", () => {
  it("preserves exact root app manifest/lock and its Zod3", () => {
    // Pinned source-baseline hashes, portable to a normal repository checkout.
    expect(portableTextHash(resolve(root, "package.json"))).toBe("6fbc8612a0228b0d376f57f803934e24fafe7ed3e319900243b54ab0365ae38b");
    expect(portableTextHash(resolve(root, "package-lock.json"))).toBe("00060dd93fe19c4eb3c2797aa9dd48e486efd9a9c91c3a2ee5ccd62964a3dd5b");
    expect(json(resolve(root, "package.json")).dependencies.zod).toMatch(/^\^3\./);
  });
  it("uses the verified exact six-package lock with patched Zod in the subpackage", () => {
    expect(portableTextHash(resolve(privateRoot, "package-lock.json"))).toBe("00f3aa031782abb864b8676c93dc19814e014af21fb5558838c13742665b8f19");
    expect(json(resolve(privateRoot, "package.json")).dependencies.zod).toBe("4.6.6");
  });
  it("keeps generated JS in sync and imports shared domain logic rather than duplicating fixtures", () => {
    const digests = json(resolve(privateRoot, "SOURCE_DIGESTS.json"));
    expect(hash(resolve(privateRoot, "src/transport.ts"))).toBe(digests.sourceSha256);
    expect(hash(resolve(privateRoot, "dist/transport.js"))).toBe(digests.generatedSha256);
    const compiled = readFileSync(resolve(privateRoot, "dist/transport.js"), "utf8");
    expect(compiled).toContain("../../../src/lib/assistant/demoMcp.ts");
    expect(compiled).toContain('from "zod"');
    // Inspect syntax, not comments (the source explicitly documents no env binding).
    const parsed = ts.createSourceFile("transport.js", compiled, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    let readsProcessEnvironment = false;
    const imports: string[] = [];
    function visit(node: ts.Node) {
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "process" && node.name.text === "env") readsProcessEnvironment = true;
      if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "process" && node.argumentExpression && ts.isStringLiteral(node.argumentExpression) && node.argumentExpression.text === "env") readsProcessEnvironment = true;
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
      ts.forEachChild(node, visit);
    }
    visit(parsed);
    expect(readsProcessEnvironment).toBe(false);
    expect(imports).toEqual(["node:crypto", "mcp-handler", "zod", "../../../src/lib/assistant/demoMcp.ts", "../../../src/lib/assistant/demoFixtures.ts"]);
  });
  it("validates metadata and checks installed identities or fails closed when private dependencies are absent", () => {
    const script = resolve(root, "scripts/validate-assistant-mcp-package.mjs");
    const metadata = spawnSync(process.execPath, [script, "--metadata-only"], { cwd: root, encoding: "utf8", windowsHide: true });
    expect(metadata.status).toBe(0);
    expect(JSON.parse(metadata.stdout)).toMatchObject({ metadataOnly: true, packageCount: 6, privateInstalledTreeChecked: false });
    const build = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8", windowsHide: true });
    if (existsSync(resolve(privateRoot, "node_modules"))) {
      expect(build.status).toBe(0);
      expect(JSON.parse(build.stdout)).toMatchObject({ privateInstalledTreeChecked: true });
    } else {
      expect(build.status).not.toBe(0);
      expect(build.stderr).toContain("Isolated packages must be installed before Next build");
    }
  });
  it("limits future branch build change to script-disabled locked private install and keeps cron/regions", () => {
    const cfg = json(resolve(root, "vercel.json"));
    expect(cfg.regions).toEqual(["sin1"]);
    expect(cfg.crons).toEqual([{ path: "/api/cron/heartbeat", schedule: "0 2 * * *" }]);
    expect(cfg.buildCommand).toContain("npm ci --prefix packages/nia-mcp --ignore-scripts --no-audit --no-fund");
    expect(cfg.buildCommand).toContain("node scripts/validate-assistant-mcp-package.mjs && npm run build");
  });
});
