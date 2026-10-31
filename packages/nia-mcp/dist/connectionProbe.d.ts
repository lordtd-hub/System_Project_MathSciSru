export declare const PROBE_PATH = "/api/assistant/connection-probe/mcp";
export declare const MAX_PROBE_BODY_BYTES = 8192;
export declare const PROBE_VALUE: Readonly<{ service: string; version: string; read_only: boolean }>;
export declare function createConnectionProbe(options?: Readonly<{
 environment?: Readonly<Record<string, string | undefined>>;
 now?: () => number;
}>): (request: Request) => Promise<Response>;
