import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectDetail, ShowcaseCard, ShowcaseDetail } from "@forkvlift/shared";
import { fakeGithub } from "./github-fake";
import { api, env, resetDb, seedCategory, seedProject, seedUser } from "./helpers";

let ada = "";
let bo = "";
let cy = "";
beforeEach(async () => {
  await resetDb();
  await seedCategory("tools");
  await seedCategory("games");
  ada = await seedUser("usr_ada", "ada");
  bo = await seedUser("usr_bo", "bo");
  cy = await seedUser("usr_cy", "cy");
  fakeGithub({ "ada/neon-src": { owner: "ada" }, "ada/closed-src": { owner: "ada", license: null }, "bo/neon-src": { owner: "bo" } });
});
afterEach(() => vi.unstubAllGlobals());

const call = <T>(path: string, method: string, as: string | undefined, body?: unknown) => api<T>(path, { method, as, body: body === undefined ? undefined : JSON.stringify(body) });
const input = (over: Record<string, unknown> = {}) => ({
  title: "Neon Drift", tagline: "An arcade racer made in a weekend", bodyMd: "Drive **fast** through a neon city.", buildStoryMd: "Claude wrote the physics.",
  categorySlug: "games", kind: "game", stage: "finished", coverKey: null, media: [],
  links: [{ kind: "live", label: "Play", url: "https://neon.example.com" }],
  repoUrl: null, aiTools: ["Claude-Code", "my own scripts"], buildTime: "a weekend", tags: ["racing"], publish: true, turnstileToken: "t", ...over,
});

async function seedResource(slug: string) {
  await env.DB.prepare(`INSERT INTO resources (id, slug, type, title, author_id) VALUES (?, ?, 'skill', ?, 'usr_bo')`).bind(`res_${slug}`, slug, slug).run();
}

describe("showcase ↔ catalog links (5.3)", () => {
  it("credits catalog projects and resources, and lists the showcase under 'Used in these showcases'", async () => {
    await seedProject({ slug: "physics-kit", owner: "usr_bo" });
    await seedProject({ slug: "secret-kit", owner: "usr_bo", isPublic: false });
    await seedResource("racing-prompt");

    expect((await call("/api/showcases", "POST", ada, input({ builtWith: { projects: ["secret-kit"], resources: [] } }))).status).toBe(400);
    const res = await call<ShowcaseDetail>("/api/showcases", "POST", ada, input({ builtWith: { projects: ["physics-kit"], resources: ["racing-prompt"] } }));
    expect(res.status).toBe(200);
    expect(res.body.builtWith).toEqual({
      projects: [expect.objectContaining({ slug: "physics-kit" })],
      resources: [expect.objectContaining({ slug: "racing-prompt", title: "racing-prompt" })],
    });

    expect((await api<{ items: ShowcaseCard[] }>("/api/projects/physics-kit/showcases")).body.items.map((s) => s.slug)).toEqual(["neon-drift"]);
    expect((await api<{ items: ShowcaseCard[] }>("/api/resources/racing-prompt/showcases")).body.items.map((s) => s.slug)).toEqual(["neon-drift"]);

    // Leaving builtWith out of an edit keeps the credits; an empty list clears them.
    await call("/api/showcases/neon-drift", "PATCH", ada, { tagline: "Still fast" });
    expect((await api<ShowcaseDetail>("/api/showcases/neon-drift")).body.builtWith.projects).toHaveLength(1);
    await call("/api/showcases/neon-drift", "PATCH", ada, { builtWith: { projects: [], resources: [] } });
    expect((await api<{ items: ShowcaseCard[] }>("/api/projects/physics-kit/showcases")).body.items).toHaveLength(0);

    // Drafts never show up as credits.
    await call("/api/showcases", "POST", ada, input({ title: "Draft Racer", publish: false, builtWith: { projects: ["physics-kit"], resources: [] } }));
    expect((await api<{ items: ShowcaseCard[] }>("/api/projects/physics-kit/showcases")).body.items).toHaveLength(0);
  });

  it("lists a showcase with a public, licensed repo in the catalog, linked both ways", async () => {
    await call("/api/showcases", "POST", ada, input({ repoUrl: "https://github.com/ada/neon-src" }));
    await call("/api/showcases/neon-drift/vote", "POST", bo, { value: 1 });

    expect((await call("/api/showcases/neon-drift/catalog", "POST", bo, { repoUrl: null, turnstileToken: "t" })).status).toBe(404);
    const res = await call<{ showcase: ShowcaseDetail; project: { slug: string }; carriedOver: { upvotes: number; comments: number } }>(
      "/api/showcases/neon-drift/catalog", "POST", ada, { repoUrl: null, turnstileToken: "t" },
    );
    expect(res.status).toBe(200);
    // The code was already public, so nothing carries over.
    expect(res.body.carriedOver).toEqual({ upvotes: 0, comments: 0 });
    expect(res.body.showcase).toMatchObject({ hasPublicCode: true, catalogProject: { slug: res.body.project.slug } });

    const project = (await api<ProjectDetail>(`/api/projects/${res.body.project.slug}`)).body;
    expect(project).toMatchObject({ name: "Neon Drift", tagline: "An arcade racer made in a weekend", liveUrl: "https://neon.example.com" });
    expect(project.buildFacts.aiTools).toEqual(["claude-code"]);
    expect(project.description).toBe("Drive fast through a neon city.");

    expect((await call("/api/showcases/neon-drift/catalog", "POST", ada, { repoUrl: null, turnstileToken: "t" })).status).toBe(409);
  });

  it("refuses repos without a license or that the maker doesn't own", async () => {
    await call("/api/showcases", "POST", ada, input());
    const unlicensed = await call<{ error: { message: string } }>("/api/showcases/neon-drift/catalog", "POST", ada, { repoUrl: "https://github.com/ada/closed-src", turnstileToken: "t" });
    expect(unlicensed.status).toBe(400);
    expect((await call("/api/showcases/neon-drift/catalog", "POST", ada, { repoUrl: "https://github.com/bo/neon-src", turnstileToken: "t" })).status).toBe(403);
    expect((await call("/api/showcases/neon-drift/catalog", "POST", ada, { repoUrl: null, turnstileToken: "t" })).status).toBe(400);
  });

  it("open-sourcing a closed showcase carries its upvotes and comment threads over", async () => {
    await call("/api/showcases", "POST", ada, input());
    await call("/api/showcases/neon-drift/vote", "POST", bo, { value: 1 });
    await call("/api/showcases/neon-drift/vote", "POST", cy, { value: 1 });
    const parent = (await call<{ id: string }>("/api/showcases/neon-drift/comments", "POST", bo, { body: "Love it", parentId: null, turnstileToken: "t" })).body;
    await call("/api/showcases/neon-drift/comments", "POST", ada, { body: "Thanks!", parentId: parent.id, turnstileToken: "t" });
    const gone = (await call<{ id: string }>("/api/showcases/neon-drift/comments", "POST", cy, { body: "oops", parentId: null, turnstileToken: "t" })).body;
    await call(`/api/showcases/neon-drift/comments/${gone.id}`, "DELETE", cy);

    const res = await call<{ project: { slug: string; id: string }; carriedOver: { upvotes: number; comments: number } }>(
      "/api/showcases/neon-drift/catalog", "POST", ada, { repoUrl: "https://github.com/ada/neon-src", turnstileToken: "t" },
    );
    expect(res.status).toBe(200);
    expect(res.body.carriedOver).toEqual({ upvotes: 2, comments: 2 });

    const { results } = await env.DB.prepare(`SELECT id, parent_id, body FROM comments WHERE project_id = ? ORDER BY created_at, body`).bind(res.body.project.id).all<{ id: string; parent_id: string | null; body: string }>();
    expect(results.map((c) => c.body)).toEqual(["Love it", "Thanks!"]);
    expect(results[1]!.parent_id).toBe(results[0]!.id);

    const showcase = (await api<ShowcaseDetail>("/api/showcases/neon-drift")).body;
    expect(showcase).toMatchObject({ status: "published", hasPublicCode: true, repoUrl: "https://github.com/ada/neon-src", catalogProject: { slug: res.body.project.slug } });
  });
});
