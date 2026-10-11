import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app";
import { exportCatalog, verifyWebhook } from "../../src/core/mirror";
import { env, resetDb, seedCategory, seedProject } from "./helpers";

const cfg = { ...env, MIRROR_REPO: "forklift/catalog-mirror", MIRROR_GITHUB_TOKEN: "test-token", MIRROR_WEBHOOK_SECRET: "shh" } as Env;

beforeEach(async () => {
  await resetDb();
  await env.DB.prepare(`DELETE FROM candidates`).run();
  await seedCategory("tools");
  await seedProject({ slug: "pixel-paint", tags: ["pixel-art"], owner: null });
  await seedProject({ slug: "no-license", license: null });
});
afterEach(() => vi.unstubAllGlobals());

/** A tiny fake of the GitHub git-data API: one repo, one branch. */
function fakeMirror(initialTree: { path: string; sha: string }[]) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  let treeSha = "tree0";
  vi.stubGlobal("fetch", async (input: RequestInfo, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: url.pathname, body });
    const p = url.pathname.replace("/repos/forklift/catalog-mirror", "");
    if (p === "/git/ref/heads/main") return Response.json({ object: { sha: "commit0" } });
    if (p === "/git/commits/commit0") return Response.json({ tree: { sha: treeSha } });
    if (p.startsWith("/git/trees/") && method === "GET") return Response.json({ truncated: false, tree: initialTree.map((t) => ({ ...t, mode: "100644", type: "blob" })) });
    if (p === "/git/trees" && method === "POST") return Response.json({ sha: "tree1" });
    if (p === "/git/commits" && method === "POST") return Response.json({ sha: "commit1" });
    if (p === "/git/refs/heads/main" && method === "PATCH") return Response.json({});
    return new Response("not found", { status: 404 });
  });
  return { calls, setTree: (s: string) => (treeSha = s) };
}

describe("catalog mirror export", () => {
  it("writes licensed projects and categories, keeps other files, drops stale projects", async () => {
    const gh = fakeMirror([{ path: "README.md", sha: "r" }, { path: "projects/gone.json", sha: "g" }]);
    const r = await exportCatalog(cfg);
    expect(r).toEqual({ commit: "commit1", projects: 1 });
    const tree = gh.calls.find((c) => c.method === "POST" && c.path.endsWith("/git/trees"))!.body as { tree: { path: string; content?: string }[] };
    expect(tree.tree.map((t) => t.path).sort()).toEqual(["README.md", "categories.json", "projects/pixel-paint.json"]);
    const record = JSON.parse(tree.tree.find((t) => t.path === "projects/pixel-paint.json")!.content!);
    expect(record).toMatchObject({ slug: "pixel-paint", licenseSpdx: "MIT", categorySlug: "tools", tags: ["pixel-art"] });
    expect(gh.calls.some((c) => c.method === "PATCH")).toBe(true);
  });

  it("does nothing when unconfigured or unchanged", async () => {
    expect(await exportCatalog(env)).toEqual({ commit: null, projects: 0 });
    const gh = fakeMirror([]);
    gh.setTree("tree1"); // the new tree matches the current one
    expect((await exportCatalog(cfg)).commit).toBeNull();
    expect(gh.calls.some((c) => c.method === "PATCH")).toBe(false);
  });
});

describe("mirror webhook", () => {
  const sign = async (body: string) => {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("shh"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
    return `sha256=${[...mac].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  };

  it("verifies signatures", async () => {
    expect(await verifyWebhook("shh", "x", await sign("x"))).toBe(true);
    expect(await verifyWebhook("shh", "y", await sign("x"))).toBe(false);
    expect(await verifyWebhook("shh", "x", null)).toBe(false);
  });

  it("rejects unsigned calls and answers 503 when unconfigured", async () => {
    expect((await app.request("/api/mirror/webhook", { method: "POST", body: "{}" }, env)).status).toBe(503);
    const res = await app.request("/api/mirror/webhook", { method: "POST", body: "{}", headers: { "x-hub-signature-256": "sha256=00", "x-github-event": "pull_request" } }, cfg);
    expect(res.status).toBe(401);
  });
});
