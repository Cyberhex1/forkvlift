/**
 * Profiles and account management: public profile, profile edits, showcase,
 * avatar, data export and account deletion.
 */
import { LIMITS, type AvatarConfig, type Profile, type ProfileLinks, type SessionUser } from "@forkvlift/shared";
import { HttpError, notFound } from "./errors";
import { randomToken } from "./ids";
import { LISTED, PROJECT_SELECT, parseJson, rowsToCards, type ProjectRow } from "./projects/rows";
import { syncProjectSearch } from "./projects/search";

/** Usernames that would collide with routes or look official. */
const RESERVED = new Set(["admin", "administrator", "api", "settings", "studio", "forum", "plaza", "resources", "requests", "alternatives", "about", "help", "support", "moderator", "mod", "staff", "system", "root", "null", "undefined", "forklift", "forkvlift", "deleted"]);

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  github_login: string | null;
  created_at: number;
  bio: string | null;
  location: string | null;
  links: string | null;
  showcase: string | null;
  settings: string | null;
  avatar: string | null;
}

const EMPTY_LINKS: ProfileLinks = { github: null, website: null, socials: [], donation: null };

export async function getProfile(db: D1Database, username: string, viewer: SessionUser | null): Promise<Profile> {
  const u = await db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.github_login, u.created_at,
         pr.bio, pr.location, pr.links, pr.showcase, pr.settings, av.config AS avatar
       FROM users u LEFT JOIN profiles pr ON pr.user_id = u.id LEFT JOIN avatars av ON av.user_id = u.id
       WHERE lower(u.username) = lower(?) AND u.deleted_at IS NULL AND u.banned_at IS NULL`,
    )
    .bind(username)
    .first<UserRow>();
  if (!u) throw notFound("User not found");
  const isSelf = viewer?.id === u.id;

  const [stats, badges, following, blocked] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT
           (SELECT count(*) FROM projects p WHERE p.owner_id = ?1 AND ${LISTED}) AS projects,
           (SELECT coalesce(sum(p.forks), 0) FROM projects p WHERE p.owner_id = ?1 AND p.deleted_at IS NULL) AS forks_of_work,
           (SELECT count(DISTINCT c.owner_id) FROM forks f JOIN projects par ON par.id = f.parent_id JOIN projects c ON c.id = f.child_id
              WHERE par.owner_id = ?1 AND c.owner_id IS NOT NULL AND c.owner_id != ?1) AS forked_by`,
      )
      .bind(u.id),
    db.prepare(`SELECT b.key, b.name, b.description, b.icon_key, ub.created_at AS awarded_at FROM user_badges ub JOIN badges b ON b.key = ub.badge_key WHERE ub.user_id = ? ORDER BY ub.created_at`).bind(u.id),
    db.prepare(`SELECT 1 AS yes FROM follows WHERE follower_id = ? AND target_type = 'user' AND target_id = ?`).bind(viewer?.id ?? "", u.id),
    db.prepare(`SELECT 1 AS yes FROM blocks WHERE blocker_id = ? AND blocked_id = ? AND kind = 'block'`).bind(viewer?.id ?? "", u.id),
  ]);
  const s = (stats?.results[0] ?? {}) as { projects?: number; forks_of_work?: number; forked_by?: number };

  // Showcase: pinned ids, in the owner's order; unlicensed only shown to the owner.
  const pinned = parseJson<string[]>(u.showcase, []).slice(0, LIMITS.showcaseMax);
  let showcase: Profile["showcase"] = [];
  if (pinned.length) {
    const { results } = await db
      .prepare(`${PROJECT_SELECT} WHERE p.id IN (${pinned.map(() => "?").join(",")}) AND p.owner_id = ? AND ${LISTED}${isSelf ? "" : " AND p.license_spdx IS NOT NULL"}`)
      .bind(...pinned, u.id)
      .all<ProjectRow>();
    const cards = await rowsToCards(db, results, viewer?.id ?? null);
    showcase = pinned.map((id) => cards.find((c) => c.id === id)).filter((c) => c !== undefined);
  }

  return {
    user: { id: u.id, username: u.username, displayName: u.display_name, avatarUrl: u.avatar_url, avatar: parseJson<AvatarConfig | null>(u.avatar, null) },
    bio: u.bio ?? "",
    location: u.location,
    links: { ...EMPTY_LINKS, ...parseJson<Partial<ProfileLinks>>(u.links, {}) },
    stats: { projects: Number(s.projects ?? 0), forksOfWork: Number(s.forks_of_work ?? 0), forkedBy: Number(s.forked_by ?? 0) },
    badges: ((badges?.results ?? []) as { key: string; name: string; description: string; icon_key: string; awarded_at: number }[]).map((b) => ({
      badge: { key: b.key, name: b.name, description: b.description, iconKey: b.icon_key },
      awardedAt: new Date(b.awarded_at).toISOString(),
    })),
    showcase,
    joinedAt: new Date(u.created_at).toISOString(),
    // Live presence (respecting hideOnlineStatus) arrives with the Plaza, task 3.2.
    online: null,
    viewer: viewer ? { isSelf, following: Boolean(following?.results.length), blocked: Boolean(blocked?.results.length) } : null,
  };
}

export async function updateMe(
  db: D1Database,
  user: SessionUser,
  patch: { username?: string; displayName?: string; bio?: string; location?: string | null; links?: ProfileLinks },
): Promise<Profile> {
  const userSets: string[] = ["updated_at = ?"];
  const userBinds: unknown[] = [Date.now()];
  if (patch.username !== undefined && patch.username !== user.username) {
    const lower = patch.username.toLowerCase();
    if (RESERVED.has(lower)) throw new HttpError("invalid_request", "That username is reserved.");
    const taken = await db.prepare(`SELECT 1 FROM users WHERE lower(username) = ? AND id != ?`).bind(lower, user.id).first();
    if (taken) throw new HttpError("conflict", "That username is taken.");
    userSets.push("username = ?");
    userBinds.push(patch.username);
  }
  if (patch.displayName !== undefined) {
    const name = patch.displayName.trim();
    if (!name) throw new HttpError("invalid_request", "Display name can't be empty.");
    userSets.push("display_name = ?");
    userBinds.push(name);
  }
  const profileSets: string[] = ["updated_at = ?"];
  const profileBinds: unknown[] = [Date.now()];
  if (patch.bio !== undefined) {
    profileSets.push("bio = ?");
    profileBinds.push(patch.bio);
  }
  if (patch.location !== undefined) {
    profileSets.push("location = ?");
    profileBinds.push(patch.location);
  }
  if (patch.links !== undefined) {
    profileSets.push("links = ?");
    profileBinds.push(JSON.stringify(patch.links));
  }
  await db.batch([
    db.prepare(`UPDATE users SET ${userSets.join(", ")} WHERE id = ?`).bind(...userBinds, user.id),
    db.prepare(`INSERT OR IGNORE INTO profiles (user_id) VALUES (?)`).bind(user.id),
    db.prepare(`UPDATE profiles SET ${profileSets.join(", ")} WHERE user_id = ?`).bind(...profileBinds, user.id),
  ]);
  return getProfile(db, patch.username ?? user.username, { ...user, username: patch.username ?? user.username });
}

export async function setShowcase(db: D1Database, userId: string, projectIds: string[]): Promise<string[]> {
  const ids = [...new Set(projectIds)].slice(0, LIMITS.showcaseMax);
  if (ids.length) {
    const { results } = await db
      .prepare(`SELECT p.id FROM projects p WHERE p.id IN (${ids.map(() => "?").join(",")}) AND p.owner_id = ? AND ${LISTED}`)
      .bind(...ids, userId)
      .all<{ id: string }>();
    if (results.length !== ids.length) throw new HttpError("invalid_request", "You can only pin your own public projects.");
  }
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO profiles (user_id) VALUES (?)`).bind(userId),
    db.prepare(`UPDATE profiles SET showcase = ?, updated_at = ? WHERE user_id = ?`).bind(JSON.stringify(ids), Date.now(), userId),
  ]);
  return ids;
}

export async function updateAvatar(db: D1Database, userId: string, config: AvatarConfig): Promise<AvatarConfig> {
  await db
    .prepare(`INSERT INTO avatars (user_id, config, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(user_id) DO UPDATE SET config = ?2, updated_at = ?3`)
    .bind(userId, JSON.stringify(config), Date.now())
    .run();
  return config;
}

/** Everything the user made, as one JSON document (GDPR-style export). */
export async function buildExport(db: D1Database, userId: string): Promise<Record<string, unknown>> {
  const q = (sql: string) => db.prepare(sql).bind(userId);
  const [user, profile, avatar, projects, board, columns, cards, collections, items, follows, blocks, comments, threads, posts, messages, collabs, resources, votes] =
    await db.batch<Record<string, unknown>>([
      q(`SELECT id, username, display_name, email, github_login, avatar_url, role, created_at FROM users WHERE id = ?`),
      q(`SELECT bio, location, links, showcase, settings FROM profiles WHERE user_id = ?`),
      q(`SELECT config FROM avatars WHERE user_id = ?`),
      q(`SELECT * FROM projects WHERE owner_id = ?`),
      q(`SELECT * FROM boards WHERE user_id = ?`),
      q(`SELECT c.* FROM board_columns c JOIN boards b ON b.id = c.board_id WHERE b.user_id = ?`),
      q(`SELECT c.* FROM board_cards c JOIN boards b ON b.id = c.board_id WHERE b.user_id = ?`),
      q(`SELECT * FROM collections WHERE owner_id = ?`),
      q(`SELECT i.* FROM collection_items i JOIN collections c ON c.id = i.collection_id WHERE c.owner_id = ?`),
      q(`SELECT target_type, target_id, created_at FROM follows WHERE follower_id = ?`),
      q(`SELECT blocked_id, kind, created_at FROM blocks WHERE blocker_id = ?`),
      q(`SELECT id, project_id, parent_id, body, created_at, deleted_at FROM comments WHERE author_id = ?`),
      q(`SELECT id, board_slug, title, tags, created_at, deleted_at FROM threads WHERE author_id = ?`),
      q(`SELECT id, thread_id, body_md, created_at, deleted_at FROM posts WHERE author_id = ?`),
      q(`SELECT id, conversation_id, body, created_at FROM messages WHERE sender_id = ?`),
      q(`SELECT * FROM collab_requests WHERE from_id = ?1 OR to_id = ?1`),
      q(`SELECT * FROM resources WHERE author_id = ?`),
      q(`SELECT target_type, target_id, value, created_at FROM votes WHERE user_id = ?`),
    ]);
  const rows = (r: D1Result<Record<string, unknown>> | undefined) => r?.results ?? [];
  return {
    exportedAt: new Date().toISOString(),
    user: rows(user)[0] ?? null,
    profile: rows(profile)[0] ?? null,
    avatar: rows(avatar)[0] ?? null,
    projects: rows(projects),
    studio: { board: rows(board)[0] ?? null, columns: rows(columns), cards: rows(cards) },
    collections: { collections: rows(collections), items: rows(items) },
    follows: rows(follows),
    blocks: rows(blocks),
    comments: rows(comments),
    forum: { threads: rows(threads), posts: rows(posts) },
    messagesSent: rows(messages),
    collabRequests: rows(collabs),
    resources: rows(resources),
    votes: rows(votes),
  };
}

/**
 * Delete the account. Personal data and the user's projects, comments and posts
 * are removed; threads others replied to stay, credited to "Deleted user".
 */
export async function deleteAccount(db: D1Database, user: SessionUser, confirmUsername: string): Promise<void> {
  if (confirmUsername.toLowerCase() !== user.username.toLowerCase()) throw new HttpError("invalid_request", "Type your username exactly to confirm.");
  const now = Date.now();
  const { results: owned } = await db.prepare(`SELECT id FROM projects WHERE owner_id = ? AND deleted_at IS NULL`).bind(user.id).all<{ id: string }>();
  const u = user.id;
  await db.batch([
    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(u),
    db.prepare(`DELETE FROM profiles WHERE user_id = ?`).bind(u),
    db.prepare(`DELETE FROM avatars WHERE user_id = ?`).bind(u),
    db.prepare(`DELETE FROM follows WHERE follower_id = ?1 OR (target_type = 'user' AND target_id = ?1)`).bind(u),
    db.prepare(`DELETE FROM blocks WHERE blocker_id = ?1 OR blocked_id = ?1`).bind(u),
    db.prepare(`DELETE FROM collections WHERE owner_id = ?`).bind(u),
    db.prepare(`DELETE FROM boards WHERE user_id = ?`).bind(u),
    db.prepare(`DELETE FROM notifications WHERE user_id = ?`).bind(u),
    db.prepare(`DELETE FROM votes WHERE user_id = ?`).bind(u),
    db.prepare(`UPDATE projects SET deleted_at = ?, is_public = 0 WHERE owner_id = ? AND deleted_at IS NULL`).bind(now, u),
    db.prepare(`UPDATE comments SET deleted_at = ?, body = '' WHERE author_id = ? AND deleted_at IS NULL`).bind(now, u),
    db.prepare(`UPDATE posts SET deleted_at = ?, body_md = '' WHERE author_id = ? AND deleted_at IS NULL`).bind(now, u),
    db.prepare(`UPDATE messages SET body = '', deleted_at = ? WHERE sender_id = ? AND deleted_at IS NULL`).bind(now, u),
    db
      .prepare(
        `UPDATE users SET username = ?, display_name = 'Deleted user', email = NULL, github_id = NULL, github_login = NULL,
           avatar_url = NULL, deleted_at = ?, updated_at = ? WHERE id = ?`,
      )
      .bind(`deleted-${randomToken(9).replace(/[^A-Za-z0-9]/g, "x").toLowerCase()}`, now, now, u),
  ]);
  for (const p of owned) await syncProjectSearch(db, p.id);
}
