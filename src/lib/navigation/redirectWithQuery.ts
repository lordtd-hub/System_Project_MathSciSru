import { redirect } from "next/navigation";

type QueryValue = string | number | boolean | null | undefined;

export function buildPathWithQuery(path: string, params: Record<string, QueryValue>): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    query.set(key, String(value));
  }

  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

export function redirectWithQuery(path: string, params: Record<string, QueryValue>): never {
  redirect(buildPathWithQuery(path, params));
}
