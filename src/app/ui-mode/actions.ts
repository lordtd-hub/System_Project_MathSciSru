"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { UI_MODE_COOKIE, isFigmaUiAllowed, type UiMode } from "@/lib/uiMode";

function uiModeRedirectPath(referer: string | null) {
  if (!referer) return "/";
  try {
    const url = new URL(referer);
    return `${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
}

export async function setUiModeAction(formData: FormData) {
  if (!isFigmaUiAllowed()) return;
  const mode = formData.get("mode") === "figma" ? "figma" : "classic";
  const cookieStore = await cookies();
  const headerStore = await headers();
  cookieStore.set(UI_MODE_COOKIE, mode satisfies UiMode, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
  redirect(uiModeRedirectPath(headerStore.get("referer")));
}
