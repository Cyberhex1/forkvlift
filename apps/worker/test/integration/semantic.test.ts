import { beforeEach, describe, expect, it } from "vitest";
import { findSimilar, syncVectors } from "../../src/core/projects/semantic";
import { api, env, resetDb, seedCategory, seedProject } from "./helpers";

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
  const store = new Map<string, number[]>();
  const calls = { embedded: 0 };
  const AI = {
    run: async (_model: string, input: { text: string[] }) => {
      calls.embedded += input.text.length;
      return { data: input.text.map(fakeVector) };
    },
  };
  const VECTORS = {
    upsert: async (vs: { id: string; values: number[] }[]) => {
      for (const v of vs) store.set(v.id, v.values);
      return {};
    },
    deleteByIds: async (ids: string[]) => {
      for (const id of ids) store.delete(id);
      return {};
    },
    query: async (vector: number[], opts: { topK: number }) => ({
      matches: [...store.entries()]
        .map(([id, v]) => ({ id, score: v.reduce((s, x, i) => s + x * vector[i]!, 0) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, opts.topK),
    }),
  };
  return { e: { ...env, AI, VECTORS } as unknown as Env, store, calls };
}

beforeEach(async () => {
  await resetDb();
  await seedCategory("tools");
  await seedProject({ slug: "pocket-budget", tagline: "Budget tracker for monthly expenses and savings goals" });
  await seedProject({ slug: "pixel-paint", tagline: "Pixel art drawing editor in the browser" });
  await seedProject({ slug: "secret-notes", tagline: "Budget expenses notes", license: null });
  await seedProject({ slug: "hidden-budget", tagline: "Monthly budget expenses tracker", isPublic: false });
});

describe("semantic search", () => {
  it("embeds listed projects once, re-embeds only when the text changes, and drops unlisted ones", async () => {
    const { e, store, calls } = fakes();
    expect(await syncVectors(e)).toEqual({ upserted: 3, removed: 0 });
    expect([...store.keys()]).toHaveLength(3); // the private project is skipped

    // A stats-style touch (same text) costs no embedding.
    await env.DB.prepare(`UPDATE projects SET updated_at = ? `).bind(Date.now() + 1000).run();
    const before = calls.embedded;
    expect(await syncVectors(e)).toEqual({ upserted: 0, removed: 0 });
    expect(calls.embedded).toBe(before);

    // Hiding a project removes its vector.
    await env.DB.prepare(`UPDATE projects SET hidden_at = ? WHERE slug = 'pixel-paint'`).bind(Date.now()).run();
    expect((await syncVectors(e)).removed).toBe(1);
    expect(store.size).toBe(2);
  });

  it("ranks by meaning and hides unlicensed projects unless the viewer opted in", async () => {
    const { e } = fakes();
    await syncVectors(e);
    const hits = await findSimilar(e, "budget tracker for monthly expenses", 5, null);
    expect(hits[0]!.slug).toBe("pocket-budget");
    expect(hits.map((h) => h.slug)).not.toContain("secret-notes");
    expect(hits.map((h) => h.slug)).not.toContain("hidden-budget");

    const optedIn = await findSimilar(e, "budget expenses notes", 5, { id: "usr_x", settings: { showUnlicensed: true } });
    expect(optedIn.map((h) => h.slug)).toContain("secret-notes");
  });

  it("falls back to keyword search without AI", async () => {
    const res = await api<{ items: { slug: string }[] }>("/api/search/similar?q=pixel%20art");
    expect(res.status).toBe(200);
    expect(res.body.items.map((i) => i.slug)).toEqual(["pixel-paint"]);
  });
});
