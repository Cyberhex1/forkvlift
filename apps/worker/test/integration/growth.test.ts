import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routes, type AlternativeProduct, type BuildRequest, type ProjectCard } from "@forkvlift/shared";
import { api, env, resetDb, seedCategory, seedProject, seedUser } from "./helpers";

beforeEach(async () => { await resetDb(); await seedCategory("tools"); });
afterEach(() => vi.unstubAllGlobals());

describe("alternatives", () => {
  it("derives names from replaces, normalizes slugs and counts distinct licensed projects", async () => {
    await seedProject({ slug: "one", replaces: ["Notion", "Notion", "Adobe Photoshop", "中文"] });
    await seedProject({ slug: "two", replaces: ["notion", "Adobe  Photoshop"] });
    await seedProject({ slug: "unlicensed", replaces: ["Notion", "Only unlicensed"], license: null });
    const response = await api<{ items: AlternativeProduct[] }>("/api/alternatives");
    expect(response.status).toBe(200);
    expect(routes.listAlternatives.response.safeParse(response.body).success).toBe(true);
    expect(response.body.items.find(p => p.slug === "notion")).toMatchObject({ projectCount: 2, monthlyPriceUsd: null });
    expect(response.body.items.find(p => p.slug === "adobe-photoshop")?.projectCount).toBe(2);
    expect(response.body.items.some(p => p.name === "Only unlicensed")).toBe(false);
    const nonLatin = response.body.items.find(p => p.name === "中文")!;
    expect((await api(`/api/alternatives/${nonLatin.slug}`)).status).toBe(200);
  });
  it("honors opt-in, includes WIP, and excludes private, unpublished, deleted and hidden projects", async () => {
    const wip = await seedProject({ slug: "wip", replaces: ["Notion"], stage: "wip" });
    const unlicensed = await seedProject({ slug: "unlicensed", replaces: ["Notion"], license: null });
    await seedProject({ slug: "private", replaces: ["Notion"], isPublic: false });
    for (const column of ["hidden_at", "deleted_at", "published_at"]) {
      const id = await seedProject({ slug: column, replaces: ["Notion"] });
      await env.DB.prepare(`UPDATE projects SET ${column} = ? WHERE id = ?`).bind(column === "published_at" ? null : Date.now(), id).run();
    }
    const response = await api<{ items: ProjectCard[]; hiddenUnlicensedCount: number; product: AlternativeProduct }>("/api/alternatives/notion");
    expect(routes.getAlternatives.response.safeParse(response.body).success).toBe(true);
    expect(response.body.items.map(p => p.id)).toEqual([wip]);
    expect(response.body.items[0]?.stage).toBe("wip");
    expect(response.body.hiddenUnlicensedCount).toBe(1);
    expect(response.body.product.projectCount).toBe(1);
    const shown = await api<typeof response.body>("/api/alternatives/notion?showUnlicensed=true");
    expect(shown.body.items.map(p => p.id)).toEqual(expect.arrayContaining([wip, unlicensed]));
    expect(shown.body.product.projectCount).toBe(2);
    expect(shown.body.hiddenUnlicensedCount).toBe(0);
    expect((await api<typeof response.body>("/api/alternatives/notion?showUnlicensed=false")).body.items).toHaveLength(1);
  });
  it("handles empty data, missing names and invalid URLs without inventing products", async () => {
    expect((await api<{ items: AlternativeProduct[] }>("/api/alternatives")).body.items).toEqual([]);
    expect((await api("/api/alternatives/missing")).status).toBe(404);
    expect((await api("/api/alternatives/INVALID")).status).toBe(400);
    await seedProject({ slug: "empty", replaces: ["", "   "] });
    expect((await api<{ items: AlternativeProduct[] }>("/api/alternatives")).body.items).toEqual([]);
  });
});

describe("requests", () => {
  let ada = "", bo = "", cy = "";
  beforeEach(async () => {
    ada = await seedUser("usr_ada", "ada"); bo = await seedUser("usr_bo", "bo"); cy = await seedUser("usr_cy", "cy");
    vi.stubGlobal("fetch", async () => Response.json({ success: true }));
  });
  const create = (as = ada, extra: Record<string, unknown> = {}) => api<BuildRequest>("/api/requests", { method: "POST", as,
    body: JSON.stringify({ title: "Free design tool", bodyMd: "What it should do\n\n## Bounty\nThanks and a donation arranged off-site.", replaces: "Figma", turnstileToken: "test", ...extra }) });
  const claim = (id: string, as = bo) => api<BuildRequest>(`/api/requests/${id}/claim`, { method: "POST", as });

  it("creates requests with text bounties and reads them through the shared contract", async () => {
    const result = await create(ada, { title: "  Free design tool  ", replaces: "  Figma  " });
    expect(result.status).toBe(200);
    expect(routes.createRequest.response.safeParse(result.body).success).toBe(true);
    expect(result.body).toMatchObject({ title: "Free design tool", status: "open", replaces: "Figma", claimedBy: null, builtProject: null, upvotes: 0 });
    expect(result.body.bodyMd).toContain("Bounty");
    const detail = await api<BuildRequest>(`/api/requests/${result.body.id}`);
    expect(detail.body).toEqual(result.body);
    expect(routes.getRequest.response.safeParse(detail.body).success).toBe(true);
  });
  it("requires authentication and validates title and Turnstile before insertion", async () => {
    expect((await create("")).status).toBe(401);
    expect((await create(ada, { title: "   " })).status).toBe(400);
    expect((await create(ada, { title: "x" })).status).toBe(400);
    vi.stubGlobal("fetch", async () => Response.json({ success: false }));
    const failure = await create();
    expect(failure.status).toBe(403);
    expect(failure.body).toMatchObject({ error: { code: "turnstile_failed" } });
    expect((await env.DB.prepare("SELECT count(*) AS n FROM build_requests").first<{ n: number }>())?.n).toBe(0);
  });
  it("filters and paginates stably, rejects malformed cursors and handles empty/missing", async () => {
    expect((await api<{ items: BuildRequest[] }>("/api/requests")).body.items).toEqual([]);
    expect((await api("/api/requests/missing")).status).toBe(404);
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push((await create(ada, { title: `Design request ${i}` })).body.id);
    await claim(ids[0]!);
    const first = await api<{ items: BuildRequest[]; nextCursor: string }>("/api/requests?status=open&limit=1");
    const second = await api<{ items: BuildRequest[]; nextCursor: string | null }>(`/api/requests?status=open&limit=1&cursor=${first.body.nextCursor}`);
    expect(routes.listRequests.response.safeParse(first.body).success).toBe(true);
    expect(new Set([...first.body.items, ...second.body.items].map(r => r.id)).size).toBe(2);
    expect(second.body.nextCursor).toBeNull();
    expect((await api<{ items: BuildRequest[] }>("/api/requests?status=claimed")).body.items).toHaveLength(1);
    expect((await api("/api/requests?status=invalid")).status).toBe(400);
    expect((await api("/api/requests?cursor=bad-cursor")).status).toBe(400);
  });
  it("allows one winner under concurrent claims and idempotent replay", async () => {
    const id = (await create()).body.id;
    const results = await Promise.all([claim(id, bo), claim(id, cy)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    const winner = results.find(r => r.status === 200)!.body;
    expect(routes.claimRequest.response.safeParse(winner).success).toBe(true);
    expect((await claim(id, winner.claimedBy!.id === "usr_bo" ? bo : cy)).status).toBe(200);
    expect((await api<BuildRequest>(`/api/requests/${id}`)).body.claimedBy?.id).toBe(winner.claimedBy!.id);
  });
  it("rejects anonymous, self, blocked, missing and built claims", async () => {
    const id = (await create()).body.id;
    expect((await claim(id, "")).status).toBe(401);
    expect((await claim(id, ada)).status).toBe(400);
    expect((await claim("missing")).status).toBe(404);
    await env.DB.prepare("INSERT INTO blocks (blocker_id, blocked_id, kind) VALUES (?, ?, 'block')").bind("usr_ada", "usr_bo").run();
    expect((await claim(id)).status).toBe(403);
    await env.DB.prepare("UPDATE build_requests SET status = 'built' WHERE id = ?").bind(id).run();
    expect((await claim(id, cy)).status).toBe(409);
  });
  it("omits deleted authors and inaccessible completed project links", async () => {
    const id = (await create()).body.id;
    const project = await seedProject({ slug: "completed", license: null });
    await env.DB.prepare("UPDATE build_requests SET status = 'built', built_project_id = ? WHERE id = ?").bind(project, id).run();
    expect((await api<BuildRequest>(`/api/requests/${id}`)).body.builtProject).toBeNull();
    await env.DB.prepare("UPDATE projects SET license_spdx = 'MIT' WHERE id = ?").bind(project).run();
    const shown = await api<BuildRequest>(`/api/requests/${id}`);
    expect(shown.body.builtProject?.id).toBe(project);
    expect(routes.getRequest.response.safeParse(shown.body).success).toBe(true);
    await env.DB.prepare("UPDATE projects SET is_public = 0 WHERE id = ?").bind(project).run();
    expect((await api<BuildRequest>(`/api/requests/${id}`)).body.builtProject).toBeNull();
    await env.DB.prepare("UPDATE users SET deleted_at = ? WHERE id = 'usr_ada'").bind(Date.now()).run();
    expect((await api(`/api/requests/${id}`)).status).toBe(404);
    expect((await api<{ items: BuildRequest[] }>("/api/requests")).body.items).toEqual([]);
  });
});
