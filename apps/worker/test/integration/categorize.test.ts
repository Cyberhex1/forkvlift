import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Candidate } from "@forkvlift/shared";
import { fakeGithub } from "./github-fake";
import { api, env, resetDb, seedCategory, seedUser } from "./helpers";

let admin = "";
beforeEach(async () => {
  await resetDb();
  await env.DB.prepare(`DELETE FROM candidates`).run();
  await seedCategory("games");
  await seedCategory("roguelikes", "games");
  await seedCategory("finance-and-money");
  admin = await seedUser("usr_boss", "boss", { role: "admin" });
});
afterEach(() => vi.unstubAllGlobals());

const asAdmin = <T>(path: string, method = "GET", body?: unknown) => api<T>(path, { method, as: admin, body: body ? JSON.stringify(body) : undefined });

describe("category suggestions", () => {
  it("fills in a category for newly imported repos", async () => {
    fakeGithub({ "ada/dungeon": { owner: "ada", topics: ["game", "roguelike"] } });
    const c = await asAdmin<Candidate>("/api/admin/candidates", "POST", { repoUrl: "https://github.com/ada/dungeon", foundViaUrl: null });
    expect(c.status).toBe(200);
    expect(c.body.proposed.categorySlug).toBe("roguelikes");
  });

  it("backfills queued candidates that have none, and leaves unknowns alone", async () => {
    fakeGithub({ "ada/budget": { owner: "ada", topics: ["budgeting", "personal-finance"] }, "ada/mystery": { owner: "ada" } });
    for (const name of ["budget", "mystery"]) await asAdmin("/api/admin/candidates", "POST", { repoUrl: `https://github.com/ada/${name}`, foundViaUrl: null });
    await env.DB.prepare(`UPDATE candidates SET proposed = json_set(proposed, '$.categorySlug', NULL)`).run();

    const res = await asAdmin<{ updated: number }>("/api/admin/candidates/categorize", "POST");
    expect(res.body.updated).toBe(1);
    const rows = await env.DB.prepare(`SELECT repo_full_name AS r, json_extract(proposed, '$.categorySlug') AS cat FROM candidates ORDER BY r`).all<{ r: string; cat: string | null }>();
    expect(rows.results).toEqual([
      { r: "ada/budget", cat: "finance-and-money" },
      { r: "ada/mystery", cat: null },
    ]);
  });

  it("is admin-only", async () => {
    const user = await seedUser("usr_ada", "ada");
    expect((await api("/api/admin/candidates/categorize", { method: "POST", as: user })).status).toBe(403);
  });
});
