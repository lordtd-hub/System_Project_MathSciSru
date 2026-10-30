import { handleAssistantDemoRequest } from "@/lib/assistant/demoRuntime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const GET = handleAssistantDemoRequest;
// Explicit exports prevent Next.js from generating implicit HEAD/OPTIONS success.
export const HEAD = handleAssistantDemoRequest;
export const OPTIONS = handleAssistantDemoRequest;
export const POST = handleAssistantDemoRequest;
export const PUT = handleAssistantDemoRequest;
export const PATCH = handleAssistantDemoRequest;
export const DELETE = handleAssistantDemoRequest;
