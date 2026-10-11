/**
 * Task 3.4: reports, the moderation queue, bans, and chat snapshots.
 * Every moderator action lands in the audit log.
 */
import type { Report, ReportReason, ReportTarget } from "@forkvlift/shared";
import { audit } from "./curation/candidates";
import { HttpError, notFound } from "./errors";
import { newId } from "./ids";
import { decodeCursor, encodeCursor } from "./projects/list";
import { syncProjectSearch } from "./projects/search";
import type { StoredMessage } from "../durable/chat-room";

/** Chat message reports use "<channel>:<messageId>" as the target id. */
export function chatTarget(channel: string, messageId: string): string {
  return `${channel}:${messageId}`;
}

interface TargetInfo {
  label: string;
  href: string;
  authorId: string | null;
}

/** What a report points at, for the queue, and who wrote it (for bans). */
export async function describeTarget(db: D1Database, type: ReportTarget, id: string): Promise<TargetInfo | null> {
  const one = <T>(sql: string, ...b: unknown[]) => db.prepare(sql).bind(...b).first<T>();
  switch (type) {
    case "project": {
      const p = await one<{ slug: string; name: string; owner_id: string | null }>(`SELECT slug, name, owner_id FROM projects WHERE id = ?`, id);
      return p ? { label: `Project: ${p.name}`, href: `/p/${p.slug}`, authorId: p.owner_id } : null;
    }
    case "comment": {
      const c = await one<{ author_id: string; slug: string; name: string }>(`SELECT c.author_id, p.slug, p.name FROM comments c JOIN projects p ON p.id = c.project_id WHERE c.id = ?`, id);
      return c ? { label: `Comment on ${c.name}`, href: `/p/${c.slug}#comment-${id}`, authorId: c.author_id } : null;
    }
    case "thread": {
      const t = await one<{ title: string; author_id: string }>(`SELECT title, author_id FROM threads WHERE id = ?`, id);
      return t ? { label: `Thread: ${t.title}`, href: `/forum/t/${id}`, authorId: t.author_id } : null;
    }
    case "post": {
      const p = await one<{ thread_id: string; title: string; author_id: string }>(`SELECT p.thread_id, t.title, p.author_id FROM posts p JOIN threads t ON t.id = p.thread_id WHERE p.id = ?`, id);
      return p ? { label: `Reply in "${p.title}"`, href: `/forum/t/${p.thread_id}#post-${id}`, authorId: p.author_id } : null;
    }
    case "resource": {
      const r = await one<{ slug: string; title: string; author_id: string }>(`SELECT slug, title, author_id FROM resources WHERE id = ?`, id);
      return r ? { label: `Resource: ${r.title}`, href: `/resources/${r.slug}`, authorId: r.author_id } : null;
    }
    case "showcase": {
      const s = await one<{ slug: string; title: string; owner_id: string }>(`SELECT slug, title, owner_id FROM showcases WHERE id = ?`, id);
      return s ? { label: `Showcase: ${s.title}`, href: `/showcase/${s.slug}`, authorId: s.owner_id } : null;
    }
    case "showcase_comment": {
      const c = await one<{ author_id: string; slug: string; title: string }>(`SELECT c.author_id, s.slug, s.title FROM showcase_comments c JOIN showcases s ON s.id = c.showcase_id WHERE c.id = ?`, id);
      return c ? { label: `Comment on showcase ${c.title}`, href: `/showcase/${c.slug}#comment-${id}`, authorId: c.author_id } : null;
    }
    case "user": {
      const u = await one<{ username: string }>(`SELECT username FROM users WHERE id = ?`, id);
      return u ? { label: `User @${u.username}`, href: `/u/${u.username}`, authorId: id } : null;
    }
    case "chat_message": {
      const [channel, messageId] = id.split(":");
      const author = await one<{ author_id: string }>(`SELECT json_extract(value, '$.authorId') AS author_id FROM chat_snapshots, json_each(chat_snapshots.messages) WHERE json_extract(value, '$.id') = ? LIMIT 1`, messageId);
      return channel && messageId ? { label: `Chat message in #${channel}`, href: `/plaza?channel=${channel}`, authorId: author?.author_id ?? null } : null;
    }
  }
}

export async function createReport(db: D1Database, reporterId: string, input: { targetType: ReportTarget; targetId: string; reason: ReportReason; note: string }): Promise<void> {
  const target = await describeTarget(db, input.targetType, input.targetId);
  if (!target) throw notFound("That's already gone.");
  if (target.authorId === reporterId && input.targetType !== "chat_message") throw new HttpError("bad_request", "You can't report your own content.");
  const dup = await db
    .prepare(`SELECT 1 FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status = 'open'`)
    .bind(reporterId, input.targetType, input.targetId)
    .first();
  if (dup) return; // Already reported by this person; nothing new to queue.
  await db
    .prepare(`INSERT INTO reports (id, reporter_id, target_type, target_id, reason, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(newId("rep"), reporterId, input.targetType, input.targetId, input.reason, input.note, Date.now())
    .run();
}

interface ReportRow {
  id: string;
  target_type: ReportTarget;
  target_id: string;
  reason: ReportReason;
  note: string;
  status: Report["status"];
  created_at: number;
  r_id: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export async function listReports(db: D1Database, status: Report["status"], cursorValue: string | undefined, limit = 30) {
  const cursor = decodeCursor(cursorValue);
  const { results } = await db
    .prepare(
      `SELECT r.*, u.id AS r_id, u.username, u.display_name, u.avatar_url FROM reports r LEFT JOIN users u ON u.id = r.reporter_id
       WHERE r.status = ? ORDER BY r.created_at ${status === "open" ? "ASC" : "DESC"} LIMIT ? OFFSET ?`,
    )
    .bind(status, limit + 1, cursor.o)
    .all<ReportRow>();
  const items: Report[] = [];
  for (const r of results.slice(0, limit)) {
    const target = await describeTarget(db, r.target_type, r.target_id);
    items.push({
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: r.reason,
      note: r.note,
      status: r.status,
      reporter: r.r_id && r.username ? { id: r.r_id, username: r.username, displayName: r.display_name ?? r.username, avatarUrl: r.avatar_url, avatar: null } : null,
      targetLabel: target?.label ?? null,
      targetHref: target?.href ?? null,
      createdAt: new Date(r.created_at).toISOString(),
    });
  }
  return { items, nextCursor: results.length > limit ? encodeCursor({ o: cursor.o + limit }) : null };
}

export async function resolveReport(
  env: Env,
  actor: string,
  id: string,
  input: { outcome: "resolved" | "dismissed"; action: "none" | "hide" | "delete" | "ban_user"; note: string },
): Promise<Report> {
  const db = env.DB;
  const report = await db.prepare(`SELECT * FROM reports WHERE id = ?`).bind(id).first<ReportRow>();
  if (!report) throw notFound("Report not found");
  const target = await describeTarget(db, report.target_type, report.target_id);
  const now = Date.now();

  if (input.action === "hide" || input.action === "delete") await removeContent(env, report.target_type, report.target_id, input.action);
  if (input.action === "ban_user") {
    if (!target?.authorId) throw new HttpError("bad_request", "Couldn't tell who wrote this, so nobody was banned.");
    await setBanned(env, actor, target.authorId, true, input.note || `Report ${id}`);
  }
  // Close every open report about the same thing.
  await db
    .prepare(`UPDATE reports SET status = ?, resolved_by = ?, resolved_at = ? WHERE target_type = ? AND target_id = ? AND status = 'open'`)
    .bind(input.outcome, actor, now, report.target_type, report.target_id)
    .run();
  await audit(db, actor, `report.${input.outcome}`, report.target_type, report.target_id, { reportId: id, action: input.action, note: input.note });
  const listed = await listReports(db, input.outcome, undefined, 200);
  return listed.items.find((r) => r.id === id)!;
}

async function removeContent(env: Env, type: ReportTarget, id: string, how: "hide" | "delete") {
  const db = env.DB;
  const now = Date.now();
  switch (type) {
    case "project":
      await db.prepare(how === "hide" ? `UPDATE projects SET hidden_at = ? WHERE id = ?` : `UPDATE projects SET deleted_at = ?, is_public = 0 WHERE id = ?`).bind(now, id).run();
      await syncProjectSearch(db, id);
      break;
    case "comment":
      await db.batch([
        db.prepare(`UPDATE comments SET deleted_at = ? WHERE id = ?`).bind(now, id),
        db.prepare(`UPDATE projects SET comment_count = (SELECT count(*) FROM comments c WHERE c.project_id = projects.id AND c.deleted_at IS NULL) WHERE id = (SELECT project_id FROM comments WHERE id = ?)`).bind(id),
      ]);
      break;
    case "thread":
      await db.prepare(`UPDATE threads SET deleted_at = ? WHERE id = ?`).bind(now, id).run();
      break;
    case "post":
      await db.prepare(`UPDATE posts SET deleted_at = ? WHERE id = ?`).bind(now, id).run();
      break;
    case "resource":
      await db.prepare(`UPDATE resources SET deleted_at = ? WHERE id = ?`).bind(now, id).run();
      break;
    case "chat_message": {
      const [channel, messageId] = id.split(":");
      if (channel && messageId) await chatAdmin(env, channel, { action: "delete", messageId });
      break;
    }
    case "showcase":
      await db.prepare(how === "hide" ? `UPDATE showcases SET hidden_at = ? WHERE id = ?` : `UPDATE showcases SET deleted_at = ?, published_at = NULL WHERE id = ?`).bind(now, id).run();
      break;
    case "showcase_comment":
      await db.batch([
        db.prepare(`UPDATE showcase_comments SET deleted_at = ? WHERE id = ?`).bind(now, id),
        db.prepare(`UPDATE showcases SET comment_count = (SELECT count(*) FROM showcase_comments c WHERE c.showcase_id = showcases.id AND c.deleted_at IS NULL) WHERE id = (SELECT showcase_id FROM showcase_comments WHERE id = ?)`).bind(id),
      ]);
      break;
    case "user":
      break; // Users are banned, not hidden.
  }
}

export async function setBanned(env: Env, actor: string, userId: string, banned: boolean, reason: string): Promise<void> {
  const db = env.DB;
  const user = await db.prepare(`SELECT id, role FROM users WHERE id = ? AND deleted_at IS NULL`).bind(userId).first<{ id: string; role: string }>();
  if (!user) throw notFound("User not found");
  if (user.role === "admin") throw new HttpError("forbidden", "Admins can't be banned from the console.");
  await db.batch([
    db.prepare(`UPDATE users SET banned_at = ?, ban_reason = ? WHERE id = ?`).bind(banned ? Date.now() : null, banned ? reason : null, userId),
    ...(banned ? [db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId)] : []),
  ]);
  if (banned) await Promise.all(CHAT_CHANNEL_SLUGS.map((slug) => chatAdmin(env, slug, { action: "kick", userId })));
  await audit(db, actor, banned ? "user.ban" : "user.unban", "user", userId, { reason });
}

// ── Chat ─────────────────────────────────────────────────────────────────

export const CHAT_CHANNEL_SLUGS = ["general", "help", "showcase", "gamedev", "ai-and-agents", "developer-tools", "productivity", "creative-and-design"];

export async function chatAdmin(env: Env, channel: string, action: Record<string, unknown>): Promise<{ ok: true; slowModeSeconds: number }> {
  const stub = env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(channel));
  const res = await stub.fetch("https://chat-room/admin", { method: "POST", body: JSON.stringify(action) });
  return (await res.json()) as { ok: true; slowModeSeconds: number };
}

/** Nightly: copy new chat messages into D1 for moderation, and drop copies older than 90 days. */
export async function snapshotChat(env: Env): Promise<number> {
  const db = env.DB;
  let saved = 0;
  for (const channel of CHAT_CHANNEL_SLUGS) {
    const last = await db.prepare(`SELECT max(to_ts) AS t FROM chat_snapshots WHERE channel = ?`).bind(channel).first<{ t: number | null }>();
    const since = last?.t ?? 0;
    const stub = env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(channel));
    const messages = (await (await stub.fetch(`https://chat-room/export?since=${since}`)).json()) as (StoredMessage & { deleted: boolean })[];
    if (!messages.length) continue;
    const toTs = Math.max(...messages.map((m) => Date.parse(m.createdAt)));
    await db
      .prepare(`INSERT INTO chat_snapshots (id, channel, from_ts, to_ts, messages, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(newId("snap"), channel, since, toTs, JSON.stringify(messages), Date.now())
      .run();
    saved += messages.length;
  }
  await db.prepare(`DELETE FROM chat_snapshots WHERE created_at < ?`).bind(Date.now() - 90 * 86_400_000).run();
  return saved;
}
