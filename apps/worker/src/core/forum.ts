/**
 * Task 3.3: forum boards, threads, posts, votes, solved marking, and live
 * updates (new posts are pushed to the thread's LiveThread Durable Object).
 */
import type { ForumBoard, Post, SessionUser, Thread, ThreadDetail, ThreadLiveEvent } from "@forkvlift/shared";
import { afterSolution } from "./badges";
import { HttpError, notFound } from "./errors";
import { newId } from "./ids";
import { notificationStatements, type NewNotification } from "./notify";
import { decodeCursor, encodeCursor } from "./projects/list";
import { parseJson } from "./projects/rows";

interface ThreadRow {
  id: string;
  board_slug: string;
  title: string;
  tags: string | null;
  pinned: number;
  solved_post_id: string | null;
  upvotes: number;
  reply_count: number;
  created_at: number;
  last_activity_at: number;
  author_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar: string | null;
}
interface PostRow {
  id: string;
  thread_id: string;
  body_md: string;
  upvotes: number;
  created_at: number;
  edited_at: number | null;
  author_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar: string | null;
}

const AUTHOR = `u.id AS author_id, u.username, u.display_name, u.avatar_url, av.config AS avatar`;
const THREAD_SELECT = `SELECT t.*, ${AUTHOR} FROM threads t JOIN users u ON u.id = t.author_id LEFT JOIN avatars av ON av.user_id = u.id`;
const POST_SELECT = `SELECT p.id, p.thread_id, p.body_md, p.upvotes, p.created_at, p.edited_at, ${AUTHOR} FROM posts p JOIN users u ON u.id = p.author_id LEFT JOIN avatars av ON av.user_id = u.id`;
const MENTION = /(?:^|[^\w@])@([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)/g;

const author = (r: { author_id: string; username: string; display_name: string; avatar_url: string | null; avatar: string | null }) => ({
  id: r.author_id,
  username: r.username,
  displayName: r.display_name,
  avatarUrl: r.avatar_url,
  avatar: parseJson(r.avatar, null),
});

function toThread(r: ThreadRow): Thread {
  return {
    id: r.id,
    boardSlug: r.board_slug,
    title: r.title,
    author: author(r),
    tags: parseJson<string[]>(r.tags, []),
    upvotes: r.upvotes,
    replyCount: r.reply_count,
    solved: r.solved_post_id !== null,
    pinned: r.pinned === 1,
    createdAt: new Date(r.created_at).toISOString(),
    lastActivityAt: new Date(r.last_activity_at).toISOString(),
  };
}

function toPost(r: PostRow, solvedId: string | null): Post {
  return {
    id: r.id,
    threadId: r.thread_id,
    author: author(r),
    bodyMd: r.body_md,
    upvotes: r.upvotes,
    isSolution: r.id === solvedId,
    createdAt: new Date(r.created_at).toISOString(),
    editedAt: r.edited_at ? new Date(r.edited_at).toISOString() : null,
  };
}

export async function listBoards(db: D1Database): Promise<ForumBoard[]> {
  const { results } = await db
    .prepare(`SELECT b.slug, b.name, b.description, (SELECT count(*) FROM threads t WHERE t.board_slug = b.slug AND t.deleted_at IS NULL) AS n FROM forum_boards b ORDER BY b.position`)
    .all<{ slug: string; name: string; description: string; n: number }>();
  return results.map((r) => ({ slug: r.slug, name: r.name, description: r.description, threadCount: r.n }));
}

export async function listThreads(db: D1Database, board: string, q: { cursor?: string; limit?: number; sort?: "active" | "new" | "top" | "unsolved"; tag?: string }) {
  const exists = await db.prepare(`SELECT 1 FROM forum_boards WHERE slug = ?`).bind(board).first();
  if (!exists) throw notFound("Board not found");
  const limit = q.limit ?? 30;
  const cursor = decodeCursor(q.cursor);
  const where = ["t.board_slug = ?", "t.deleted_at IS NULL"];
  const binds: unknown[] = [board];
  if (q.sort === "unsolved") where.push("t.solved_post_id IS NULL");
  if (q.tag) {
    where.push("EXISTS (SELECT 1 FROM json_each(t.tags) WHERE lower(json_each.value) = lower(?))");
    binds.push(q.tag);
  }
  const order = q.sort === "new" ? "t.created_at DESC" : q.sort === "top" ? "t.upvotes DESC, t.last_activity_at DESC" : "t.last_activity_at DESC";
  const { results } = await db
    .prepare(`${THREAD_SELECT} WHERE ${where.join(" AND ")} ORDER BY t.pinned DESC, ${order}, t.id LIMIT ? OFFSET ?`)
    .bind(...binds, limit + 1, cursor.o)
    .all<ThreadRow>();
  return { items: results.slice(0, limit).map(toThread), nextCursor: results.length > limit ? encodeCursor({ o: cursor.o + limit }) : null };
}

export async function getThread(db: D1Database, id: string, q: { cursor?: string; limit?: number }): Promise<ThreadDetail> {
  const row = await db.prepare(`${THREAD_SELECT} WHERE t.id = ? AND t.deleted_at IS NULL`).bind(id).first<ThreadRow>();
  if (!row) throw notFound("Thread not found");
  const limit = q.limit ?? 50;
  const cursor = decodeCursor(q.cursor);
  const { results } = await db
    .prepare(`${POST_SELECT} WHERE p.thread_id = ? AND p.deleted_at IS NULL ORDER BY p.created_at, p.rowid LIMIT ? OFFSET ?`)
    .bind(id, limit + 1, cursor.o)
    .all<PostRow>();
  return {
    thread: toThread(row),
    posts: results.slice(0, limit).map((p) => toPost(p, row.solved_post_id)),
    nextCursor: results.length > limit ? encodeCursor({ o: cursor.o + limit }) : null,
  };
}

async function mentionNotifications(db: D1Database, body: string, actor: SessionUser, title: string, href: string): Promise<NewNotification[]> {
  const names = [...new Set([...body.matchAll(MENTION)].map((m) => m[1]!.toLowerCase()))].slice(0, 10);
  if (!names.length) return [];
  const { results } = await db.prepare(`SELECT id FROM users WHERE lower(username) IN (${names.map(() => "?").join(",")}) AND deleted_at IS NULL`).bind(...names).all<{ id: string }>();
  return results.map((r) => ({ userId: r.id, type: "mention" as const, actorId: actor.id, title, href }));
}

export async function createThread(db: D1Database, user: SessionUser, board: string, input: { title: string; bodyMd: string; tags: string[] }): Promise<ThreadDetail> {
  const exists = await db.prepare(`SELECT 1 FROM forum_boards WHERE slug = ?`).bind(board).first();
  if (!exists) throw notFound("Board not found");
  const threadId = newId("thr");
  const postId = newId("post");
  const now = Date.now();
  const tags = [...new Set(input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 5);
  const href = `/forum/t/${threadId}`;
  await db.batch([
    db.prepare(`INSERT INTO threads (id, board_slug, author_id, title, tags, created_at, last_activity_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(threadId, board, user.id, input.title.trim(), JSON.stringify(tags), now, now),
    db.prepare(`INSERT INTO posts (id, thread_id, author_id, body_md, created_at) VALUES (?, ?, ?, ?, ?)`).bind(postId, threadId, user.id, input.bodyMd, now),
    ...notificationStatements(db, await mentionNotifications(db, input.bodyMd, user, `${user.displayName} mentioned you in "${input.title.slice(0, 80)}"`, href)),
  ]);
  return getThread(db, threadId, {});
}

export async function createPost(env: Env, user: SessionUser, threadId: string, bodyMd: string): Promise<Post> {
  const db = env.DB;
  const thread = await db.prepare(`SELECT id, title, author_id, solved_post_id FROM threads WHERE id = ? AND deleted_at IS NULL`).bind(threadId).first<{ id: string; title: string; author_id: string; solved_post_id: string | null }>();
  if (!thread) throw notFound("Thread not found");
  const id = newId("post");
  const now = Date.now();
  const href = `/forum/t/${threadId}#post-${id}`;
  const notes: NewNotification[] = [
    { userId: thread.author_id, type: "comment", actorId: user.id, title: `${user.displayName} replied to "${thread.title.slice(0, 80)}"`, href },
    ...(await mentionNotifications(db, bodyMd, user, `${user.displayName} mentioned you in "${thread.title.slice(0, 80)}"`, href)),
  ];
  await db.batch([
    db.prepare(`INSERT INTO posts (id, thread_id, author_id, body_md, created_at) VALUES (?, ?, ?, ?, ?)`).bind(id, threadId, user.id, bodyMd, now),
    db.prepare(`UPDATE threads SET reply_count = (SELECT count(*) - 1 FROM posts WHERE thread_id = ?1 AND deleted_at IS NULL), last_activity_at = ?2 WHERE id = ?1`).bind(threadId, now),
    ...notificationStatements(db, notes),
  ]);
  const row = await db.prepare(`${POST_SELECT} WHERE p.id = ?`).bind(id).first<PostRow>();
  const post = toPost(row!, thread.solved_post_id);
  await broadcast(env, threadId, { type: "post", post });
  return post;
}

/** Push an event to everyone watching a thread. Best effort: the post is saved either way. */
export async function broadcast(env: Env, threadId: string, event: ThreadLiveEvent): Promise<void> {
  try {
    const stub = env.LIVE_THREAD.get(env.LIVE_THREAD.idFromName(threadId));
    await stub.fetch("https://live-thread/broadcast", { method: "POST", body: JSON.stringify(event) });
  } catch (err) {
    console.error("[forum] live broadcast failed", err);
  }
}

export async function votePost(db: D1Database, userId: string, postId: string, value: 0 | 1): Promise<number> {
  const post = await db.prepare(`SELECT id FROM posts WHERE id = ? AND deleted_at IS NULL`).bind(postId).first();
  if (!post) throw notFound("Post not found");
  const results = await db.batch<{ upvotes: number }>([
    value === 1
      ? db.prepare(`INSERT OR IGNORE INTO votes (user_id, target_type, target_id, value) VALUES (?, 'post', ?, 1)`).bind(userId, postId)
      : db.prepare(`DELETE FROM votes WHERE user_id = ? AND target_type = 'post' AND target_id = ?`).bind(userId, postId),
    db.prepare(`UPDATE posts SET upvotes = (SELECT count(*) FROM votes WHERE target_type = 'post' AND target_id = ?1) WHERE id = ?1`).bind(postId),
    db.prepare(`SELECT upvotes FROM posts WHERE id = ?`).bind(postId),
  ]);
  // The thread's score is its first post's score.
  await db.prepare(`UPDATE threads SET upvotes = (SELECT p.upvotes FROM posts p WHERE p.thread_id = threads.id ORDER BY p.created_at, p.rowid LIMIT 1) WHERE id = (SELECT thread_id FROM posts WHERE id = ?)`).bind(postId).run();
  return results[2]?.results[0]?.upvotes ?? 0;
}

export async function markSolved(db: D1Database, user: SessionUser, threadId: string, postId: string | null): Promise<Thread> {
  const thread = await db.prepare(`SELECT author_id FROM threads WHERE id = ? AND deleted_at IS NULL`).bind(threadId).first<{ author_id: string }>();
  if (!thread) throw notFound("Thread not found");
  if (thread.author_id !== user.id && user.role !== "admin") throw new HttpError("forbidden", "Only the person who asked can mark the answer.");
  let postAuthor: string | null = null;
  if (postId) {
    const post = await db.prepare(`SELECT author_id FROM posts WHERE id = ? AND thread_id = ? AND deleted_at IS NULL`).bind(postId, threadId).first<{ author_id: string }>();
    if (!post) throw new HttpError("invalid_request", "That reply isn't in this thread.");
    postAuthor = post.author_id;
  }
  await db.prepare(`UPDATE threads SET solved_post_id = ? WHERE id = ?`).bind(postId, threadId).run();
  if (postAuthor && postAuthor !== thread.author_id) await afterSolution(db, postAuthor);
  const row = await db.prepare(`${THREAD_SELECT} WHERE t.id = ?`).bind(threadId).first<ThreadRow>();
  return toThread(row!);
}
