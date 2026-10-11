import { beforeEach, describe, expect, it } from "vitest";
import type { ShowcaseCard } from "@forkvlift/shared";
import { syncVectors } from "../../src/core/projects/semantic";
import { SHOWCASE_NAMESPACE, findSimilarShowcases, searchShowcases, syncShowcaseVectors } from "../../src/core/showcase-search";
import { api, env, resetDb, seedCategory, seedProject, seedUser } from "./helpers";

/** Bag-of-words "embedding": good enough to rank by shared words. */
function fakeVector(text: string): number[] {
  const v = new Array(768).fill(0);
  for (const w of text.toLowerCase().match(/[a-z]+/g) ?? []) {
    let h = 0;
    for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    v[h % 768] += 1;
  }
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

function fakes() {
  const store = new Map<string, { values: number[]; namespace: string }>();
  const calls = { embedded: 0 };
  const AI = {
    run: async (_model: string, input: { text: string[] }) => {
      calls.embedded += input.text.length;
      return { data: input.text.map(fakeVector) };
    },
  };
  const VECTORS = {
    upsert: async (vs: { id: string; values: number[]; namespace?: string }[]) => {
      for (const v of vs) store.set(v.id, { values: v.values, namespace: v.namespace ?? "" });
      return {};
    },
    deleteByIds: async (ids: string[]) => {
      for (const id of ids) store.delete(id);
      return {};
    },
    query: async (vector: number[], opts: { topK: number; namespace?: string }) => ({
      matches: [...store.entries()]
        .filter(([, v]) => opts.namespace === undefined || v.namespace === opts.namespace)
        .map(([id, v]) => ({ id, score: v.values.reduce((s, x, i) => s + x * vector[i]!, 0) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, opts.topK),
    }),
  };
  return { e: { ...env, AI, VECTORS } as unknown as Env, store, calls };
}

let n = 0;
async function seedShowcase(slug: string, o: { title?: string; tagline: string; kind?: string; owner?: string; published?: boolean; upvotes?: number }) {
  const id = `show_t${++n}`;
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO showcases (id, slug, owner_id, title, tagline, body_md, build_story_md, category_slug, kind, stage, ai_tools, tags, upvotes, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '', '', 'tools', ?, 'finished', '["claude-code"]', '[]', ?, ?, ?, ?)`,
  )
    .bind(id, slug, o.owner ?? "usr_ada", o.title ?? slug, o.tagline, o.kind ?? "web", o.upvotes ?? 0, o.published === false ? null : now - 3_600_000 + n, now, now)
    .run();
  return id;
}

beforeEach(async () => {
  await resetDb();
  await seedCategory("tools");
  await seedUser("usr_ada", "ada");
  await seedShowcase("pocket-budget-app", { tagline: "Budget tracker for monthly expenses and savings goals", kind: "mobile" });
  await seedShowcase("pixel-quest", { tagline: "Pixel art adventure game in the browser", kind: "game" });
  await seedShowcase("draft-budget", { tagline: "Monthly budget expenses tracker", published: false });
});

describe("showcase semantic search (5.2)", () => {
  it("embeds published showcases in their own namespace, re-embeds only on text changes, drops hidden ones", async () => {
    const { e, store, calls } = fakes();
    expect(await syncShowcaseVectors(e)).toEqual({ upserted: 2, removed: 0 });
    expect([...store.values()].every((v) => v.namespace === SHOWCASE_NAMESPACE)).toBe(true);

    await env.DB.prepare(`UPDATE showcases SET updated_at = ?`).bind(Date.now() + 1000).run();
    const before = calls.embedded;
    expect(await syncShowcaseVectors(e)).toEqual({ upserted: 0, removed: 0 });
    expect(calls.embedded).toBe(before);

    await env.DB.prepare(`UPDATE showcases SET tagline = 'Pixel art roguelike', updated_at = ? WHERE slug = 'pixel-quest'`).bind(Date.now() + 2000).run();
    expect((await syncShowcaseVectors(e)).upserted).toBe(1);

    await env.DB.prepare(`UPDATE showcases SET hidden_at = ? WHERE slug = 'pixel-quest'`).bind(Date.now()).run();
    expect((await syncShowcaseVectors(e)).removed).toBe(1);
    expect(store.size).toBe(1);
  });

  it("keeps project and showcase vectors apart", async () => {
    const { e } = fakes();
    await seedProject({ slug: "budget-lib", tagline: "Budget tracker for monthly expenses" });
    await syncVectors(e);
    await syncShowcaseVectors(e);
    const hits = await findSimilarShowcases(e, "budget tracker for monthly expenses", 5, null);
    expect(hits.map((h) => h.slug)).toEqual(["pocket-budget-app"]);
  });

  it("feed search ranks by meaning, respects filters, and never repeats across pages", async () => {
    const { e } = fakes();
    await seedShowcase("budget-buddy", { tagline: "Budget tracker for monthly expenses, with charts", kind: "web" });
    await seedShowcase("family-budget", { title: "Family budget board", tagline: "Shared budget for families", kind: "web" });
    await syncShowcaseVectors(e);

    const best = await searchShowcases(e, { q: "budget tracker for monthly expenses" }, null);
    expect(best.items.slice(0, 2).map((i) => i.slug).sort()).toEqual(["budget-buddy", "pocket-budget-app"]);
    expect(best.items.map((i) => i.slug)).not.toContain("draft-budget");

    // Meaning matches, then keyword matches, one page at a time without repeats.
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await searchShowcases(e, { q: "budget", limit: 1, cursor }, null);
      seen.push(...page.items.map((i) => i.slug));
      cursor = page.nextCursor ?? undefined;
    } while (cursor && seen.length < 10);
    expect(new Set(seen).size).toBe(seen.length);
    expect([...seen].sort()).toEqual(["budget-buddy", "family-budget", "pocket-budget-app"]);

    const meaning: string[] = [];
    cursor = undefined;
    do {
      const page = await searchShowcases(e, { q: "budget tracker for monthly expenses", limit: 1, cursor }, null);
      meaning.push(...page.items.map((i) => i.slug));
      cursor = page.nextCursor ?? undefined;
    } while (cursor && meaning.length < 10);
    expect(meaning.slice(0, 2).sort()).toEqual(["budget-buddy", "pocket-budget-app"]);
    expect(new Set(meaning).size).toBe(meaning.length);

    const games = await searchShowcases(e, { q: "budget tracker", kind: "game" }, null);
    expect(games.items).toHaveLength(0);

    // An explicit sort is a plain keyword search.
    const newest = await searchShowcases(e, { q: "budget", sort: "new" }, null);
    expect(newest.items.map((i) => i.slug)).toEqual(["family-budget", "budget-buddy", "pocket-budget-app"]);
  });

  it("'Has this been built?' includes showcases, by keyword when AI is off", async () => {
    await seedProject({ slug: "pixel-paint", tagline: "Pixel art drawing editor" });
    const res = await api<{ items: { slug: string }[]; showcases: ShowcaseCard[] }>("/api/search/similar?q=pixel%20art");
    expect(res.status).toBe(200);
    expect(res.body.items.map((i) => i.slug)).toEqual(["pixel-paint"]);
    expect(res.body.showcases.map((s) => s.slug)).toEqual(["pixel-quest"]);
  });
});
