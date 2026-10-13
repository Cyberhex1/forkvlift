import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminStats, Candidate, ProjectDetail } from "@forkvlift/shared";
import { INTEREST_TOPICS, MAX_NEW_PER_RUN, extractRepoLinks, interestCandidates, interestTopicsFor, onlyNew, searchCandidates, watchlistCandidates } from "../../src/core/curation/discovery";
import { fakeGithub } from "./github-fake";
import { api, env, resetDb, seedCategory, seedUser } from "./helpers";

let admin = "";
let ada = "";

beforeEach(async () => {
  await resetDb();
  await env.DB.batch([env.DB.prepare(`DELETE FROM candidates`), env.DB.prepare(`DELETE FROM audit_log`)]);
  await env.CACHE.list().then((l) => Promise.all(l.keys.map((k) => env.CACHE.delete(k.name))));
  await seedCategory("tools");
  admin = await seedUser("usr_boss", "boss", { role: "admin" });
  ada = await seedUser("usr_ada", "ada");
  fakeGithub({
    "ada/neat": { owner: "ada", homepage: "https://neat.dev", stars: 300 },
    "zed/nolicense": { owner: "zed", license: null },
    "old/archived": { owner: "old", archived: true },
  });
});
afterEach(() => vi.unstubAllGlobals());

const asAdmin = (path: string, method = "GET", body?: unknown) => api<never>(path, { method, as: admin, body: body ? JSON.stringify(body) : undefined });
const importRepo = async (repoUrl: string, foundViaUrl: string | null = null) =>
  (await api<Candidate>("/api/admin/candidates", { method: "POST", as: admin, body: JSON.stringify({ repoUrl, foundViaUrl }) })).body;
const decide = (id: string, body: object) =>
  api<Candidate>(`/api/admin/candidates/${id}/decision`, { method: "POST", as: admin, body: JSON.stringify({ reason: null, snoozeDays: null, edits: null, ...body }) });

describe("admin auth", () => {
  it("rejects non-admins", async () => {
    expect((await api("/api/admin/candidates")).status).toBe(403);
    expect((await api("/api/admin/candidates", { as: ada })).status).toBe(403);
  });
});

describe("paste-a-link importer and review queue", () => {
  it("imports with checks, score and a Reddit found-via credit", async () => {
    const c = await importRepo("https://github.com/ada/neat", "https://www.reddit.com/r/vibecoding/comments/abc/neat/");
    expect(c).toMatchObject({ repoFullName: "ada/neat", status: "pending", hasDemo: true, foundVia: { kind: "reddit_link" } });
    expect(c.checks.find((k) => k.key === "license")?.pass).toBe(true);
    expect(c.score).toBeGreaterThan(40);
  });

  it("lists unlicensed candidates with a failing license chip but never approves them", async () => {
    const c = await importRepo("https://github.com/zed/nolicense");
    expect(c.checks.find((k) => k.key === "license")).toMatchObject({ pass: false, detail: "No license (can't be approved)" });
    const res = await decide(c.id, { action: "approve_publish", edits: { categorySlug: "tools" } });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain("Unlicensed repos can't be curated");
    expect((await api("/api/projects/nolicense")).status).toBe(404);
    const queue = await api<{ items: Candidate[] }>("/api/admin/candidates", { as: admin });
    expect(queue.body.items.map((x) => x.repoFullName)).toContain("zed/nolicense");
  });

  it("scores archived repos low", async () => {
    const good = await importRepo("https://github.com/ada/neat");
    const bad = await importRepo("https://github.com/old/archived");
    expect(bad.score).toBeLessThan(good.score);
    const queue = await api<{ items: Candidate[] }>("/api/admin/candidates?sort=score", { as: admin });
    expect(queue.body.items[0]?.id).toBe(good.id);
  });

  it("requires a category to approve, then publishes a curated card", async () => {
    const c = await importRepo("https://github.com/ada/neat");
    expect((await decide(c.id, { action: "approve_publish" })).status).toBe(400);
    const res = await decide(c.id, { action: "approve_publish", edits: { categorySlug: "tools", name: "Neat Tool", tagline: "Fresh tagline" } });
    expect(res.body).toMatchObject({ status: "published", project: { slug: "neat-tool" } });
    const project = await api<ProjectDetail>("/api/projects/neat-tool");
    expect(project.body).toMatchObject({ source: "curated", claimed: false, author: null, tagline: "Fresh tagline" });
  });

  it("approves as draft without publishing", async () => {
    const c = await importRepo("https://github.com/ada/neat");
    await decide(c.id, { action: "approve_draft", edits: { categorySlug: "tools" } });
    expect((await api("/api/projects/neat")).status).toBe(404);
  });

  it("rejects for good and snoozes for a while", async () => {
    const a = await importRepo("https://github.com/ada/neat");
    const b = await importRepo("https://github.com/zed/nolicense");
    expect((await decide(a.id, { action: "reject", reason: "Not vibe-coded" })).body).toMatchObject({ status: "rejected", rejectReason: "Not vibe-coded" });
    expect((await decide(b.id, { action: "snooze", snoozeDays: 3 })).body.status).toBe("snoozed");
    const pending = await api<{ items: Candidate[] }>("/api/admin/candidates", { as: admin });
    expect(pending.body.items).toHaveLength(0);
    // Rejected repos are never suggested again by discovery.
    expect(await onlyNew(env.DB, [{ fullName: "ada/neat", foundVia: { kind: "github_search", url: null } }])).toHaveLength(0);
  });

  it("bulk-rejects", async () => {
    const a = await importRepo("https://github.com/ada/neat");
    const b = await importRepo("https://github.com/zed/nolicense");
    const res = await api<{ updated: number }>("/api/admin/candidates/bulk", { method: "POST", as: admin, body: JSON.stringify({ ids: [a.id, b.id], action: "reject", reason: "spam" }) });
    expect(res.body.updated).toBe(2);
  });

  it("writes every action to the audit log", async () => {
    const c = await importRepo("https://github.com/ada/neat");
    await decide(c.id, { action: "reject", reason: "dup" });
    const log = await api<{ items: { action: string; actor: { username: string } | null }[] }>("/api/admin/audit-log", { as: admin });
    expect(log.body.items.map((e) => e.action)).toEqual(["candidate.reject", "candidate.import"]);
    expect(log.body.items[0]?.actor?.username).toBe("boss");
  });

  it("reports stats", async () => {
    await importRepo("https://github.com/ada/neat");
    const stats = (await asAdmin("/api/admin/stats")).body as AdminStats;
    expect(stats.queue.pending).toBe(1);
    expect(stats.signups.total).toBe(2);
  });
});

describe("claiming curated projects", () => {
  it("lets the GitHub owner claim and nobody else", async () => {
    const c = await importRepo("https://github.com/ada/neat");
    await decide(c.id, { action: "approve_publish", edits: { categorySlug: "tools" } });
    const zed = await seedUser("usr_zed", "zed");
    expect((await api("/api/projects/neat/claim", { method: "POST", as: zed })).status).toBe(403);
    const claimed = await api<ProjectDetail>("/api/projects/neat/claim", { method: "POST", as: ada });
    expect(claimed.body).toMatchObject({ claimed: true, verifiedAuthor: true, author: { username: "ada" } });
    expect((await api("/api/projects/neat/claim", { method: "POST", as: ada })).status).toBe(409);
  });
});

describe("categories and staff picks", () => {
  it("creates, merges and features", async () => {
    await asAdmin("/api/admin/categories/games", "PUT", { name: "Games", parentSlug: null, iconKey: null, description: null, status: "active", mergeInto: null });
    const c = await importRepo("https://github.com/ada/neat");
    await decide(c.id, { action: "approve_publish", edits: { categorySlug: "games" } });
    await asAdmin("/api/admin/categories/games", "PUT", { name: "Games", parentSlug: null, iconKey: null, description: null, status: "active", mergeInto: "tools" });
    expect((await api<ProjectDetail>("/api/projects/neat")).body.category.slug).toBe("tools");
    expect((await asAdmin("/api/admin/projects/neat/staff-pick", "POST", { staffPick: true, featuredSlot: 1 })).status).toBe(200);
    expect((await api<{ items: { slug: string }[] }>("/api/projects?sort=staff_picks")).body.items.map((p) => p.slug)).toEqual(["neat"]);
  });
});

describe("discovery", () => {
  it("finds topic search results and awesome-list links, skipping known repos", async () => {
    fakeGithub({ "ada/neat": { owner: "ada" } }, { search: ["ada/neat", "new/one"], awesomeReadme: "- [x](https://github.com/new/two) and [dup](https://github.com/new/one)" });
    const found = [...(await searchCandidates(env)), ...(await watchlistCandidates(env))];
    expect(found.map((f) => f.fullName)).toEqual(expect.arrayContaining(["new/one", "new/two"]));
    await importRepo("https://github.com/ada/neat");
    const fresh = await onlyNew(env.DB, found);
    expect(fresh.map((f) => f.fullName)).not.toContain("ada/neat");
  });

  it("skips unlicensed search results, which can't be curated, and AI-coding tooling", async () => {
    fakeGithub({}, { search: ["new/one", "new/nolicense", "new/mcp-thing"], unlicensed: ["new/nolicense"], tooling: ["new/mcp-thing"] });
    expect((await searchCandidates(env)).map((f) => f.fullName)).toEqual(["new/one"]);
  });

  it("searches a rotating slice of interest topics by recent activity and stars", async () => {
    const queries: string[] = [];
    fakeGithub({}, { search: ["gimp-ish/editor"], queries });
    const found = await interestCandidates(env, 0);
    expect(found.map((f) => f.fullName)).toEqual(["gimp-ish/editor"]);
    expect(queries).toHaveLength(4);
    expect(queries.every((q) => q.includes("pushed:>") && q.includes("stars:>=25") && q.endsWith("sort:stars"))).toBe(true);
    const day = Array.from({ length: 8 }, (_, i) => interestTopicsFor(i * 6 * 3_600_000)).flat();
    expect(new Set(day)).toEqual(new Set(INTEREST_TOPICS));
  });

  it("checks known repos in chunks, drops duplicates and caps each run", async () => {
    await importRepo("https://github.com/ada/neat");
    const many = [{ fullName: "Ada/Neat" }, { fullName: "x/dup" }, { fullName: "X/DUP" }, ...Array.from({ length: 120 }, (_, i) => ({ fullName: `bulk/r${i}` }))].map((d) => ({
      ...d,
      foundVia: { kind: "github_search" as const, url: null },
    }));
    const fresh = await onlyNew(env.DB, many);
    expect(fresh).toHaveLength(MAX_NEW_PER_RUN);
    expect(fresh.map((f) => f.fullName.toLowerCase())).not.toContain("ada/neat");
    expect(fresh.filter((f) => f.fullName.toLowerCase() === "x/dup")).toHaveLength(1);
  });

  it("extracts repo links from Markdown", () => {
    expect(extractRepoLinks("see https://github.com/a/b, https://github.com/a/b/tree/x and https://gitlab.com/c/d")).toEqual(["a/b"]);
  });
});
