/**
 * Creating notifications. Task 2.3 adds email delivery (per-type preferences and
 * the weekly digest) on top of this; callers don't change.
 */
import type { NotificationType } from "@forkvlift/shared";
import { newId } from "./ids";

export interface NewNotification {
  userId: string;
  type: NotificationType;
  actorId: string | null;
  title: string;
  href: string;
}

/** Statement(s) to include in a caller's batch. Never notifies someone about their own action. */
export function notificationStatements(db: D1Database, items: NewNotification[]): D1PreparedStatement[] {
  return items
    .filter((n) => n.userId !== n.actorId)
    .map((n) =>
      db
        .prepare(
          // Muted or blocked actors never reach the recipient.
          `INSERT INTO notifications (id, user_id, type, actor_id, title, href, created_at)
           SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
           WHERE (?4 IS NULL OR NOT EXISTS (SELECT 1 FROM blocks WHERE blocker_id = ?2 AND blocked_id = ?4))
             -- The recipient can switch a type off in-app (settings.notifications[type].push = false).
             AND coalesce(json_extract((SELECT settings FROM profiles WHERE user_id = ?2), '$.notifications.' || ?3 || '.push'), 1) != 0`,
        )
        .bind(newId("ntf"), n.userId, n.type, n.actorId, n.title.slice(0, 200), n.href, Date.now()),
    );
}

export async function notify(db: D1Database, items: NewNotification[]): Promise<void> {
  const statements = notificationStatements(db, items);
  if (statements.length) await db.batch(statements);
}
