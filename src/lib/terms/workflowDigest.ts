import { createHash } from "node:crypto";
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function workflowDigest(value: unknown) {
  // Dates and Prisma decimals retain their serialized values rather than becoming empty objects.
  return createHash("sha256").update(stable(JSON.parse(JSON.stringify(value)))).digest("hex");
}
