import { createConnectionProbe } from "../../../../../../packages/nia-mcp/dist/connectionProbe.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
const handle = createConnectionProbe({ environment: process.env });
export { handle as GET, handle as POST, handle as HEAD, handle as OPTIONS,
  handle as PUT, handle as PATCH, handle as DELETE };
