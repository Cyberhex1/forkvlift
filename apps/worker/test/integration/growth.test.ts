import { beforeEach, describe, expect, it } from "vitest";
import { routes, type AlternativeProduct, type ProjectCard } from "@forkvlift/shared";
import { api, env, resetDb, seedCategory, seedProject } from "./helpers";

beforeEach(async () => { await resetDb(); await seedCategory("tools"); });

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
