/**
 * Task 1.2: the feed query. Search, filters, sorts, pagination, and the
 * "N unlicensed projects hidden" count.
 */
import { LIMITS, type ListProjectsQuery, type ProjectCard } from "@forkvlift/shared";
import { HttpError } from "../errors";
import { LISTED, PROJECT_SELECT, rowsToCards, type ProjectRow } from "./rows";
import { buildFtsQuery } from "./search";

const DAY_MS = 86_400_000;

interface Cursor {
  /** offset */
  o: number;
  /** seed for sort=random */
  s?: number;
}

export function encodeCursor(c: Cursor): string {
  return btoa(JSON.stringify(c)).replace(/=+$/, "");
}

export function decodeCursor(value: string | undefined): Cursor {
  if (!value) return { o: 0 };
  try {
    const c = JSON.parse(atob(value)) as Cursor;
    if (!Number.isInteger(c.o) || c.o < 0 || c.o > 10_000) throw new Error();
    return c;
  } catch {
    throw new HttpError("invalid_request", "Invalid cursor");
  }
}

interface Built {
  where: string[];
  binds: unknown[];
}

/** Filter clauses shared by the visible list and the hidden-unlicensed count. */
async function buildFilters(db: D1Database, q: ListProjectsQuery, extra: { ownerId?: string; forksOnly?: boolean } = {}): Promise<Built> {
  const where = [LISTED];
  const binds: unknown[] = [];
  const inList = (column: string, values: readonly unknown[]) => {
    where.push(`${column} IN (${values.map(() => "?").join(",")})`);
    binds.push(...values);
  };
  const jsonAny = (column: string, values: readonly string[]) => {
    where.push(`EXISTS (SELECT 1 FROM json_each(${column}) WHERE lower(json_each.value) IN (${values.map(() => "?").join(",")}))`);
    binds.push(...values.map((v) => v.toLowerCase()));
  };

  if (q.q) {
    const fts = buildFtsQuery(q.q);
    if (fts) {
      where.push(`p.id IN (SELECT project_id FROM projects_fts WHERE projects_fts MATCH ?)`);
      binds.push(fts);
    }
  }
  if (q.category?.length) {
    // A parent category includes its sub-categories.
    const { results } = await db
      .prepare(`SELECT slug FROM categories WHERE slug IN (${q.category.map(() => "?").join(",")}) OR parent_slug IN (${q.category.map(() => "?").join(",")})`)
      .bind(...q.category, ...q.category)
      .all<{ slug: string }>();
    inList("p.category_slug", results.length ? results.map((r) => r.slug) : q.category);
  }
  if (q.license?.length) inList("p.license_spdx", q.license);
  if (q.stage?.length) inList("p.stage", q.stage);
  if (q.difficulty?.length) inList("p.difficulty", q.difficulty);
  if (q.stack?.length) jsonAny("p.stack", q.stack);
  if (q.platform?.length) jsonAny("p.platforms", q.platform);
  if (q.aiTool?.length) jsonAny("p.ai_tools", q.aiTool);
  if (q.hasDemo) where.push(`p.live_url IS NOT NULL`);
  if (q.hasRelease) where.push(`p.release_url IS NOT NULL`);
  if (q.maintained) {
    where.push(`p.last_commit_at >= ?`);
    binds.push(Date.now() - 90 * DAY_MS);
  }
  if (q.replacesPaid) where.push(`json_array_length(coalesce(p.replaces, '[]')) > 0`);
  if (q.replaces) jsonAny("p.replaces", [q.replaces]);
  if (q.source) inList("p.source", [q.source]);
  if (q.template) where.push(`p.is_template = 1`);
  if (q.sort === "staff_picks") where.push(`p.staff_pick = 1`);
  if (extra.ownerId) {
    where.push(`p.owner_id = ?`);
    binds.push(extra.ownerId);
  }
  if (extra.forksOnly) where.push(`EXISTS (SELECT 1 FROM forks f WHERE f.child_id = p.id)`);
  return { where, binds };
}

function orderBy(q: ListProjectsQuery, seed: number): { sql: string; binds: unknown[] } {
  switch (q.sort ?? (q.q ? "relevance" : "trending")) {
    case "relevance":
      return { sql: `(SELECT bm25(projects_fts) FROM projects_fts WHERE projects_fts.project_id = p.id) ASC, p.upvotes DESC`, binds: [] };
    case "newest":
      return { sql: `p.published_at DESC`, binds: [] };
    case "most_forked":
      return { sql: `p.forks DESC`, binds: [] };
    case "most_starred":
      return { sql: `p.stars DESC`, binds: [] };
    case "recently_updated":
      return { sql: `coalesce(p.last_commit_at, p.updated_at) DESC`, binds: [] };
    case "most_discussed":
      return { sql: `p.comment_count DESC`, binds: [] };
    case "staff_picks":
      return { sql: `p.featured_slot IS NULL, p.featured_slot ASC, p.published_at DESC`, binds: [] };
    case "random":
      // Stable for a given seed so pages don't repeat.
      return { sql: `((p.rowid * ?) % 2147483647) ASC`, binds: [seed] };
    case "trending":
    default:
      // Upvotes weighted by recency: (votes + 1) / (age in days + 2)^1.5, written without pow().
      return {
        sql: `(p.upvotes + 1.0) / (((? - p.published_at) / ${DAY_MS}.0 + 2) * sqrt((? - p.published_at) / ${DAY_MS}.0 + 2)) DESC`,
        binds: [Date.now(), Date.now()],
      };
  }
}

export interface ListResult {
  items: ProjectCard[];
  nextCursor: string | null;
  hiddenUnlicensedCount: number;
}

export async function listProjects(
  db: D1Database,
  q: ListProjectsQuery,
  viewerId: string | null,
  extra: { ownerId?: string; forksOnly?: boolean; includeOwnUnlicensed?: boolean } = {},
): Promise<ListResult> {
  const limit = Math.min(q.limit ?? LIMITS.pageSizeDefault, LIMITS.pageSizeMax);
  const cursor = decodeCursor(q.cursor);
  const seed = cursor.s ?? (Math.floor(Math.random() * 1_000_000) | 1) + 7;
  const { where, binds } = await buildFilters(db, q, extra);
  const showUnlicensed = q.showUnlicensed === true || extra.includeOwnUnlicensed === true;

  const visibleWhere = showUnlicensed ? where : [...where, `p.license_spdx IS NOT NULL`];
  const order = orderBy(q, seed);

  const listStmt = db
    .prepare(`${PROJECT_SELECT} WHERE ${visibleWhere.join(" AND ")} ORDER BY ${order.sql}, p.id LIMIT ? OFFSET ?`)
    .bind(...binds, ...order.binds, limit + 1, cursor.o);
  const hiddenStmt = db.prepare(`SELECT count(*) AS n FROM projects p WHERE ${where.join(" AND ")} AND p.license_spdx IS NULL`).bind(...binds);

  const [list, hidden] = showUnlicensed
    ? [await listStmt.all<ProjectRow>(), null]
    : await db.batch<unknown>([listStmt, hiddenStmt]).then((r) => [r[0] as D1Result<ProjectRow>, r[1] as D1Result<{ n: number }>] as const);

  const rows = list.results;
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: await rowsToCards(db, page, viewerId),
    nextCursor: hasMore ? encodeCursor({ o: cursor.o + limit, s: q.sort === "random" ? seed : undefined }) : null,
    hiddenUnlicensedCount: hidden?.results[0]?.n ?? 0,
  };
}
