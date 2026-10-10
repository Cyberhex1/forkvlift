import type { Hono } from "hono";
import type { AuditLogEntry } from "@forkvlift/shared";
import type { AppEnv } from "../env";
import { mount } from "../core/http";
import { HttpError, notFound } from "../core/errors";
import { audit, decideCandidate, importByUrl, listCandidates } from "../core/curation/candidates";
import { decodeCursor, encodeCursor } from "../core/projects/list";
import { parseJson } from "../core/projects/rows";
import { syncProjectSearch } from "../core/projects/search";
import * as moderation from "../core/moderation";
import { setProvenOverride } from "../core/resources";

const DAY_MS = 86_400_000;

/** Admin console API (behind Cloudflare Access). Opus (tasks 1.7, 3.4). */
export function registerAdmin(app: Hono<AppEnv>) {
  const actor = (c: { get: (k: "adminActor") => string | null }) => c.get("adminActor") ?? "unknown";

  mount(app, "listCandidates", ({ query }, c) => listCandidates(c.env.DB, query));
  mount(app, "importCandidate", async ({ body }, c) => {
    const candidate = await importByUrl(c.env, body.repoUrl, body.foundViaUrl);
    await audit(c.env.DB, actor(c), "candidate.import", "candidate", candidate.id, { repo: candidate.repoFullName, foundVia: body.foundViaUrl });
    return candidate;
  });
  mount(app, "decideCandidate", ({ params, body }, c) => decideCandidate(c.env, actor(c), params.id, body));
  mount(app, "bulkDecideCandidates", async ({ body }, c) => {
    let updated = 0;
    for (const id of body.ids) {
      try {
        await decideCandidate(c.env, actor(c), id, { action: body.action, reason: body.reason, snoozeDays: 7, edits: null });
        updated++;
      } catch (err) {
        // Skip ones that can't be approved yet (no category, already imported); report the count.
        if (!(err instanceof HttpError)) throw err;
      }
    }
    return { updated };
  });

  mount(app, "listReports", ({ query }, c) => moderation.listReports(c.env.DB, query.status ?? "open", query.cursor, query.limit));
  mount(app, "resolveReport", ({ params, body }, c) => moderation.resolveReport(c.env, actor(c), params.id, body));
  mount(app, "moderateChat", async ({ params, body }, c) => {
    if (!moderation.CHAT_CHANNEL_SLUGS.includes(params.slug)) throw notFound("Channel not found");
    const result = await moderation.chatAdmin(c.env, params.slug, body);
    await c.env.CACHE.delete("chat:channels").catch(() => undefined);
    await audit(c.env.DB, actor(c), `chat.${body.action}`, "channel", params.slug, { ...body });
    return result;
  });

  mount(app, "upsertCategory", async ({ params, body }, c) => {
    const db = c.env.DB;
    if (body.parentSlug === params.slug) throw new HttpError("invalid_request", "A category can't be its own parent");
    if (body.mergeInto) {
      const target = await db.prepare(`SELECT 1 FROM categories WHERE slug = ? AND status = 'active'`).bind(body.mergeInto).first();
      if (!target) throw new HttpError("invalid_request", `Unknown category "${body.mergeInto}"`);
      const moved = await db.prepare(`SELECT id FROM projects WHERE category_slug = ?`).bind(params.slug).all<{ id: string }>();
      await db.batch([
        db.prepare(`UPDATE projects SET category_slug = ? WHERE category_slug = ?`).bind(body.mergeInto, params.slug),
        db.prepare(`UPDATE categories SET parent_slug = ? WHERE parent_slug = ?`).bind(body.mergeInto, params.slug),
        db.prepare(`UPDATE categories SET status = 'rejected' WHERE slug = ?`).bind(params.slug),
      ]);
      for (const p of moved.results) await syncProjectSearch(db, p.id);
    } else {
      await db
        .prepare(
          `INSERT INTO categories (slug, name, parent_slug, icon_key, description, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
           ON CONFLICT(slug) DO UPDATE SET name = ?2, parent_slug = ?3, icon_key = ?4, description = ?5, status = ?6`,
        )
        .bind(params.slug, body.name, body.parentSlug, body.iconKey, body.description, body.status)
        .run();
    }
    await audit(db, actor(c), body.mergeInto ? "category.merge" : "category.upsert", "category", params.slug, { ...body });
    const row = await db.prepare(`SELECT slug, name, parent_slug, icon_key, description FROM categories WHERE slug = ?`).bind(body.mergeInto ?? params.slug).first<{
      slug: string; name: string; parent_slug: string | null; icon_key: string | null; description: string | null;
    }>();
    return { slug: row!.slug, name: row!.name, parentSlug: row!.parent_slug, iconKey: row!.icon_key, description: row!.description, projectCount: 0 };
  });

  mount(app, "setStaffPick", async ({ params, body }, c) => {
    const res = await c.env.DB.prepare(`UPDATE projects SET staff_pick = ?, featured_slot = ? WHERE slug = ? AND deleted_at IS NULL`)
      .bind(body.staffPick ? 1 : 0, body.staffPick ? body.featuredSlot : null, params.slug)
      .run();
    if (!res.meta.changes) throw notFound("Project not found");
    await audit(c.env.DB, actor(c), "project.staff_pick", "project", params.slug, { ...body });
    return { ok: true as const };
  });

  mount(app, "setResourceProven", async ({ params, body }, c) => {
    await setProvenOverride(c.env.DB, params.slug, body.proven);
    await audit(c.env.DB, actor(c), "resource.proven", "resource", params.slug, { proven: body.proven });
    return { ok: true as const };
  });
  mount(app, "banUser", async ({ params, body }, c) => {
    const user = await c.env.DB.prepare(`SELECT id FROM users WHERE lower(username) = lower(?)`).bind(params.username).first<{ id: string }>();
    if (!user) throw notFound("User not found");
    await moderation.setBanned(c.env, actor(c), user.id, body.banned, body.reason);
    return { ok: true as const };
  });

  mount(app, "adminStats", async (_, c) => {
    const weekAgo = Date.now() - 7 * DAY_MS;
    const row = await c.env.DB.prepare(
      `SELECT
         (SELECT count(*) FROM users WHERE deleted_at IS NULL) AS users_total,
         (SELECT count(*) FROM users WHERE deleted_at IS NULL AND created_at >= ?1) AS users_7d,
         (SELECT count(*) FROM projects WHERE deleted_at IS NULL) AS projects_total,
         (SELECT count(*) FROM projects WHERE deleted_at IS NULL AND created_at >= ?1) AS projects_7d,
         (SELECT count(*) FROM projects WHERE deleted_at IS NULL AND license_spdx IS NULL) AS projects_unlicensed,
         (SELECT count(*) FROM candidates WHERE status = 'pending' OR (status = 'snoozed' AND snoozed_until <= ?2)) AS queue_pending,
         (SELECT coalesce(sum(json_array_length(messages)), 0) FROM chat_snapshots WHERE created_at >= ?1) AS chat_7d`,
    )
      .bind(weekAgo, Date.now())
      .first<Record<string, number>>();
    return {
      signups: { total: row?.users_total ?? 0, last7d: row?.users_7d ?? 0 },
      projects: { total: row?.projects_total ?? 0, last7d: row?.projects_7d ?? 0, unlicensed: row?.projects_unlicensed ?? 0 },
      // Fork-click and chat counters arrive with tasks 2.2 and 3.1.
      forkClicks: { last7d: 0 },
      chat: { messagesLast7d: row?.chat_7d ?? 0 },
      queue: { pending: row?.queue_pending ?? 0 },
    };
  });

  mount(app, "auditLog", async ({ query }, c) => {
    const limit = query.limit ?? 50;
    const cursor = decodeCursor(query.cursor);
    const { results } = await c.env.DB.prepare(
      `SELECT a.*, u.id AS u_id, u.username, u.display_name, u.avatar_url FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor
       ORDER BY a.created_at DESC, a.rowid DESC LIMIT ? OFFSET ?`,
    )
      .bind(limit + 1, cursor.o)
      .all<AuditRow>();
    const items: AuditLogEntry[] = results.slice(0, limit).map((r) => ({
      id: r.id,
      actor: r.u_id && r.username ? { id: r.u_id, username: r.username, displayName: r.display_name ?? r.username, avatarUrl: r.avatar_url, avatar: null } : null,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      // Console actions are made by Cloudflare Access identities; the raw actor is kept here.
      details: { ...parseJson<Record<string, unknown>>(r.details, {}), actor: r.actor },
      createdAt: new Date(r.created_at).toISOString(),
    }));
    return { items, nextCursor: results.length > limit ? encodeCursor({ o: cursor.o + limit }) : null };
  });
}

interface AuditRow {
  id: string;
  actor: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string | null;
  created_at: number;
  u_id: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}
