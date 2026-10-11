/**
 * Task 5.2: showcases in semantic search and the "Has this been built?"
 * check. Showcases share the catalog's Vectorize index under their own
 * namespace, embedded the same way as projects (4.1). Keyword search stays
 * the fallback whenever AI or Vectorize isn't available.
 */
import type { ShowcaseCard } from "@forkvlift/shared";
import { sha256Hex } from "./ids";
import { decodeCursor, encodeCursor } from "./projects/list";
import { parseJson } from "./projects/rows";
import { EMBED_MODEL, MIN_SCORE, embed, semanticAvailable } from "./projects/semantic";
import { SHOWCASE_SELECT, VISIBLE, listShowcases, type ListQuery, type ShowcaseRow } from "./showcases";

/** Vectorize namespace for showcase vectors; projects keep the default namespace. */
export const SHOWCASE_NAMESPACE = "showcases";
const BATCH = 50;

/** Markdown down to plain words, for embedding. */
function mdToText(md: string, max: number): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** The text a showcase is searched by: what it is, what kind of thing, how it was built. */
export function showcaseText(r: Pick<ShowcaseRow, "title" | "tagline" | "body_md" | "build_story_md" | "kind" | "ai_tools" | "tags" | "cat_name">): string {
  const tools = parseJson<string[]>(r.ai_tools, []);
  const tags = parseJson<string[]>(r.tags, []);
  const parts = [
    r.title,
    r.tagline,
    `A ${r.kind} showcase`,
    r.cat_name ? `Category: ${r.cat_name}` : "",
    tags.length ? `Tags: ${tags.join(", ")}` : "",
    tools.length ? `Built with ${tools.join(", ")}` : "",
    mdToText(r.body_md, 1000),
    mdToText(r.build_story_md, 400),
  ];
  return parts.filter(Boolean).join("\n").slice(0, 2000);
}

/** Embed published showcases whose text changed, and drop vectors for ones no longer visible. */
export async function syncShowcaseVectors(env: Env, limit = 200): Promise<{ upserted: number; removed: number }> {
  if (!semanticAvailable(env)) return { upserted: 0, removed: 0 };
  const db = env.DB;

  const { results: gone } = await db
    .prepare(`SELECT s.id FROM showcases s JOIN users u ON u.id = s.owner_id WHERE s.embedded_at IS NOT NULL AND NOT (${VISIBLE}) LIMIT 500`)
    .all<{ id: string }>();
  if (gone.length) {
    await env.VECTORS!.deleteByIds(gone.map((g) => g.id));
    await db.batch(gone.map((g) => db.prepare(`UPDATE showcases SET embedded_at = NULL, embedding_hash = NULL WHERE id = ?`).bind(g.id)));
  }

  const { results: stale } = await db
    .prepare(`${SHOWCASE_SELECT} WHERE ${VISIBLE} AND (s.embedded_at IS NULL OR s.embedded_at < s.updated_at) ORDER BY s.embedded_at IS NOT NULL, s.updated_at DESC LIMIT ?`)
    .bind(limit)
    .all<ShowcaseRow & { embedding_hash: string | null }>();
  const now = Date.now();
  const todo: { row: ShowcaseRow; text: string; hash: string }[] = [];
  const unchanged: string[] = [];
  for (const row of stale) {
    const text = showcaseText(row);
    const hash = await sha256Hex(`${EMBED_MODEL}\n${text}`);
    if (hash === row.embedding_hash) unchanged.push(row.id);
    else todo.push({ row, text, hash });
  }
  if (unchanged.length) await db.batch(unchanged.map((id) => db.prepare(`UPDATE showcases SET embedded_at = ? WHERE id = ?`).bind(now, id)));

  let upserted = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const chunk = todo.slice(i, i + BATCH);
    const vectors = await embed(env, chunk.map((t) => t.text));
    await env.VECTORS!.upsert(
      chunk.map((t, j) => ({
        id: t.row.id,
        values: vectors[j]!,
        namespace: SHOWCASE_NAMESPACE,
        metadata: { type: "showcase", slug: t.row.slug, category: t.row.category_slug, kind: t.row.kind },
      })),
    );
    await db.batch(chunk.map((t) => db.prepare(`UPDATE showcases SET embedded_at = ?, embedding_hash = ? WHERE id = ?`).bind(now, t.hash, t.row.id)));
    upserted += chunk.length;
  }
  return { upserted, removed: gone.length };
}

/** Ids of showcases closest in meaning to `query`, best first. Empty when semantic search is unavailable or fails. */
async function semanticIds(env: Env, query: string, topK: number): Promise<string[]> {
  if (!semanticAvailable(env)) return [];
  try {
    const [vector] = await embed(env, [query.slice(0, 500)]);
    const res = await env.VECTORS!.query(vector!, { topK: Math.min(50, topK), namespace: SHOWCASE_NAMESPACE, returnMetadata: "none" });
    return res.matches.filter((m) => m.score >= MIN_SCORE).map((m) => m.id);
  } catch (e) {
    console.error("[semantic] showcase search failed", e);
    return [];
  }
}

/** Visible showcases among `ids` that pass the feed's filters, in `ids` order. */
async function cardsInOrder(db: D1Database, ids: string[], q: ListQuery, viewerId: string | null): Promise<ShowcaseCard[]> {
  const { items } = await listShowcases(db, { ...q, q: undefined, cursor: undefined, limit: 60 }, viewerId, { onlyIds: ids, offset: 0 });
  const byId = new Map(items.map((i) => [i.id, i]));
  return ids.map((id) => byId.get(id)).filter((c): c is ShowcaseCard => Boolean(c));
}

/**
 * The /showcase feed. A search sorted by relevance (no sort, or "trending")
 * lists meaning matches first, then keyword matches. The first page fixes the
 * meaning matches and the cursor carries them, so later pages continue the
 * same list and never repeat a showcase. Everything else is the plain feed.
 */
export async function searchShowcases(env: Env, q: ListQuery, viewerId: string | null) {
  const text = q.q?.trim();
  if (!text || q.sort === "new" || q.sort === "top" || !semanticAvailable(env)) return listShowcases(env.DB, q, viewerId);
  const limit = Math.min(q.limit ?? 24, 60);
  const cursor = decodeCursor(q.cursor);

  const ranked = q.cursor
    ? (Array.isArray(cursor.x) ? cursor.x : []).filter((id): id is string => typeof id === "string").slice(0, 50)
    : (await cardsInOrder(env.DB, await semanticIds(env, text, 50), q, viewerId)).map((c) => c.id);
  const fromRanked = ranked.slice(cursor.o, cursor.o + limit);
  const items = await cardsInOrder(env.DB, fromRanked, q, viewerId);
  const room = limit - fromRanked.length;
  let more = cursor.o + limit < ranked.length;
  if (room > 0) {
    const keyword = await listShowcases(env.DB, { ...q, limit: room }, viewerId, { excludeIds: ranked, offset: Math.max(0, cursor.o - ranked.length) });
    items.push(...keyword.items);
    more = keyword.nextCursor !== null;
  } else if (!more) {
    more = (await listShowcases(env.DB, { ...q, limit: 1 }, viewerId, { excludeIds: ranked, offset: 0 })).items.length > 0;
  }
  return { items, nextCursor: more ? encodeCursor({ o: cursor.o + limit, x: ranked }) : null };
}

/** "Has this been built?" for showcases: meaning matches first, topped up with keyword matches. */
export async function findSimilarShowcases(env: Env, query: string, limit: number, viewerId: string | null): Promise<ShowcaseCard[]> {
  const items = await cardsInOrder(env.DB, await semanticIds(env, query, limit * 3), {}, viewerId);
  const out = items.slice(0, limit);
  if (out.length < limit) {
    const keyword = await listShowcases(env.DB, { q: query, limit }, viewerId, { excludeIds: out.map((i) => i.id), offset: 0 });
    out.push(...keyword.items.slice(0, limit - out.length));
  }
  return out;
}
