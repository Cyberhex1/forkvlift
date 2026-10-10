import type { Hono } from "hono";
import { LIMITS, type AlternativeProduct, type BuildRequest } from "@forkvlift/shared";
import type { AppEnv } from "../env";
import { mount } from "../core/http";
import { HttpError, notFound } from "../core/errors";
import { newId, sha256Hex, slugify } from "../core/ids";
import { LISTED, PROJECT_SELECT, parseJson, rowsToCards, type ProjectRow } from "../core/projects/rows";
import { decodeCursor, encodeCursor } from "../core/projects/list";
import { clientIp, verifyTurnstile } from "../core/security";

interface RequestRow {
  id: string; author_id: string; title: string; body_md: string; replaces: string | null;
  status: BuildRequest["status"]; claimed_by: string | null; upvotes: number; created_at: number;
  username: string; display_name: string; avatar_url: string | null; avatar: string | null;
  claimant_username: string | null; claimant_display_name: string | null; claimant_avatar_url: string | null; claimant_avatar: string | null;
  project_id: string | null; project_slug: string | null; project_name: string | null; project_thumbnail: string | null;
}
const requestSelect = `SELECT r.*, u.username, u.display_name, u.avatar_url, av.config AS avatar,
  cu.username AS claimant_username, cu.display_name AS claimant_display_name, cu.avatar_url AS claimant_avatar_url, cav.config AS claimant_avatar,
  p.id AS project_id, p.slug AS project_slug, p.name AS project_name, p.thumbnail_url AS project_thumbnail
  FROM build_requests r JOIN users u ON u.id = r.author_id AND u.deleted_at IS NULL
  LEFT JOIN avatars av ON av.user_id = u.id
  LEFT JOIN users cu ON cu.id = r.claimed_by AND cu.deleted_at IS NULL
  LEFT JOIN avatars cav ON cav.user_id = cu.id
  LEFT JOIN projects p ON p.id = r.built_project_id AND ${LISTED} AND p.license_spdx IS NOT NULL`;
function toRequest(r: RequestRow): BuildRequest {
  return { id: r.id, title: r.title, bodyMd: r.body_md, replaces: r.replaces, status: r.status,
    author: { id: r.author_id, username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url, avatar: parseJson(r.avatar, null) },
    claimedBy: r.claimed_by && r.claimant_username ? { id: r.claimed_by, username: r.claimant_username, displayName: r.claimant_display_name ?? r.claimant_username, avatarUrl: r.claimant_avatar_url, avatar: parseJson(r.claimant_avatar, null) } : null,
    builtProject: r.project_id ? { id: r.project_id, slug: r.project_slug!, name: r.project_name!, author: null } : null,
    upvotes: r.upvotes, createdAt: new Date(r.created_at).toISOString() };
}
async function requestRow(db: D1Database, id: string) {
  const row = await db.prepare(`${requestSelect} WHERE r.id = ?`).bind(id).first<RequestRow>();
  if (!row) throw notFound("Request not found");
  return row;
}

/** Names come only from published projects; there is no price catalog. */
async function alternativeGroups(db: D1Database) {
  const { results } = await db.prepare(`SELECT p.id, p.license_spdx, j.value AS name
    FROM projects p, json_each(CASE WHEN json_valid(p.replaces) THEN p.replaces ELSE '[]' END) j
    WHERE ${LISTED} AND j.type = 'text' ORDER BY lower(j.value), j.value, p.id`)
    .all<{ id: string; license_spdx: string | null; name: string }>();
  const groups = new Map<string, { product: AlternativeProduct; names: Set<string>; licensed: Set<string>; all: Set<string> }>();
  for (const row of results) {
    const name = row.name.trim().slice(0, 60);
    if (!name) continue;
    const slug = slugify(name) || `product-${(await sha256Hex(name.toLowerCase())).slice(0, 16)}`;
    let group = groups.get(slug);
    if (!group) {
      group = { product: { slug, name, projectCount: 0, monthlyPriceUsd: null }, names: new Set(), licensed: new Set(), all: new Set() };
      groups.set(slug, group);
    }
    group.names.add(row.name);
    group.all.add(row.id);
    if (row.license_spdx) group.licensed.add(row.id);
    group.product.projectCount = group.licensed.size;
  }
  return groups;
}

/** Requests board + alternatives directory. Owner: Sol (tasks 4.5, 4.7). */
export function registerGrowth(app: Hono<AppEnv>) {
  mount(app, "listRequests", async ({ query }, c) => {
    const limit = query.limit ?? LIMITS.pageSizeDefault;
    const cursor = decodeCursor(query.cursor);
    const { results } = await c.env.DB.prepare(`${requestSelect} WHERE (? IS NULL OR r.status = ?)
      ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`)
      .bind(query.status ?? null, query.status ?? null, limit + 1, cursor.o).all<RequestRow>();
    return { items: results.slice(0, limit).map(toRequest), nextCursor: results.length > limit ? encodeCursor({ o: cursor.o + limit }) : null };
  });
  mount(app, "getRequest", async ({ params }, c) => toRequest(await requestRow(c.env.DB, params.id)));
  mount(app, "createRequest", async ({ body }, c) => {
    const title = body.title.trim();
    if (title.length < 3) throw new HttpError("invalid_request", "Give the request a title of at least three characters.");
    await verifyTurnstile(c.env, body.turnstileToken, clientIp(c.req.raw));
    const id = newId("req");
    await c.env.DB.prepare(`INSERT INTO build_requests (id, author_id, title, body_md, replaces) VALUES (?, ?, ?, ?, ?)`)
      .bind(id, c.get("user")!.id, title, body.bodyMd, body.replaces?.trim() || null).run();
    return toRequest(await requestRow(c.env.DB, id));
  });
  mount(app, "claimRequest", async ({ params }, c) => {
    const db = c.env.DB;
    const userId = c.get("user")!.id;
    const row = await requestRow(db, params.id);
    if (row.author_id === userId) throw new HttpError("bad_request", "Let another builder claim your request.");
    const blocked = await db.prepare(`SELECT 1 FROM blocks WHERE kind = 'block'
      AND ((blocker_id = ?1 AND blocked_id = ?2) OR (blocker_id = ?2 AND blocked_id = ?1))`)
      .bind(userId, row.author_id).first();
    if (blocked) throw new HttpError("forbidden", "You can't claim this person's request.");
    // Compare-and-set: only one claimant can win concurrent requests.
    await db.prepare(`UPDATE build_requests SET status = 'claimed', claimed_by = ?, updated_at = ?
      WHERE id = ? AND status = 'open' AND claimed_by IS NULL`).bind(userId, Date.now(), params.id).run();
    const claimed = await requestRow(db, params.id);
    if (claimed.status !== "claimed" || claimed.claimed_by !== userId) throw new HttpError("conflict", "This request is no longer open.");
    return toRequest(claimed);
  });

  mount(app, "listAlternatives", async (_, c) => {
    const groups = await alternativeGroups(c.env.DB);
    return { items: [...groups.values()].filter(g => g.licensed.size).map(g => g.product).sort((a, b) => a.name.localeCompare(b.name)) };
  });
  mount(app, "getAlternatives", async ({ params, query }, c) => {
    const db = c.env.DB;
    const group = (await alternativeGroups(db)).get(params.product);
    if (!group) throw notFound("Product not found");
    const names = [...group.names];
    const { results } = await db.prepare(`${PROJECT_SELECT} WHERE ${LISTED}
      AND (? = 1 OR p.license_spdx IS NOT NULL)
      AND EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(p.replaces) THEN p.replaces ELSE '[]' END) j
        WHERE j.type = 'text' AND j.value IN (SELECT value FROM json_each(?)))
      ORDER BY p.upvotes DESC, p.published_at DESC, p.id`)
      .bind(query.showUnlicensed ? 1 : 0, JSON.stringify(names)).all<ProjectRow>();
    return { product: { ...group.product, projectCount: query.showUnlicensed ? group.all.size : group.licensed.size },
      items: await rowsToCards(db, results, c.get("user")?.id ?? null),
      hiddenUnlicensedCount: query.showUnlicensed ? 0 : group.all.size - group.licensed.size };
  });
}
