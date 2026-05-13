import { cookies } from "next/headers";
import { isQaLoginEnabled } from "@/lib/auth/qaLogin";

export type UiMode = "classic" | "figma";

export const UI_MODE_COOKIE = "project_ui_mode";

export function isFigmaUiAllowed(env: Record<string, string | undefined> = process.env) {
  if (env.VERCEL_ENV === "production" && env.FIGMA_UI_ALLOW_PRODUCTION !== "1") return false;
  return env.ENABLE_FIGMA_UI === "1" || isQaLoginEnabled(env);
}

export async function getUiMode(): Promise<UiMode> {
  if (!isFigmaUiAllowed()) return "classic";
  const cookieStore = await cookies();
  return cookieStore.get(UI_MODE_COOKIE)?.value === "figma" ? "figma" : "classic";
}
