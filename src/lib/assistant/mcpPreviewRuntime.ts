import { createProtectedPreviewRoutes } from "./mcpPreviewRoutes";

/** Default-off scaffold. Deliberately no operational verifier/provider configured. */
export const handleProtectedMcpPreview = createProtectedPreviewRoutes({
  environment: process.env,
  loadTransport: () => import("../../../packages/nia-mcp/dist/transport.js"),
  audit: (event) => console.info(JSON.stringify({ subsystem: "assistant-mcp-preview", ...event }))
});
