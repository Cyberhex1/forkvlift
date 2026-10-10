import type { Hono } from "hono";
import type { AppEnv } from "../env";
import { handleMcp } from "../core/mcp";
import { clientIp } from "../core/security";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept, authorization, mcp-protocol-version, mcp-session-id",
};

/** Task 4.2: MCP endpoint for coding agents. Public, read-only, rate-limited per IP. */
export function registerMcp(app: Hono<AppEnv>) {
  app.options("/api/mcp", () => new Response(null, { status: 204, headers: CORS }));
  app.get("/api/mcp", () => new Response("This MCP server speaks Streamable HTTP: POST JSON-RPC messages here.", { status: 405, headers: { ...CORS, allow: "POST" } }));
  app.post("/api/mcp", async (c) => {
    if (c.env.RL_API && c.env.DISABLE_RATE_LIMITS !== "true") {
      const { success } = await c.env.RL_API.limit({ key: `mcp:${clientIp(c.req.raw)}` });
      if (!success) return c.json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Rate limited: slow down a little." } }, 429, CORS);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400, CORS);
    }
    const res = await handleMcp(c.env, body);
    if (!res) return new Response(null, { status: 202, headers: CORS });
    return c.json(res, 200, { ...CORS, "cache-control": "no-store" });
  });
}
