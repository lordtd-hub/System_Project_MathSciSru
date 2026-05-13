"use server";

import { cookies } from "next/headers";
import { UI_MODE_COOKIE, isFigmaUiAllowed, type UiMode } from "@/lib/uiMode";

export async function setUiModeAction(formData: FormData) {
  if (!isFigmaUiAllowed()) return;
  const mode = formData.get("mode") === "figma" ? "figma" : "classic";
  const cookieStore = await cookies();
  cookieStore.set(UI_MODE_COOKIE, mode satisfies UiMode, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}
