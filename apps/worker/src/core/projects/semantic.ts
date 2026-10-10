/**
 * Task 4.1: semantic search. Each listed project is embedded with Workers AI
 * (bge-base, 768 dims) into the Vectorize index; a query is embedded the same
 * way and matched by cosine similarity. Keyword search (FTS) stays the
 * fallback whenever AI or Vectorize isn't available.
 */
import type { ProjectCard } from "@forkvlift/shared";
import { sha256Hex } from "../ids";
import { listProjects } from "./list";
import { htmlToText } from "./search";
import { LISTED, PROJECT_SELECT, loadTags, parseJson, rowsToCards, type ProjectRow } from "./rows";

export const EMBED_MODEL = "@cf/baai/bge-base-en-v1.5";
/** Below this cosine score a match is more noise than signal. */
export const MIN_SCORE = 0.6;
const BATCH = 50;

/** The text a project is searched by: what it is, what it replaces, what it's built with. */
export function projectText(r: Pick<ProjectRow, "name" | "tagline" | "description" | "readme_html" | "replaces" | "stack" | "cat_name">, tags: string[]): string {
  const parts = [
    r.name,
    r.tagline,
    r.description,
    r.cat_name ? `Category: ${r.cat_name}` : "",
    tags.length ? `Tags: ${tags.join(", ")}` : "",
    (() => {
      const replaces = parseJson<string[]>(r.replaces, []);
      return replaces.length ? `Free alternative to ${replaces.join(", ")}` : "";
    })(),
    (() => {
      const stack = parseJson<string[]>(r.stack, []);
      return stack.length ? `Built with ${stack.join(", ")}` : "";
    })(),
    htmlToText(r.readme_html, 1200),
  ];
  return parts.filter(Boolean).join("\n").slice(0, 2000);
}

export function semanticAvailable(env: Env): boolean {
  return Boolean(env.AI && env.VECTORS);
}

export async function embed(env: Env, texts: string[]): Promise<number[][]> {
  const out = (await env.AI!.run(EMBED_MODEL as Parameters<Ai["run"]>[0], { text: texts })) as { data?: number[][] };
  if (!out.data || out.data.length !== texts.length) throw new Error("Embedding failed");
  return out.data;
}

/**
 * Bring the index in line with the catalog: embed listed projects whose text
 * changed, and drop vectors for projects that are no longer listed.
 */
export async function syncVectors(env: Env, limit = 200): Promise<{ upserted: number; removed: number }> {
  if (!semanticAvailable(env)) return { upserted: 0, removed: 0 };
  const db = env.DB;

  const { results: gone } = await db
    .prepare(`SELECT p.id FROM projects p WHERE p.embedded_at IS NOT NULL AND NOT (${LISTED}) LIMIT 500`)
    .all<{ id: string }>();
  if (gone.length) {
    await env.VECTORS!.deleteByIds(gone.map((g) => g.id));
    await db.batch(gone.map((g) => db.prepare(`UPDATE projects SET embedded_at = NULL, embedding_hash = NULL WHERE id = ?`).bind(g.id)));
  }

  const { results: stale } = await db
    .prepare(`${PROJECT_SELECT} WHERE ${LISTED} AND (p.embedded_at IS NULL OR p.embedded_at < p.updated_at) ORDER BY p.embedded_at IS NOT NULL, p.updated_at DESC LIMIT ?`)
    .bind(limit)
    .all<ProjectRow & { embedding_hash: string | null }>();
  const tags = await loadTags(db, stale.map((r) => r.id));
  const now = Date.now();
  const todo: { row: ProjectRow; text: string; hash: string }[] = [];
  const unchanged: string[] = [];
  for (const row of stale) {
    const text = projectText(row, tags.get(row.id) ?? []);
    const hash = await sha256Hex(`${EMBED_MODEL}\n${text}`);
    if (hash === row.embedding_hash) unchanged.push(row.id);
    else todo.push({ row, text, hash });
  }
  if (unchanged.length) await db.batch(unchanged.map((id) => db.prepare(`UPDATE projects SET embedded_at = ? WHERE id = ?`).bind(now, id)));

  let upserted = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const chunk = todo.slice(i, i + BATCH);
    const vectors = await embed(env, chunk.map((t) => t.text));
    await env.VECTORS!.upsert(
      chunk.map((t, j) => ({
        id: t.row.id,
        values: vectors[j]!,
        metadata: { slug: t.row.slug, licensed: t.row.license_spdx ? 1 : 0, category: t.row.category_slug },
      })),
    );
    await db.batch(chunk.map((t) => db.prepare(`UPDATE projects SET embedded_at = ?, embedding_hash = ? WHERE id = ?`).bind(now, t.hash, t.row.id)));
    upserted += chunk.length;
  }
  return { upserted, removed: gone.length };
}

/** Projects closest in meaning to `query`, best first. Empty when semantic search is unavailable. */
export async function semanticSearch(
  env: Env,
  query: string,
  opts: { limit: number; viewerId: string | null; showUnlicensed: boolean; minScore?: number },
): Promise<(ProjectCard & { score: number })[]> {
  if (!semanticAvailable(env)) return [];
  const [vector] = await embed(env, [query.slice(0, 500)]);
  const res = await env.VECTORS!.query(vector!, { topK: Math.min(50, opts.limit * 3), returnMetadata: "none" });
  const matches = res.matches.filter((m) => m.score >= (opts.minScore ?? MIN_SCORE));
  if (!matches.length) return [];
  const ids = matches.map((m) => m.id);
  const where = [LISTED, `p.id IN (${ids.map(() => "?").join(",")})`];
  if (!opts.showUnlicensed) where.push(`p.license_spdx IS NOT NULL`);
  const { results } = await env.DB.prepare(`${PROJECT_SELECT} WHERE ${where.join(" AND ")}`).bind(...ids).all<ProjectRow>();
  const byId = new Map(results.map((r) => [r.id, r]));
  const ordered = matches.map((m) => byId.get(m.id)).filter((r): r is ProjectRow => Boolean(r)).slice(0, opts.limit);
  const cards = await rowsToCards(env.DB, ordered, opts.viewerId);
  const score = new Map(matches.map((m) => [m.id, m.score]));
  return cards.map((c) => ({ ...c, score: score.get(c.id) ?? 0 }));
}

/**
 * "Has this been built?": semantic matches first, topped up with keyword
 * matches so the box is never empty just because AI is unavailable.
 */
export async function findSimilar(env: Env, query: string, limit: number, viewer: { id: string; settings: { showUnlicensed: boolean } } | null): Promise<ProjectCard[]> {
  const showUnlicensed = viewer?.settings.showUnlicensed ?? false;
  const semantic = await semanticSearch(env, query, { limit, viewerId: viewer?.id ?? null, showUnlicensed }).catch((e) => {
    console.error("[semantic] search failed", e);
    return [];
  });
  const items: ProjectCard[] = semantic.map(({ score: _score, ...card }) => card);
  if (items.length < limit) {
    const keyword = await listProjects(env.DB, { q: query, limit, showUnlicensed }, viewer?.id ?? null);
    for (const card of keyword.items) {
      if (items.length >= limit) break;
      if (!items.some((i) => i.id === card.id)) items.push(card);
    }
  }
  return items;
}
