import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Board, Comment, ProjectDetail } from "@forkvlift/shared";
import { api, env, resetDb, seedCategory, seedProject, seedUser } from "./helpers";

let ada = "";
let bo = "";
/** GitHub repos that "exist" for this test, keyed by full name → parent full name (null = not a fork). */
let ghRepos: Record<string, string | null> = {};

beforeEach(async () => {
  await resetDb();
  await env.DB.batch(["notifications", "comments"].map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
  await env.CACHE.list().then((l) => Promise.all(l.keys.map((k) => env.CACHE.delete(k.name))));
  await seedCategory("tools");
  ada = await seedUser("usr_ada", "ada");
  bo = await seedUser("usr_bo", "bo");
  await seedProject({ slug: "bo-tool", owner: "usr_bo" }); // repo bo/bo-tool, MIT
  await seedProject({ slug: "bo-closed", owner: "usr_bo", license: null });
  ghRepos = {};
  vi.stubGlobal("fetch", async (input: RequestInfo) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.startsWith("https://challenges.cloudflare.com/")) return Response.json({ success: true });
    const { pathname } = new URL(url);
    const m = pathname.match(/^\/repos\/([^/]+\/[^/]+)(\/.*)?$/);
    if (!m || !(m[1]! in ghRepos)) return new Response("{}", { status: 404 });
    if (m[2] === "/readme") return new Response("<p>fork</p>");
    if (m[2]?.startsWith("/contributors")) return Response.json([{}]);
    if (m[2]?.startsWith("/git/trees")) return Response.json({ tree: [] });
    const [owner, name] = m[1]!.split("/");
    const parent = ghRepos[m[1]!];
    return Response.json({
      id: 5, full_name: m[1], name, owner: { login: owner, type: "User" }, html_url: `https://github.com/${m[1]}`, clone_url: `https://github.com/${m[1]}.git`,
      description: "fork", homepage: null, topics: [], language: "TypeScript", stargazers_count: 0, forks_count: 0, open_issues_count: 0,
      archived: false, disabled: false, fork: parent !== null, parent: parent ? { full_name: parent } : undefined,
      default_branch: "main", created_at: "2026-10-01T00:00:00Z", pushed_at: "2026-10-09T00:00:00Z", private: false, license: { spdx_id: "MIT", name: "MIT License" },
    });
  });
});
afterEach(() => vi.unstubAllGlobals());

const cont = (slug: string, as = ada) => api<{ forkRepoUrl: string; studioCardId: string; error?: { code: string; details?: { forkUrl: string } } }>(`/api/projects/${slug}/fork`, { method: "POST", as });

describe("Continue this", () => {
  it("sends you to GitHub until the fork exists, then records lineage, a Studio card and a notification", async () => {
    const first = await cont("bo-tool");
    expect(first.status).toBe(409);
    expect(first.body.error?.details?.forkUrl).toBe("https://github.com/bo/bo-tool/fork");

    ghRepos["ada/bo-tool"] = "bo/bo-tool";
    const second = await cont("bo-tool");
    expect(second.status).toBe(200);
    expect(second.body.forkRepoUrl).toBe("https://github.com/ada/bo-tool");

    const board = (await api<Board>("/api/studio/board", { as: ada })).body;
    const card = board.cards.find((c) => c.id === second.body.studioCardId)!;
    expect(card.columnId).toBe(board.columns[0]!.id);
    expect(card.project).toMatchObject({ name: "bo-tool (fork)", stage: "wip" });

    // Private until published, but lineage is already recorded.
    expect((await api(`/api/projects/${card.project!.slug}`)).status).toBe(404);
    const mine = await api<ProjectDetail>(`/api/projects/${card.project!.slug}`, { as: ada });
    expect(mine.body.forkedFrom?.slug).toBe("bo-tool");

    const notes = await api<{ items: { type: string; title: string }[] }>("/api/notifications", { as: bo });
    expect(notes.body.items[0]).toMatchObject({ type: "fork", title: "ada forked bo-tool" });

    // Pressing it again returns the same card.
    expect((await cont("bo-tool")).body.studioCardId).toBe(second.body.studioCardId);
  });

  it("refuses unlicensed projects, your own projects, and non-forks with the same name", async () => {
    expect((await cont("bo-closed")).status).toBe(403);
    expect((await cont("bo-tool", bo)).status).toBe(400);
    ghRepos["ada/bo-tool"] = null; // a repo with the same name that isn't a fork
    expect((await cont("bo-tool")).status).toBe(409);
  });
});

describe("comments", () => {
  const comment = (body: string, parentId: string | null = null, as = ada) =>
    api<Comment>("/api/projects/bo-tool/comments", { method: "POST", as, body: JSON.stringify({ body, parentId, turnstileToken: "t" }) });

  it("posts, counts, replies and notifies the author, the parent commenter and mentions", async () => {
    const cy = await seedUser("usr_cy", "cy");
    const top = await comment("Love this, @cy should see it");
    expect(top.status).toBe(200);
    const reply = await comment("Thanks!", top.body.id, bo);
    expect(reply.body.parentId).toBe(top.body.id);

    const list = await api<{ items: Comment[] }>("/api/projects/bo-tool/comments");
    expect(list.body.items.map((c) => c.body)).toEqual(["Love this, @cy should see it", "Thanks!"]);
    expect((await api<ProjectDetail>("/api/projects/bo-tool")).body.commentCount).toBe(2);

    const types = async (as: string) => (await api<{ items: { type: string }[] }>("/api/notifications", { as })).body.items.map((n) => n.type);
    expect(await types(bo)).toEqual(["comment"]);
    expect(await types(cy)).toEqual(["mention"]);
    expect(await types(ada)).toEqual(["comment"]); // bo replied to ada
  });

  it("rejects replies to comments on other projects", async () => {
    await seedProject({ slug: "other", owner: "usr_bo" });
    const elsewhere = await api<Comment>("/api/projects/other/comments", { method: "POST", as: ada, body: JSON.stringify({ body: "hi", parentId: null, turnstileToken: "t" }) });
    expect((await comment("reply", elsewhere.body.id)).status).toBe(400);
  });
});
