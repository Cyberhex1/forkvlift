import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectDetail, SubmissionPreview } from "@forkvlift/shared";
import { api, env, resetDb, seedCategory, seedProject, seedUser } from "./helpers";

/** Fake GitHub: repos keyed by full name. */
function fakeGithub(repos: Record<string, { owner: string; ownerType?: "User" | "Organization"; license?: string | null }>, publicMembers: string[] = []) {
  vi.stubGlobal("fetch", async (input: RequestInfo) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.startsWith("https://challenges.cloudflare.com/")) return Response.json({ success: true });
    const path = new URL(url).pathname;
    const member = path.match(/^\/orgs\/([^/]+)\/public_members\/([^/]+)$/);
    if (member) return new Response(null, { status: publicMembers.includes(`${member[1]}/${member[2]}`) ? 204 : 404 });
    const m = path.match(/^\/repos\/([^/]+\/[^/]+)(\/.*)?$/);
    const repo = m && repos[m[1]!];
    if (!repo) return new Response("{}", { status: 404 });
    if (m![2] === "/readme") return new Response("<p>Readme</p>");
    if (m![2]?.startsWith("/contributors")) return Response.json([{}]);
    const [owner, name] = m![1]!.split("/");
    return Response.json({
      id: 99, full_name: m![1], name, owner: { login: owner, type: repo.ownerType ?? "User" },
      html_url: `https://github.com/${m![1]}`, clone_url: `https://github.com/${m![1]}.git`,
      description: "A repo", homepage: null, topics: [], language: "TypeScript",
      stargazers_count: 12, forks_count: 3, open_issues_count: 0, archived: false, disabled: false, fork: false,
      default_branch: "main", created_at: "2026-01-01T00:00:00Z", pushed_at: "2026-10-01T00:00:00Z", private: false,
      license: repo.license === null ? null : { spdx_id: repo.license ?? "MIT", name: "MIT License" },
    });
  });
}

const base = {
  tagline: "Short pitch",
  description: "Longer description",
  categorySlug: "tools",
  tags: ["Kanban Board", "kanban-board", "local first"],
  stage: "wip" as const,
  isPublic: true,
  liveUrl: null,
  releaseUrl: null,
  stack: ["React"],
  platforms: ["web" as const],
  difficulty: "one_click" as const,
  aiTools: ["claude-code" as const],
  buildTime: "a weekend",
  aiInvolvement: "mostly_ai" as const,
  replaces: ["Trello"],
  isTemplate: false,
  whatWorks: "Boards",
  whatsMissing: "Sync",
  lookingForHelp: null,
  thumbnailKey: null,
  mediaKeys: [],
  forkedFromSlug: null,
  turnstileToken: "test",
};

let ada = "";
beforeEach(async () => {
  await resetDb();
  await env.CACHE.list().then((l) => Promise.all(l.keys.map((k) => env.CACHE.delete(k.name))));
  await seedCategory("tools");
  ada = await seedUser("usr_ada", "ada", { githubLogin: "ada" });
  fakeGithub({ "ada/board": { owner: "ada" }, "ada/nolicense": { owner: "ada", license: null }, "bo/theirs": { owner: "bo" }, "acme/tool": { owner: "acme", ownerType: "Organization" } }, ["acme/ada"]);
});
afterEach(() => vi.unstubAllGlobals());

const post = <T>(path: string, body: unknown, as = ada) => api<T>(path, { method: "POST", as, body: JSON.stringify(body) });

describe("submit by URL", () => {
  it("previews an owned repo", async () => {
    const { status, body } = await post<SubmissionPreview>("/api/projects/preview", { repoUrl: "https://github.com/ada/board" });
    expect(status).toBe(200);
    expect(body).toMatchObject({ repoFullName: "ada/board", ownedByViewer: true, alreadyListed: null, license: { spdx: "MIT" } });
  });

  it("warns that unlicensed projects are hidden", async () => {
    const { body } = await post<SubmissionPreview>("/api/projects/preview", { repoUrl: "https://github.com/ada/nolicense" });
    expect(body.warnings.join(" ")).toMatch(/hidden from most visitors/);
  });

  it("creates a project with stage, build facts, tags and a searchable index", async () => {
    const { status, body } = await post<ProjectDetail>("/api/projects", { ...base, name: "My Board", repoUrl: "https://github.com/ada/board" });
    expect(status).toBe(200);
    expect(body).toMatchObject({
      slug: "my-board",
      stage: "wip",
      verifiedAuthor: true,
      tags: ["kanban-board", "local-first"],
      buildFacts: { aiTools: ["claude-code"], aiInvolvement: "mostly_ai" },
      thumbnailUrl: "https://opengraph.githubassets.com/1/ada/board",
    });
    expect(body.health.score).toBeGreaterThan(0);
    const found = await api<{ items: { slug: string }[] }>("/api/projects?q=trello");
    expect(found.body.items.map((p) => p.slug)).toEqual(["my-board"]);
  });

  it("accepts unlicensed repos but keeps them out of default lists", async () => {
    const { body } = await post<ProjectDetail>("/api/projects", { ...base, name: "Hidden", repoUrl: "https://github.com/ada/nolicense" });
    expect(body.license).toBeNull();
    const list = await api<{ items: unknown[]; hiddenUnlicensedCount: number }>("/api/projects");
    expect(list.body.items).toHaveLength(0);
    expect(list.body.hiddenUnlicensedCount).toBe(1);
  });

  it("allows org repos for public members only", async () => {
    expect((await post("/api/projects", { ...base, name: "Org", repoUrl: "https://github.com/acme/tool" })).status).toBe(200);
  });

  it("rejects repos the user doesn't own", async () => {
    const res = await post<{ error: { code: string } }>("/api/projects", { ...base, name: "Theirs", repoUrl: "https://github.com/bo/theirs" });
    expect(res.status).toBe(403);
  });

  it("rejects duplicates and points curated ones at claiming", async () => {
    await seedProject({ slug: "board-curated", owner: null });
    await env.DB.prepare(`UPDATE projects SET repo_full_name = 'ada/board' WHERE slug = 'board-curated'`).run();
    const res = await post<{ error: { code: string; details: { claimable: boolean } } }>("/api/projects", { ...base, name: "Again", repoUrl: "https://github.com/ada/board" });
    expect(res.status).toBe(409);
    expect(res.body.error.details.claimable).toBe(true);
  });

  it("keeps idea-only projects private", async () => {
    const { body } = await post<ProjectDetail>("/api/projects", { ...base, name: "Just an idea", repoUrl: null });
    expect((await api(`/api/projects/${body.slug}`)).status).toBe(404);
  });

  it("gives every project a unique slug", async () => {
    const a = await post<ProjectDetail>("/api/projects", { ...base, name: "Same", repoUrl: null });
    const b = await post<ProjectDetail>("/api/projects", { ...base, name: "Same", repoUrl: null });
    expect([a.body.slug, b.body.slug]).toEqual(["same", "same-2"]);
  });
});

describe("edit and delete", () => {
  it("lets the author edit and the public see changes", async () => {
    const created = await post<ProjectDetail>("/api/projects", { ...base, name: "Editable", repoUrl: "https://github.com/ada/board" });
    const res = await api<ProjectDetail>(`/api/projects/${created.body.slug}`, { method: "PATCH", as: ada, body: JSON.stringify({ stage: "finished", tags: ["done"] }) });
    expect(res.body).toMatchObject({ stage: "finished", tags: ["done"], wipStatus: null });
  });

  it("blocks other users", async () => {
    const created = await post<ProjectDetail>("/api/projects", { ...base, name: "Mine", repoUrl: "https://github.com/ada/board" });
    const bo = await seedUser("usr_bo", "bo");
    expect((await api(`/api/projects/${created.body.slug}`, { method: "PATCH", as: bo, body: JSON.stringify({ name: "Hijack" }) })).status).toBe(403);
    expect((await api(`/api/projects/${created.body.slug}`, { method: "DELETE", as: bo })).status).toBe(403);
  });

  it("soft-deletes and removes from search", async () => {
    const created = await post<ProjectDetail>("/api/projects", { ...base, name: "Gone", repoUrl: "https://github.com/ada/board" });
    expect((await api(`/api/projects/${created.body.slug}`, { method: "DELETE", as: ada })).status).toBe(200);
    expect((await api(`/api/projects/${created.body.slug}`)).status).toBe(404);
    expect((await api<{ items: unknown[] }>("/api/projects?q=gone")).body.items).toHaveLength(0);
  });
});
