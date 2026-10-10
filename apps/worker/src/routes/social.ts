import type { Hono } from "hono";
import { LIMITS, type Collection, type Follow } from "@forkvlift/shared";
import type { AppEnv } from "../env";
import { mount } from "../core/http";
import { HttpError, notFound } from "../core/errors";
import { newId } from "../core/ids";
import { decodeCursor, encodeCursor } from "../core/projects/list";
import { LISTED, PROJECT_SELECT, parseJson, rowsToCards, type ProjectRow } from "../core/projects/rows";

interface CollectionRow {
  id: string; owner_id: string; name: string; description: string; is_public: number; is_default: number;
  updated_at: number; item_count: number; username: string; display_name: string; avatar_url: string | null; avatar: string | null;
}
const collectionSelect = `SELECT col.*, u.username, u.display_name, u.avatar_url, av.config AS avatar,
  (SELECT count(*) FROM collection_items ci JOIN projects p ON p.id = ci.project_id
   WHERE ci.collection_id = col.id AND p.deleted_at IS NULL AND p.hidden_at IS NULL
     AND p.repo_url IS NOT NULL AND ((${LISTED}) OR (? = col.owner_id AND p.owner_id = col.owner_id))
     AND (? = col.owner_id OR p.license_spdx IS NOT NULL)) AS item_count
  FROM collections col JOIN users u ON u.id = col.owner_id AND u.deleted_at IS NULL
  LEFT JOIN avatars av ON av.user_id = u.id`;
function toCollection(r: CollectionRow): Collection {
  return { id: r.id, name: r.name, description: r.description, isPublic: r.is_public === 1, isDefault: r.is_default === 1,
    owner: { id: r.owner_id, username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url, avatar: parseJson(r.avatar, null) },
    itemCount: r.item_count, updatedAt: new Date(r.updated_at).toISOString() };
}
async function savedCollection(db: D1Database, ownerId: string) {
  // One statement checks and inserts atomically; concurrent first visits cannot create duplicates.
  await db.prepare(`INSERT INTO collections (id, owner_id, name, is_default, is_public)
    SELECT ?, ?, 'Saved', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM collections WHERE owner_id = ? AND is_default = 1)`)
    .bind(newId("col"), ownerId, ownerId).run();
}
async function collectionRow(db: D1Database, id: string, viewerId: string | null, edit = false): Promise<CollectionRow> {
  const row = await db.prepare(`${collectionSelect} WHERE col.id = ? AND (col.is_public = 1 OR col.owner_id = ?)`)
    .bind(viewerId, viewerId, id, viewerId).first<CollectionRow>();
  if (!row) throw notFound("Collection not found");
  if (edit && row.owner_id !== viewerId) throw new HttpError("forbidden", "Only the owner can edit this collection.");
  return row;
}
async function followTarget(db: D1Database, type: Follow["targetType"], id: string) {
  const sql = type === "user" ? `SELECT id FROM users WHERE id = ? AND deleted_at IS NULL`
    : type === "category" ? `SELECT slug AS id FROM categories WHERE slug = ? AND status = 'active'`
    : `SELECT p.id FROM projects p WHERE p.id = ? AND ${LISTED}`;
  if (!await db.prepare(sql).bind(id).first()) throw notFound("Follow target not found");
}
async function saveableProject(db: D1Database, id: string, viewerId: string) {
  if (!await db.prepare(`SELECT p.id FROM projects p WHERE p.id = ? AND p.deleted_at IS NULL AND p.hidden_at IS NULL
    AND p.repo_url IS NOT NULL AND ((${LISTED}) OR p.owner_id = ?)` ).bind(id, viewerId).first()) throw notFound("Project not found");
}

/** Follows, bookmarks, collections. Owner: Sol (task 2.5). */
export function registerSocial(app: Hono<AppEnv>) {
  mount(app, "listFollowing", async ({ query }, c) => {
    const limit = query.limit ?? LIMITS.pageSizeDefault;
    const cursor = decodeCursor(query.cursor);
    const { results } = await c.env.DB.prepare(`SELECT f.target_type, f.target_id, f.created_at,
      CASE f.target_type WHEN 'user' THEN u.display_name WHEN 'category' THEN cat.name ELSE p.name END AS label,
      u.username, cat.slug AS category_slug, p.slug AS project_slug
      FROM follows f
      LEFT JOIN users u ON f.target_type = 'user' AND u.id = f.target_id AND u.deleted_at IS NULL
      LEFT JOIN categories cat ON f.target_type = 'category' AND cat.slug = f.target_id AND cat.status = 'active'
      LEFT JOIN projects p ON f.target_type = 'project' AND p.id = f.target_id AND ${LISTED}
      WHERE f.follower_id = ? AND (u.id IS NOT NULL OR cat.slug IS NOT NULL OR p.id IS NOT NULL)
      ORDER BY f.created_at DESC, f.target_type, f.target_id LIMIT ? OFFSET ?`)
      .bind(c.get("user")!.id, limit + 1, cursor.o).all<{
        target_type: Follow["targetType"]; target_id: string; created_at: number; label: string;
        username: string | null; category_slug: string | null; project_slug: string | null;
      }>();
    const items: Follow[] = results.slice(0, limit).map(r => ({ targetType: r.target_type, targetId: r.target_id, label: r.label,
      href: r.target_type === "user" ? `/u/${encodeURIComponent(r.username!)}` : r.target_type === "category" ? `/?category=${encodeURIComponent(r.category_slug!)}` : `/p/${encodeURIComponent(r.project_slug!)}`,
      createdAt: new Date(r.created_at).toISOString() }));
    return { items, nextCursor: results.length > limit ? encodeCursor({ o: cursor.o + limit }) : null };
  });
  mount(app, "follow", async ({ body }, c) => {
    const user = c.get("user")!;
    if (body.targetType === "user" && body.targetId === user.id) throw new HttpError("bad_request", "You cannot follow yourself.");
    await followTarget(c.env.DB, body.targetType, body.targetId);
    if (body.targetType === "user") {
      const blocked = await c.env.DB.prepare(`SELECT 1 FROM blocks WHERE kind = 'block' AND ((blocker_id = ?1 AND blocked_id = ?2) OR (blocker_id = ?2 AND blocked_id = ?1))`)
        .bind(user.id, body.targetId).first();
      if (blocked) throw new HttpError("forbidden", "You can't follow this person.");
    }
    await c.env.DB.prepare(`INSERT OR IGNORE INTO follows (follower_id, target_type, target_id) VALUES (?, ?, ?)`)
      .bind(user.id, body.targetType, body.targetId).run();
    return { ok: true as const };
  });
  mount(app, "unfollow", async ({ body }, c) => {
    await followTarget(c.env.DB, body.targetType, body.targetId);
    await c.env.DB.prepare(`DELETE FROM follows WHERE follower_id = ? AND target_type = ? AND target_id = ?`)
      .bind(c.get("user")!.id, body.targetType, body.targetId).run();
    return { ok: true as const };
  });
  mount(app, "listUserCollections", async ({ params }, c) => {
    const db = c.env.DB;
    const user = await db.prepare(`SELECT id FROM users WHERE username = ? COLLATE NOCASE AND deleted_at IS NULL`).bind(params.username).first<{ id: string }>();
    if (!user) throw notFound("User not found");
    const viewerId = c.get("user")?.id ?? null;
    if (viewerId === user.id) await savedCollection(db, user.id);
    const { results } = await db.prepare(`${collectionSelect} WHERE col.owner_id = ? AND (col.is_public = 1 OR col.owner_id = ?)
      ORDER BY col.is_default DESC, col.updated_at DESC, col.id`).bind(viewerId, viewerId, user.id, viewerId).all<CollectionRow>();
    return { items: results.map(toCollection) };
  });
  mount(app, "getCollection", async ({ params }, c) => {
    const db = c.env.DB;
    const viewerId = c.get("user")?.id ?? null;
    const row = await collectionRow(db, params.id, viewerId);
    const own = row.owner_id === viewerId;
    const { results } = await db.prepare(`${PROJECT_SELECT}
      JOIN collection_items ci ON ci.project_id = p.id WHERE ci.collection_id = ?
      AND p.deleted_at IS NULL AND p.hidden_at IS NULL AND p.repo_url IS NOT NULL
      AND ((${LISTED}) OR (? = 1 AND p.owner_id = ?)) AND (? = 1 OR p.license_spdx IS NOT NULL)
      ORDER BY ci.position, ci.created_at, p.id`).bind(params.id, own ? 1 : 0, viewerId, own ? 1 : 0).all<ProjectRow>();
    const items = await rowsToCards(db, results, viewerId);
    // The count describes exactly what this viewer can see, without leaking private/unlicensed entries.
    return { collection: { ...toCollection(row), itemCount: items.length }, items };
  });
  mount(app, "createCollection", async ({ body }, c) => {
    const userId = c.get("user")!.id;
    const id = newId("col");
    await savedCollection(c.env.DB, userId);
    await c.env.DB.prepare(`INSERT INTO collections (id, owner_id, name, description, is_public) VALUES (?, ?, ?, ?, ?)`)
      .bind(id, userId, body.name, body.description, body.isPublic ? 1 : 0).run();
    return toCollection(await collectionRow(c.env.DB, id, userId));
  });
  mount(app, "updateCollection", async ({ params, body }, c) => {
    const userId = c.get("user")!.id;
    const row = await collectionRow(c.env.DB, params.id, userId, true);
    if (row.is_default === 1 && body.name !== undefined && body.name !== row.name) throw new HttpError("bad_request", "The Saved collection cannot be renamed.");
    await c.env.DB.prepare(`UPDATE collections SET name = ?, description = ?, is_public = ?, updated_at = ? WHERE id = ? AND owner_id = ?`)
      .bind(body.name ?? row.name, body.description ?? row.description, body.isPublic === undefined ? row.is_public : body.isPublic ? 1 : 0, Date.now(), params.id, userId).run();
    return toCollection(await collectionRow(c.env.DB, params.id, userId));
  });
  mount(app, "deleteCollection", async ({ params }, c) => {
    const userId = c.get("user")!.id;
    const row = await collectionRow(c.env.DB, params.id, userId, true);
    if (row.is_default === 1) throw new HttpError("bad_request", "The Saved collection cannot be deleted.");
    await c.env.DB.prepare(`DELETE FROM collections WHERE id = ? AND owner_id = ?`).bind(params.id, userId).run();
    return { ok: true as const };
  });
  mount(app, "addCollectionItem", async ({ params, body }, c) => {
    const userId = c.get("user")!.id;
    await collectionRow(c.env.DB, params.id, userId, true);
    await saveableProject(c.env.DB, body.projectId, userId);
    await c.env.DB.batch([
      c.env.DB.prepare(`INSERT OR IGNORE INTO collection_items (collection_id, project_id, position)
        SELECT ?, ?, coalesce(max(position), -1) + 1 FROM collection_items WHERE collection_id = ?`).bind(params.id, body.projectId, params.id),
      c.env.DB.prepare(`UPDATE collections SET updated_at = ? WHERE id = ? AND owner_id = ?`).bind(Date.now(), params.id, userId),
    ]);
    return { ok: true as const };
  });
  mount(app, "removeCollectionItem", async ({ params }, c) => {
    const userId = c.get("user")!.id;
    await collectionRow(c.env.DB, params.id, userId, true);
    await c.env.DB.batch([
      c.env.DB.prepare(`DELETE FROM collection_items WHERE collection_id = ? AND project_id = ?`).bind(params.id, params.projectId),
      c.env.DB.prepare(`UPDATE collections SET updated_at = ? WHERE id = ? AND owner_id = ?`).bind(Date.now(), params.id, userId),
    ]);
    return { ok: true as const };
  });
}
