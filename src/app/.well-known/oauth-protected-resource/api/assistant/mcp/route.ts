import { handleProtectedMcpPreview } from "@/lib/assistant/mcpPreviewRuntime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export { handleProtectedMcpPreview as GET, handleProtectedMcpPreview as POST,
  handleProtectedMcpPreview as HEAD, handleProtectedMcpPreview as OPTIONS, handleProtectedMcpPreview as PUT,
  handleProtectedMcpPreview as PATCH, handleProtectedMcpPreview as DELETE };
