import type { DemoEnvironment } from "../../../src/lib/assistant/demoPolicy";
import type { OAuthRequestVerifier } from "../../../src/lib/assistant/demoMcp";
export type TransportAudit = Readonly<{ requestId: string; status: number; method: "GET" | "POST" | "OTHER" }>;
export declare const MAX_MCP_BODY_BYTES = 65536;
export declare const METADATA_PATH: string;
export declare function createSyntheticMcpTransport(options?: {
  env?: DemoEnvironment;
  verifyRequest?: OAuthRequestVerifier;
  now?: () => number;
  audit?: (event: TransportAudit) => void;
}): (request: Request) => Promise<Response>;
