/**
 * Task 2.4: direct messages, collab requests, blocks and mutes.
 *
 * Rules: you can't message or request someone who blocked you (or whom you
 * blocked); the recipient's DM policy (everyone / followers / nobody) applies to
 * starting a conversation; muting only silences notifications.
 */
import type { BlockedUser, CollabRequest, Conversation, DirectMessage, DmPolicy, SessionUser, UserSummary } from "@forkvlift/shared";
import { afterCollabAccepted } from "./badges";
import { HttpError, notFound } from "./errors";
import { newId } from "./ids";
import { notificationStatements } from "./notify";
import { decodeCursor, encodeCursor } from "./projects/list";
import { parseJson } from "./projects/rows";

interface UserLite {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar: string | null;
}
const USER_COLS = `u.id, u.username, u.display_name, u.avatar_url, av.config AS avatar`;
const toUser = (u: UserLite): UserSummary => ({ id: u.id, username: u.username, displayName: u.display_name, avatarUrl: u.avatar_url, avatar: parseJson(u.avatar, null) });

async function userByName(db: D1Database, username: string): Promise<UserLite & { settings: string | null }> {
  const u = await db
    .prepare(
      `SELECT ${USER_COLS}, pr.settings FROM users u LEFT JOIN avatars av ON av.user_id = u.id LEFT JOIN profiles pr ON pr.user_id = u.id
       WHERE lower(u.username) = lower(?) AND u.deleted_at IS NULL AND u.banned_at IS NULL`,
    )
    .bind(username)
    .first<UserLite & { settings: string | null }>();
  if (!u) throw notFound("User not found");
  return u;
}

/** True when either side has blocked the other (mutes don't count). */
async function blockedBetween(db: D1Database, a: string, b: string): Promise<boolean> {
  return Boolean(
    await db
      .prepare(`SELECT 1 FROM blocks WHERE kind = 'block' AND ((blocker_id = ?1 AND blocked_id = ?2) OR (blocker_id = ?2 AND blocked_id = ?1))`)
      .bind(a, b)
      .first(),
  );
}

const CANT_REACH = "You can't contact this person.";

// ── Conversations ────────────────────────────────────────────────────────

export async function listConversations(db: D1Database, userId: string, cursorValue: string | undefined, limit = 30) {
  const cursor = decodeCursor(cursorValue);
  const { results } = await db
    .prepare(
      `SELECT c.id, c.updated_at,
         (SELECT body FROM messages m WHERE m.conversation_id = c.id AND m.deleted_at IS NULL ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS last_body,
         (SELECT count(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != ?1 AND m.deleted_at IS NULL
            AND m.created_at > coalesce(me.last_read_at, 0)) AS unread
       FROM conversations c JOIN conversation_members me ON me.conversation_id = c.id AND me.user_id = ?1
       ORDER BY c.updated_at DESC, c.id LIMIT ?2 OFFSET ?3`,
    )
    .bind(userId, limit + 1, cursor.o)
    .all<{ id: string; updated_at: number; last_body: string | null; unread: number }>();
  const page = results.slice(0, limit);
  const members = await membersOf(db, page.map((r) => r.id));
  const items: Conversation[] = page.map((r) => ({
    id: r.id,
    participants: members.get(r.id) ?? [],
    lastMessagePreview: r.last_body ? r.last_body.slice(0, 200) : null,
    unreadCount: r.unread,
    updatedAt: new Date(r.updated_at).toISOString(),
  }));
  return { items, nextCursor: results.length > limit ? encodeCursor({ o: cursor.o + limit }) : null };
}

async function membersOf(db: D1Database, ids: string[]): Promise<Map<string, UserSummary[]>> {
  const map = new Map<string, UserSummary[]>();
  if (!ids.length) return map;
  const { results } = await db
    .prepare(
      `SELECT cm.conversation_id, ${USER_COLS} FROM conversation_members cm JOIN users u ON u.id = cm.user_id LEFT JOIN avatars av ON av.user_id = u.id
       WHERE cm.conversation_id IN (${ids.map(() => "?").join(",")})`,
    )
    .bind(...ids)
    .all<UserLite & { conversation_id: string }>();
  for (const r of results) map.set(r.conversation_id, [...(map.get(r.conversation_id) ?? []), toUser(r)]);
  return map;
}

async function assertMember(db: D1Database, conversationId: string, userId: string): Promise<string[]> {
  const { results } = await db.prepare(`SELECT user_id FROM conversation_members WHERE conversation_id = ?`).bind(conversationId).all<{ user_id: string }>();
  const ids = results.map((r) => r.user_id);
  if (!ids.includes(userId)) throw notFound("Conversation not found");
  return ids;
}

function dmAllowed(policy: DmPolicy, recipientFollowsSender: boolean): boolean {
  return policy === "everyone" || (policy === "followers" && recipientFollowsSender);
}

export async function startConversation(db: D1Database, sender: SessionUser, username: string, body: string): Promise<Conversation> {
  const to = await userByName(db, username);
  if (to.id === sender.id) throw new HttpError("bad_request", "You can't message yourself.");
  if (await blockedBetween(db, sender.id, to.id)) throw new HttpError("forbidden", CANT_REACH);

  // Reuse the existing one-to-one conversation if there is one.
  const existing = await db
    .prepare(
      `SELECT a.conversation_id AS id FROM conversation_members a JOIN conversation_members b ON b.conversation_id = a.conversation_id
       WHERE a.user_id = ? AND b.user_id = ? AND (SELECT count(*) FROM conversation_members x WHERE x.conversation_id = a.conversation_id) = 2 LIMIT 1`,
    )
    .bind(sender.id, to.id)
    .first<{ id: string }>();

  if (!existing) {
    const policy = (parseJson<{ dmPolicy?: DmPolicy }>(to.settings, {}).dmPolicy ?? "everyone") as DmPolicy;
    const follows = Boolean(
      await db.prepare(`SELECT 1 FROM follows WHERE follower_id = ? AND target_type = 'user' AND target_id = ?`).bind(to.id, sender.id).first(),
    );
    if (!dmAllowed(policy, follows)) {
      throw new HttpError("forbidden", policy === "nobody" ? `@${to.username} isn't accepting messages.` : `@${to.username} only accepts messages from people they follow.`);
    }
  }

  const id = existing?.id ?? newId("conv");
  const now = Date.now();
  await db.batch([
    ...(existing
      ? []
      : [
          db.prepare(`INSERT INTO conversations (id, created_at, updated_at) VALUES (?, ?, ?)`).bind(id, now, now),
          db.prepare(`INSERT INTO conversation_members (conversation_id, user_id, last_read_at) VALUES (?, ?, ?)`).bind(id, sender.id, now),
          db.prepare(`INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)`).bind(id, to.id),
        ]),
    ...messageStatements(db, id, sender, body, [to.id], now),
  ]);
  const list = await listConversations(db, sender.id, undefined, 100);
  return list.items.find((c) => c.id === id)!;
}

function messageStatements(db: D1Database, conversationId: string, sender: SessionUser, body: string, recipients: string[], now: number) {
  return [
    db.prepare(`INSERT INTO messages (id, conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)`).bind(newId("msg"), conversationId, sender.id, body, now),
    db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).bind(now, conversationId),
    db.prepare(`UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?`).bind(now, conversationId, sender.id),
    ...notificationStatements(
      db,
      recipients.map((userId) => ({ userId, type: "message" as const, actorId: sender.id, title: `New message from ${sender.displayName}`, href: `/messages?c=${conversationId}` })),
    ),
  ];
}

export async function listMessages(db: D1Database, userId: string, conversationId: string, cursorValue: string | undefined, limit = 50) {
  await assertMember(db, conversationId, userId);
  const cursor = decodeCursor(cursorValue);
  const { results } = await db
    .prepare(
      `SELECT m.id AS msg_id, m.conversation_id, m.body, m.created_at, ${USER_COLS} FROM messages m JOIN users u ON u.id = m.sender_id LEFT JOIN avatars av ON av.user_id = u.id
       WHERE m.conversation_id = ? AND m.deleted_at IS NULL ORDER BY m.created_at DESC, m.rowid DESC LIMIT ? OFFSET ?`,
    )
    .bind(conversationId, limit + 1, cursor.o)
    .all<UserLite & { msg_id: string; conversation_id: string; body: string; created_at: number }>();
  // Reading the newest page marks the conversation read.
  if (cursor.o === 0) await db.prepare(`UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?`).bind(Date.now(), conversationId, userId).run();
  const items: DirectMessage[] = results.slice(0, limit).map((r) => ({
    id: r.msg_id,
    conversationId: r.conversation_id,
    sender: toUser(r),
    body: r.body,
    createdAt: new Date(r.created_at).toISOString(),
  }));
  return { items, nextCursor: results.length > limit ? encodeCursor({ o: cursor.o + limit }) : null };
}

export async function sendMessage(db: D1Database, sender: SessionUser, conversationId: string, body: string): Promise<DirectMessage> {
  const members = await assertMember(db, conversationId, sender.id);
  const others = members.filter((m) => m !== sender.id);
  for (const other of others) if (await blockedBetween(db, sender.id, other)) throw new HttpError("forbidden", CANT_REACH);
  const now = Date.now();
  await db.batch(messageStatements(db, conversationId, sender, body, others, now));
  const { items } = await listMessages(db, sender.id, conversationId, undefined, 1);
  return items[0]!;
}

// ── Collab requests ──────────────────────────────────────────────────────

interface CollabRow {
  id: string;
  kind: CollabRequest["kind"];
  role: string;
  availability: string;
  message: string;
  status: CollabRequest["status"];
  created_at: number;
  project_id: string | null;
  p_slug: string | null;
  p_name: string | null;
  from_json: string;
  to_json: string;
}

const COLLAB_SELECT = `
  SELECT r.id, r.kind, r.role, r.availability, r.message, r.status, r.created_at, r.project_id, p.slug AS p_slug, p.name AS p_name,
    json_object('id', f.id, 'username', f.username, 'displayName', f.display_name, 'avatarUrl', f.avatar_url) AS from_json,
    json_object('id', t.id, 'username', t.username, 'displayName', t.display_name, 'avatarUrl', t.avatar_url) AS to_json
  FROM collab_requests r
  JOIN users f ON f.id = r.from_id JOIN users t ON t.id = r.to_id
  LEFT JOIN projects p ON p.id = r.project_id AND p.deleted_at IS NULL`;

function toCollab(r: CollabRow): CollabRequest {
  const from = { ...(JSON.parse(r.from_json) as Omit<UserSummary, "avatar">), avatar: null };
  const to = { ...(JSON.parse(r.to_json) as Omit<UserSummary, "avatar">), avatar: null };
  return {
    id: r.id,
    from,
    to,
    project: r.project_id && r.p_slug ? { id: r.project_id, slug: r.p_slug, name: r.p_name ?? r.p_slug, author: to } : null,
    kind: r.kind,
    role: r.role,
    availability: r.availability,
    message: r.message,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function listCollabRequests(db: D1Database, userId: string, box: "inbox" | "sent", cursorValue: string | undefined, limit = 30) {
  const cursor = decodeCursor(cursorValue);
  const { results } = await db
    .prepare(`${COLLAB_SELECT} WHERE ${box === "sent" ? "r.from_id" : "r.to_id"} = ? ORDER BY r.status = 'pending' DESC, r.created_at DESC LIMIT ? OFFSET ?`)
    .bind(userId, limit + 1, cursor.o)
    .all<CollabRow>();
  return { items: results.slice(0, limit).map(toCollab), nextCursor: results.length > limit ? encodeCursor({ o: cursor.o + limit }) : null };
}

const KIND_LABEL: Record<CollabRequest["kind"], string> = {
  collab: "wants to collaborate",
  build_permission: "asked for permission to build on",
  adoption: "offered to adopt",
};

export async function createCollabRequest(
  db: D1Database,
  sender: SessionUser,
  input: { toUsername: string; projectId: string | null; kind: CollabRequest["kind"]; role: string; availability: string; message: string },
): Promise<CollabRequest> {
  const to = await userByName(db, input.toUsername);
  if (to.id === sender.id) throw new HttpError("bad_request", "You can't send a request to yourself.");
  if (await blockedBetween(db, sender.id, to.id)) throw new HttpError("forbidden", CANT_REACH);

  let projectName: string | null = null;
  if (input.projectId) {
    const project = await db.prepare(`SELECT owner_id, name FROM projects WHERE id = ? AND deleted_at IS NULL`).bind(input.projectId).first<{ owner_id: string | null; name: string }>();
    if (!project) throw new HttpError("invalid_request", "Unknown project");
    const ownerOk = input.kind === "collab" ? project.owner_id === to.id || project.owner_id === sender.id : project.owner_id === to.id;
    if (!ownerOk) throw new HttpError("invalid_request", "That project doesn't belong to the person you're asking.");
    projectName = project.name;
  } else if (input.kind !== "collab") {
    throw new HttpError("invalid_request", "Permission and adoption requests need a project.");
  }

  const dup = await db
    .prepare(`SELECT 1 FROM collab_requests WHERE from_id = ? AND to_id = ? AND kind = ? AND coalesce(project_id, '') = coalesce(?, '') AND status = 'pending'`)
    .bind(sender.id, to.id, input.kind, input.projectId)
    .first();
  if (dup) throw new HttpError("conflict", "You already have a pending request like this one.");

  const id = newId("collab");
  await db.batch([
    db
      .prepare(
        `INSERT INTO collab_requests (id, from_id, to_id, project_id, kind, role, availability, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, sender.id, to.id, input.projectId, input.kind, input.role, input.availability, input.message, Date.now()),
    ...notificationStatements(db, [
      {
        userId: to.id,
        type: "collab_request",
        actorId: sender.id,
        title: `${sender.displayName} ${KIND_LABEL[input.kind]}${projectName ? ` ${projectName}` : " with you"}`,
        href: "/messages?tab=requests",
      },
    ]),
  ]);
  return toCollab((await db.prepare(`${COLLAB_SELECT} WHERE r.id = ?`).bind(id).first<CollabRow>())!);
}

export async function respondCollabRequest(db: D1Database, user: SessionUser, id: string, accept: boolean): Promise<CollabRequest> {
  const row = await db.prepare(`SELECT from_id, to_id, status FROM collab_requests WHERE id = ?`).bind(id).first<{ from_id: string; to_id: string; status: string }>();
  if (!row || row.to_id !== user.id) throw notFound("Request not found");
  if (row.status !== "pending") throw new HttpError("conflict", "You've already answered this request.");
  const status = accept ? "accepted" : "declined";
  await db.batch([
    db.prepare(`UPDATE collab_requests SET status = ?, responded_at = ? WHERE id = ?`).bind(status, Date.now(), id),
    ...notificationStatements(db, [
      { userId: row.from_id, type: "collab_request", actorId: user.id, title: `${user.displayName} ${status} your request`, href: "/messages?tab=requests" },
    ]),
  ]);
  if (accept) await afterCollabAccepted(db, row.from_id);
  return toCollab((await db.prepare(`${COLLAB_SELECT} WHERE r.id = ?`).bind(id).first<CollabRow>())!);
}

// ── Blocks and mutes ─────────────────────────────────────────────────────

export async function listBlocks(db: D1Database, userId: string): Promise<BlockedUser[]> {
  const { results } = await db
    .prepare(`SELECT b.kind, b.created_at, ${USER_COLS} FROM blocks b JOIN users u ON u.id = b.blocked_id LEFT JOIN avatars av ON av.user_id = u.id WHERE b.blocker_id = ? ORDER BY b.created_at DESC`)
    .bind(userId)
    .all<UserLite & { kind: "block" | "mute"; created_at: number }>();
  return results.map((r) => ({ user: toUser(r), kind: r.kind, createdAt: new Date(r.created_at).toISOString() }));
}

export async function blockUser(db: D1Database, userId: string, username: string, kind: "block" | "mute"): Promise<void> {
  const target = await userByName(db, username);
  if (target.id === userId) throw new HttpError("bad_request", "You can't block yourself.");
  await db.batch([
    db
      .prepare(`INSERT INTO blocks (blocker_id, blocked_id, kind, created_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(blocker_id, blocked_id) DO UPDATE SET kind = ?3`)
      .bind(userId, target.id, kind, Date.now()),
    // A block also ends any follow in either direction.
    ...(kind === "block"
      ? [db.prepare(`DELETE FROM follows WHERE target_type = 'user' AND ((follower_id = ?1 AND target_id = ?2) OR (follower_id = ?2 AND target_id = ?1))`).bind(userId, target.id)]
      : []),
  ]);
}

export async function unblockUser(db: D1Database, userId: string, username: string): Promise<void> {
  const target = await userByName(db, username);
  await db.prepare(`DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?`).bind(userId, target.id).run();
}
