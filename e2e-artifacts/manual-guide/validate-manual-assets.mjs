import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const content = readFileSync("src/app/manual/manualContent.ts", "utf8");
const screenshotMatches = [...content.matchAll(/screenshot: "([^"]+)"/g)];
const screenshots = screenshotMatches.map((match) => match[1]);

const missing = screenshots.filter((file) => {
  const roleDir = file.startsWith("student-") ? "student" : "teacher";
  return !existsSync(join("public", "manual", "screenshots", roleDir, file));
});

const textFiles = [
  "src/app/manual/manualContent.ts",
  "src/app/manual/ManualGuidePage.tsx",
  "src/app/manual/ManualScreenshot.tsx",
  "e2e-artifacts/manual-guide/HANDOFF_2026-05-15.md"
];

const mojibakeMarkers = ["เธ", "โ€", "เน€"];
const textIssues = textFiles
  .map((file) => {
    const text = readFileSync(file, "utf8");
    return {
      file,
      hasMojibakeMarker: mojibakeMarkers.some((marker) => text.includes(marker))
    };
  })
  .filter((item) => item.hasMojibakeMarker);

console.log(
  JSON.stringify(
    {
      screenshotCount: screenshots.length,
      missing,
      textIssues
    },
    null,
    2
  )
);

if (missing.length || textIssues.length) {
  process.exitCode = 1;
}
