/**
 * Task 4.2: an MCP endpoint (Streamable HTTP, stateless, JSON responses) so
 * coding agents can search the catalog, check "has this been built?", and pull
 * a project's license, lineage and a starter prompt.
 *
 * POST /api/mcp with one JSON-RPC 2.0 message per request. Read-only and free.
 */
import { buildStarterPrompt, NO_LICENSE_DISCLAIMER, SITE_NAME, type ProjectCard, type ProjectDetail } from "@forkvlift/shared";
import { HttpError } from "./errors";
import { getProjectDetail } from "./projects/detail";
import { findSimilar } from "./projects/semantic";

export const MCP_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

type RpcResponse = { jsonrpc: "2.0"; id: string | number | null } & ({ result: unknown } | { error: { code: number; message: string; data?: unknown } });

const TOOLS = [
  {
    name: "search_projects",
    title: "Search the catalog",
    description: `Search ${SITE_NAME}'s catalog of open, forkable vibe-coded projects by meaning. Returns name, link, license, stage and stars. Use before building something from scratch.`,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What you're looking for, in plain words (e.g. 'budget tracker with charts')." },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 8 },
      },
      required: ["query"],
    },
  },
  {
    name: "has_this_been_built",
    title: "Has this been built?",
    description: "Describe an app idea in a sentence; get existing projects you could fork instead of starting over.",
    inputSchema: {
      type: "object",
      properties: { idea: { type: "string", description: "One or two sentences describing the app." } },
      required: ["idea"],
    },
  },
  {
    name: "get_project",
    title: "Get a project",
    description: "Full details for one project by slug: license and what it allows, clone command, lineage (what it was forked from), what works and what's missing, and a paste-ready starter prompt.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "The project's slug, from search results or its URL (/p/<slug>)." } },
      required: ["slug"],
    },
  },
] as const;

const INSTRUCTIONS =
  `${SITE_NAME} lists open-source, vibe-coded projects (finished and unfinished) so nobody rebuilds the same app twice. ` +
  "Search before building. Respect each project's license: projects with no license may be read but not copied or adapted. " +
  "Credit the original author and keep lineage when you build on a project.";

function summary(p: ProjectCard, origin: string) {
  return {
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    url: `${origin}/p/${p.slug}`,
    repo: p.repoUrl,
    license: p.license ? p.license.spdx : "none (all rights reserved)",
    stage: p.stage,
    category: p.category.name,
    stars: p.stars,
    forks: p.forks,
    replaces: p.replaces,
  };
}

function details(p: ProjectDetail, origin: string) {
  return {
    ...summary(p, origin),
    description: p.description,
    author: p.author ? `@${p.author.username}` : "curated (unclaimed)",
    license: p.license
      ? { spdx: p.license.spdx, name: p.license.name, summary: p.license.summary, copyleft: p.license.copyleft }
      : { spdx: null, warning: `${NO_LICENSE_DISCLAIMER.title} ${NO_LICENSE_DISCLAIMER.body}` },
    clone: p.license ? p.cloneCommand : null,
    liveUrl: p.liveUrl,
    stack: p.stack,
    forkedFrom: p.forkedFrom ? { slug: p.forkedFrom.slug, name: p.forkedFrom.name, url: `${origin}/p/${p.forkedFrom.slug}` } : null,
    notableForks: p.notableForks.map((f) => ({ slug: f.slug, name: f.name })),
    whatWorks: p.wipStatus?.whatWorks || null,
    whatsMissing: p.wipStatus?.whatsMissing || null,
    lookingForHelp: p.lookingForHelp,
    safetyFlags: p.safety.flags,
    starterPrompt: buildStarterPrompt(p, origin),
  };
}

const text = (value: unknown) => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: value });
const toolError = (message: string) => ({ content: [{ type: "text", text: message }], isError: true });

function str(params: Record<string, unknown> | undefined, key: string, max: number): string {
  const v = params?.[key];
  if (typeof v !== "string" || !v.trim()) throw new RpcError(-32602, `"${key}" is required`);
  return v.trim().slice(0, max);
}

class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

async function callTool(env: Env, name: string, args: Record<string, unknown> | undefined) {
  const origin = env.SITE_ORIGIN;
  switch (name) {
    case "search_projects": {
      const q = str(args, "query", 300);
      const limit = Math.min(20, Math.max(1, Number(args?.limit) || 8));
      const items = await findSimilar(env, q, limit, null);
      return text({ results: items.map((p) => summary(p, origin)) });
    }
    case "has_this_been_built": {
      const idea = str(args, "idea", 500);
      const items = await findSimilar(env, idea, 5, null);
      return text({
        verdict: items.length ? "Similar projects exist. Consider forking one of these instead of starting over." : "Nothing close in the catalog yet.",
        results: items.map((p) => summary(p, origin)),
      });
    }
    case "get_project": {
      const slug = str(args, "slug", 100).replace(/^.*\/p\//, "").replace(/[/?#].*$/, "").toLowerCase();
      try {
        return text(details(await getProjectDetail(env.DB, slug, null), origin));
      } catch (e) {
        if (e instanceof HttpError && e.code === "not_found") return toolError(`No public project with slug "${slug}".`);
        throw e;
      }
    }
    default:
      throw new RpcError(-32602, `Unknown tool: ${name}`);
  }
}

async function dispatch(env: Env, msg: RpcRequest): Promise<unknown> {
  switch (msg.method) {
    case "initialize": {
      const asked = typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : "";
      return {
        protocolVersion: MCP_PROTOCOL_VERSIONS.includes(asked) ? asked : MCP_PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SITE_NAME.toLowerCase(), title: SITE_NAME, version: "1.0.0" },
        instructions: INSTRUCTIONS,
      };
    }
    case "ping":
      return {};
    case "tools/list":
      return { tools: TOOLS };
    case "tools/call": {
      const name = typeof msg.params?.name === "string" ? msg.params.name : "";
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      return callTool(env, name, args);
    }
    default:
      throw new RpcError(-32601, `Method not found: ${msg.method}`);
  }
}

/** Handle one HTTP request; returns null for notifications (202, no body). */
export async function handleMcp(env: Env, body: unknown): Promise<RpcResponse | null> {
  const msg = body as RpcRequest;
  if (!msg || typeof msg !== "object" || Array.isArray(body) || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid request: send one JSON-RPC 2.0 message" } };
  }
  const isNotification = msg.id === undefined;
  try {
    const result = await dispatch(env, msg);
    return isNotification ? null : { jsonrpc: "2.0", id: msg.id ?? null, result };
  } catch (e) {
    if (isNotification) return null;
    if (e instanceof RpcError) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: e.code, message: e.message } };
    console.error("[mcp]", e);
    return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32603, message: "Internal error" } };
  }
}
