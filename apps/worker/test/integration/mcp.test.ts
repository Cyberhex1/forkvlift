/* eslint-disable @typescript-eslint/no-explicit-any -- JSON-RPC payloads are loosely shaped in tests */
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { env, resetDb, seedCategory, seedProject } from "./helpers";

const rpc = async (body: unknown) => {
  const res = await app.request("/api/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, env);
  return { status: res.status, body: res.status === 202 ? null : ((await res.json()) as Record<string, any>) };
};

beforeEach(async () => {
  await resetDb();
  await seedCategory("tools");
  await seedProject({ slug: "pixel-paint", tagline: "Pixel art drawing editor", owner: null, tags: ["pixel-art"] });
  await seedProject({ slug: "secret-notes", tagline: "Notes app", license: null });
});

describe("MCP endpoint", () => {
  it("initializes, lists tools and ignores notifications", async () => {
    const init = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "0" } } });
    expect(init.body!.result).toMatchObject({ protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "forklift" } });
    expect((await rpc({ jsonrpc: "2.0", method: "notifications/initialized" })).status).toBe(202);
    const tools = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(tools.body!.result.tools.map((t: { name: string }) => t.name)).toEqual(["search_projects", "has_this_been_built", "get_project"]);
  });

  it("searches and returns project details with a starter prompt", async () => {
    const search = await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "search_projects", arguments: { query: "pixel art" } } });
    expect(search.body!.result.structuredContent.results).toEqual([expect.objectContaining({ slug: "pixel-paint", license: "MIT" })]);

    const detail = await rpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "get_project", arguments: { slug: "https://forklift.stream/p/pixel-paint" } } });
    const p = detail.body!.result.structuredContent;
    expect(p).toMatchObject({ slug: "pixel-paint", license: { spdx: "MIT" }, clone: expect.stringContaining("git clone") });
    expect(p.starterPrompt).toContain("Keep the original LICENSE file");
  });

  it("warns instead of offering a clone for unlicensed projects", async () => {
    const detail = await rpc({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "get_project", arguments: { slug: "secret-notes" } } });
    const p = detail.body!.result.structuredContent;
    expect(p.clone).toBeNull();
    expect(p.license.warning).toContain("No license");
    // Unlicensed projects don't show up in search.
    const search = await rpc({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "search_projects", arguments: { query: "notes" } } });
    expect(search.body!.result.structuredContent.results).toEqual([]);
  });

  it("returns JSON-RPC errors for bad input", async () => {
    expect((await rpc({ jsonrpc: "2.0", id: 7, method: "nope" })).body!.error.code).toBe(-32601);
    expect((await rpc({ jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "get_project", arguments: {} } })).body!.error.code).toBe(-32602);
    expect((await rpc([{ jsonrpc: "2.0", id: 9, method: "ping" }])).body!.error.code).toBe(-32600);
    const missing = await rpc({ jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "get_project", arguments: { slug: "ghost" } } });
    expect(missing.body!.result.isError).toBe(true);
  });
});
