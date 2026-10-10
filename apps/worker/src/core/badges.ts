/** Task 3.12: awarding badges. Each award is idempotent and tells the user once. */
import { notificationStatements } from "./notify";

export type BadgeKey = "first-fork" | "most-forked" | "bug-squasher" | "helper" | "collab-champion" | "streak-7";

const NAMES: Record<BadgeKey, string> = {
  "first-fork": "First Fork",
  "most-forked": "Most Forked",
  "bug-squasher": "Bug Squasher",
  helper: "Helper",
  "collab-champion": "Collab Champion",
  "streak-7": "7-day Streak",
};

export async function award(db: D1Database, userId: string, key: BadgeKey, username?: string): Promise<boolean> {
  const res = await db.prepare(`INSERT OR IGNORE INTO user_badges (user_id, badge_key, created_at) VALUES (?, ?, ?)`).bind(userId, key, Date.now()).run();
  if (!res.meta.changes) return false;
  const statements = notificationStatements(db, [
    { userId, type: "system", actorId: null, title: `You earned the ${NAMES[key]} badge`, href: username ? `/u/${username}` : "/notifications" },
  ]);
  if (statements.length) await db.batch(statements);
  return true;
}

/** After a fork is recorded: First Fork for the forker; Most Forked when 10 people have built on one project. */
export async function afterFork(db: D1Database, forkerId: string, parentId: string): Promise<void> {
  await award(db, forkerId, "first-fork");
  const parent = await db
    .prepare(
      `SELECT p.owner_id, (SELECT count(DISTINCT c.owner_id) FROM forks f JOIN projects c ON c.id = f.child_id WHERE f.parent_id = p.id AND c.deleted_at IS NULL) AS forkers
       FROM projects p WHERE p.id = ?`,
    )
    .bind(parentId)
    .first<{ owner_id: string | null; forkers: number }>();
  if (parent?.owner_id && parent.forkers >= 10) await award(db, parent.owner_id, "most-forked");
}

/** After a forum post is marked as the solution. */
export async function afterSolution(db: D1Database, postAuthorId: string): Promise<void> {
  const n = await db
    .prepare(`SELECT count(*) AS n FROM threads t JOIN posts p ON p.id = t.solved_post_id WHERE p.author_id = ? AND t.deleted_at IS NULL`)
    .bind(postAuthorId)
    .first<{ n: number }>();
  if ((n?.n ?? 0) >= 5) await award(db, postAuthorId, "helper");
}

/** After a collab request is accepted. */
export async function afterCollabAccepted(db: D1Database, senderId: string): Promise<void> {
  const n = await db.prepare(`SELECT count(*) AS n FROM collab_requests WHERE from_id = ? AND status = 'accepted'`).bind(senderId).first<{ n: number }>();
  if ((n?.n ?? 0) >= 5) await award(db, senderId, "collab-champion");
}
