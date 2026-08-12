import { handlers } from "@/auth";
import { getAuthRuntimeConfiguration } from "@/lib/config/env";
import { NextResponse } from "next/server";

function authUnavailable() {
  return NextResponse.json(
    { error: "Authentication is not configured for this environment." },
    { status: 503 }
  );
}

export const GET = getAuthRuntimeConfiguration().ready ? handlers.GET : authUnavailable;
export const POST = getAuthRuntimeConfiguration().ready ? handlers.POST : authUnavailable;
