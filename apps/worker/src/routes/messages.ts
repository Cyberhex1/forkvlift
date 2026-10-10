import type { Hono } from "hono";
import type { Notification, SessionUser } from "@forkvlift/shared";
import type { AppEnv } from "../env";
import { mount } from "../core/http";
import * as messaging from "../core/messaging";
import { decodeCursor, encodeCursor } from "../core/projects/list";
import { parseJson } from "../core/projects/rows";
import { clientIp, verifyTurnstile } from "../core/security";

/** DMs, collab requests, blocks, notifications. Opus (tasks 2.3, 2.4). */
export function registerMessages(app: Hono<AppEnv>) {
  const me = (c: { get: (k: "user") => SessionUser | null }) => c.get("user")!;

  mount(app, "listConversations", ({ query }, c) => messaging.listConversations(c.env.DB, me(c).id, query.cursor, query.limit));
  mount(app, "startConversation", ({ body }, c) => messaging.startConversation(c.env.DB, me(c), body.username, body.body));
  mount(app, "listMessages", ({ params, query }, c) => messaging.listMessages(c.env.DB, me(c).id, params.id, query.cursor, query.limit));
  mount(app, "sendMessage", ({ params, body }, c) => messaging.sendMessage(c.env.DB, me(c), params.id, body.body));

  mount(app, "listCollabRequests", ({ query }, c) => messaging.listCollabRequests(c.env.DB, me(c).id, query.box ?? "inbox", query.cursor, query.limit));
  mount(app, "createCollabRequest", async ({ body }, c) => {
    await verifyTurnstile(c.env, body.turnstileToken, clientIp(c.req.raw));
    return messaging.createCollabRequest(c.env.DB, me(c), body);
  });
  mount(app, "respondCollabRequest", ({ params, body }, c) => messaging.respondCollabRequest(c.env.DB, me(c), params.id, body.accept));

  mount(app, "listBlocks", async (_, c) => ({ items: await messaging.listBlocks(c.env.DB, me(c).id) }));
  mount(app, "blockUser", async ({ body }, c) => {
    await messaging.blockUser(c.env.DB, me(c).id, body.username, body.kind);
    return { ok: true as const };
  });
  mount(app, "unblockUser", async ({ params }, c) => {
    await messaging.unblockUser(c.env.DB, me(c).id, params.username);
    return { ok: true as const };
  });

  mount(app, "listNotifications", async ({ query }, c) => {
    const limit = query.limit ?? 30;
    const cursor = decodeCursor(query.cursor);
    const db = c.env.DB;
    const [list, unread] = await db.batch<Record<string, unknown>>([
      db
        .prepare(
          `SELECT n.id, n.type, n.title, n.href, n.read_at, n.created_at, u.id AS a_id, u.username, u.display_name, u.avatar_url, av.config AS avatar
           FROM notifications n LEFT JOIN users u ON u.id = n.actor_id AND u.deleted_at IS NULL LEFT JOIN avatars av ON av.user_id = u.id
           WHERE n.user_id = ? ORDER BY n.created_at DESC, n.rowid DESC LIMIT ? OFFSET ?`,
        )
        .bind(me(c).id, limit + 1, cursor.o),
      db.prepare(`SELECT count(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL`).bind(me(c).id),
    ]);
    const rows = (list?.results ?? []) as unknown as NotificationRow[];
    const items: Notification[] = rows.slice(0, limit).map((r) => ({
      id: r.id,
      type: r.type as Notification["type"],
      read: r.read_at !== null,
      actor: r.a_id && r.username ? { id: r.a_id, username: r.username, displayName: r.display_name ?? r.username, avatarUrl: r.avatar_url, avatar: parseJson(r.avatar, null) } : null,
      title: r.title,
      href: r.href,
      createdAt: new Date(r.created_at).toISOString(),
    }));
    return {
      items,
      nextCursor: rows.length > limit ? encodeCursor({ o: cursor.o + limit }) : null,
      unreadCount: Number((unread?.results[0] as { n?: number } | undefined)?.n ?? 0),
    };
  });

  mount(app, "markNotificationsRead", async ({ body }, c) => {
    const db = c.env.DB;
    const userId = me(c).id;
    if (body.all) await db.prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`).bind(Date.now(), userId).run();
    else if (body.ids?.length) {
      await db
        .prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND id IN (${body.ids.map(() => "?").join(",")})`)
        .bind(Date.now(), userId, ...body.ids)
        .run();
    }
    const n = await db.prepare(`SELECT count(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL`).bind(userId).first<{ n: number }>();
    return { unreadCount: n?.n ?? 0 };
  });
}

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  href: string;
  read_at: number | null;
  created_at: number;
  a_id: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  avatar: string | null;
}
