/**
 * One chat channel and its Plaza room (tasks 3.1, 3.2). WebSocket hibernation
 * keeps idle rooms free.
 *
 * Client → server: say, react, move, typing, ping (ChatClientEvent)
 * Server → client: hello, message, presence, leave, typing, deleted, pong, error
 *
 * Moderation (slow mode, chat mutes, deletes, kicks) comes in through POST
 * /admin from the Worker's admin routes; the Worker also reads /history, /stats
 * and /export (for moderation snapshots).
 */
import { DurableObject } from "cloudflare:workers";
import { ChatClientEvent, UserSummary, type ChatMessage, type ChatServerEvent, type PlazaPresence } from "@forkvlift/shared";

interface Attachment {
  user: UserSummary | null;
  x: number;
  y: number;
  lastActive: number;
  state: PlazaPresence["state"];
  /** Hidden from the Plaza (settings.hideOnlineStatus). */
  hidden: boolean;
  /** Account creation time; brand-new accounts can't post links. */
  joinedAt: number;
  lastSaid: number;
  lastTyping: number;
}

export interface StoredMessage {
  id: string;
  authorId: string;
  author: UserSummary;
  body: string;
  createdAt: string;
  /** emoji → user ids */
  reactions: Record<string, string[]>;
}

const HISTORY_KEEP = 500;
const HELLO_HISTORY = 50;
const IDLE_MS = 2 * 60_000;
const AWAY_MS = 10 * 60_000;
const MIN_GAP_MS = 1000;
const NEW_ACCOUNT_MS = 24 * 60 * 60_000;
const LINK = /\bhttps?:\/\/|\bwww\.[a-z0-9-]+\.[a-z]{2,}/i;

export class ChatRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, json TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0)`);
      this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS mutes (user_id TEXT PRIMARY KEY, until INTEGER NOT NULL)`);
    });
  }

  private async slowMode(): Promise<number> {
    return (await this.ctx.storage.get<number>("slowMode")) ?? 0;
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.headers.get("upgrade") === "websocket") return this.join(request);
    if (url.pathname === "/history") {
      return Response.json(this.history(Number(url.searchParams.get("before")) || Number.MAX_SAFE_INTEGER, Math.min(Number(url.searchParams.get("limit")) || 50, 100)));
    }
    if (url.pathname === "/stats") return Response.json({ online: this.presence().length, slowModeSeconds: await this.slowMode() });
    if (url.pathname === "/export") return Response.json(this.exportSince(Number(url.searchParams.get("since")) || 0));
    if (url.pathname === "/admin" && request.method === "POST") return this.admin((await request.json()) as AdminAction);
    return new Response("Not found", { status: 404 });
  }

  // ── Connections ─────────────────────────────────────────────────────────

  private async join(request: Request): Promise<Response> {
    const parsed = UserSummary.safeParse(safeJson(request.headers.get("x-fv-user")));
    const user = parsed.success ? parsed.data : null;
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server, user ? [user.id] : []);
    const now = Date.now();
    const att: Attachment = {
      user,
      x: Math.round((Math.random() * 0.8 + 0.1) * 1000) / 1000,
      y: Math.round((Math.random() * 0.4 + 0.5) * 1000) / 1000,
      lastActive: now,
      state: "active",
      hidden: request.headers.get("x-fv-hidden") === "1",
      joinedAt: Number(request.headers.get("x-fv-joined")) || 0,
      lastSaid: 0,
      lastTyping: 0,
    };
    server.serializeAttachment(att);
    this.send(server, {
      type: "hello",
      you: user,
      presence: this.presence(),
      history: this.history(Number.MAX_SAFE_INTEGER, HELLO_HISTORY).items.map((m) => this.view(m, user?.id ?? null)),
      slowModeSeconds: await this.slowMode(),
    });
    const p = toPresence(att);
    if (p) this.broadcast({ type: "presence", presence: p }, server);
    await this.ensureAlarm();
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment;
    const parsed = ChatClientEvent.safeParse(safeJson(typeof raw === "string" ? raw : new TextDecoder().decode(raw)));
    if (!parsed.success) return this.send(ws, { type: "error", code: "invalid_event", message: "Unrecognized event" });
    const event = parsed.data;
    if (event.type === "ping") return this.send(ws, { type: "pong" });
    if (!att.user) return this.send(ws, { type: "error", code: "unauthorized", message: "Sign in to chat" });

    const now = Date.now();
    const wasActive = att.state === "active";
    att.lastActive = now;
    att.state = "active";
    const save = () => ws.serializeAttachment(att);

    switch (event.type) {
      case "say": {
        const mute = this.ctx.storage.sql.exec<{ until: number }>(`SELECT until FROM mutes WHERE user_id = ?`, att.user.id).toArray()[0];
        if (mute && mute.until > now) {
          save();
          return this.send(ws, { type: "error", code: "muted", message: `A moderator muted you until ${new Date(mute.until).toUTCString()}.` });
        }
        const slow = (await this.slowMode()) * 1000;
        if (now - att.lastSaid < Math.max(slow, MIN_GAP_MS)) {
          save();
          return this.send(ws, { type: "error", code: "slow_mode", message: slow ? `Slow mode is on: one message every ${slow / 1000}s.` : "Slow down a little." });
        }
        const body = event.body.trim();
        if (!body) return save();
        if (LINK.test(body) && now - att.joinedAt < NEW_ACCOUNT_MS) {
          save();
          return this.send(ws, { type: "error", code: "no_links_yet", message: "New accounts can post links after their first day." });
        }
        att.lastSaid = now;
        save();
        const message: StoredMessage = { id: crypto.randomUUID(), authorId: att.user.id, author: att.user, body, createdAt: new Date(now).toISOString(), reactions: {} };
        this.ctx.storage.sql.exec(`INSERT INTO messages (id, created_at, json) VALUES (?, ?, ?)`, message.id, now, JSON.stringify(message));
        this.ctx.storage.sql.exec(`DELETE FROM messages WHERE id NOT IN (SELECT id FROM messages ORDER BY created_at DESC LIMIT ?)`, HISTORY_KEEP);
        this.broadcastMessage(message);
        break;
      }
      case "react": {
        save();
        const row = this.ctx.storage.sql.exec<{ json: string }>(`SELECT json FROM messages WHERE id = ? AND deleted = 0`, event.messageId).toArray()[0];
        if (!row) return this.send(ws, { type: "error", code: "not_found", message: "That message is gone." });
        const message = JSON.parse(row.json) as StoredMessage;
        const users = new Set(message.reactions[event.emoji] ?? []);
        if (users.has(att.user.id)) users.delete(att.user.id);
        else if (event.emoji in message.reactions || Object.keys(message.reactions).length < 12) users.add(att.user.id);
        if (users.size) message.reactions[event.emoji] = [...users];
        else delete message.reactions[event.emoji];
        this.ctx.storage.sql.exec(`UPDATE messages SET json = ? WHERE id = ?`, JSON.stringify(message), message.id);
        this.broadcastMessage(message);
        break;
      }
      case "move": {
        att.x = event.x;
        att.y = event.y;
        save();
        const p = toPresence(att);
        if (p) this.broadcast({ type: "presence", presence: p });
        return;
      }
      case "typing": {
        if (now - att.lastTyping >= 3000) {
          att.lastTyping = now;
          this.broadcast({ type: "typing", userId: att.user.id }, ws);
        }
        save();
        break;
      }
    }
    if (!wasActive) {
      const p = toPresence(att);
      if (p) this.broadcast({ type: "presence", presence: p });
    }
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment;
    if (att.user && !att.hidden && !this.ctx.getWebSockets(att.user.id).some((o) => o !== ws)) {
      this.broadcast({ type: "leave", userId: att.user.id }, ws);
    }
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  /** Every minute while anyone is connected: fade idle people, then mark them away. */
  override async alarm(): Promise<void> {
    const sockets = this.ctx.getWebSockets();
    if (!sockets.length) return;
    const now = Date.now();
    for (const ws of sockets) {
      const att = ws.deserializeAttachment() as Attachment;
      const idleFor = now - att.lastActive;
      const state: PlazaPresence["state"] = idleFor >= AWAY_MS ? "away" : idleFor >= IDLE_MS ? "idle" : "active";
      if (state !== att.state) {
        att.state = state;
        ws.serializeAttachment(att);
        const p = toPresence(att);
        if (p) this.broadcast({ type: "presence", presence: p });
      }
    }
    await this.ctx.storage.setAlarm(now + 60_000);
  }

  private async ensureAlarm() {
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + 60_000);
  }

  // ── Moderation ──────────────────────────────────────────────────────────

  private async admin(action: AdminAction): Promise<Response> {
    switch (action.action) {
      case "delete":
        this.ctx.storage.sql.exec(`UPDATE messages SET deleted = 1 WHERE id = ?`, action.messageId);
        this.broadcast({ type: "deleted", messageId: action.messageId });
        break;
      case "deleteByUser": {
        const ids = this.ctx.storage.sql.exec<{ id: string }>(`SELECT id FROM messages WHERE deleted = 0 AND json_extract(json, '$.authorId') = ?`, action.userId).toArray();
        this.ctx.storage.sql.exec(`UPDATE messages SET deleted = 1 WHERE json_extract(json, '$.authorId') = ?`, action.userId);
        for (const { id } of ids) this.broadcast({ type: "deleted", messageId: id });
        break;
      }
      case "slow":
        await this.ctx.storage.put("slowMode", Math.max(0, Math.min(action.seconds, 3600)));
        break;
      case "mute":
        this.ctx.storage.sql.exec(`INSERT INTO mutes (user_id, until) VALUES (?1, ?2) ON CONFLICT(user_id) DO UPDATE SET until = ?2`, action.userId, Date.now() + action.minutes * 60_000);
        break;
      case "unmute":
        this.ctx.storage.sql.exec(`DELETE FROM mutes WHERE user_id = ?`, action.userId);
        break;
      case "kick":
        for (const ws of this.ctx.getWebSockets(action.userId)) ws.close(4003, "Removed by a moderator");
        break;
    }
    return Response.json({ ok: true, slowModeSeconds: await this.slowMode() });
  }

  // ── Reads ───────────────────────────────────────────────────────────────

  private history(before: number, limit: number): { items: StoredMessage[]; nextCursor: string | null } {
    const rows = this.ctx.storage.sql
      .exec<{ json: string; created_at: number }>(`SELECT json, created_at FROM messages WHERE deleted = 0 AND created_at < ? ORDER BY created_at DESC LIMIT ?`, before, limit + 1)
      .toArray();
    const page = rows.slice(0, limit);
    return {
      items: page.map((r) => JSON.parse(r.json) as StoredMessage).reverse(),
      nextCursor: rows.length > limit ? String(page[page.length - 1]!.created_at) : null,
    };
  }

  private exportSince(since: number) {
    return this.ctx.storage.sql
      .exec<{ json: string; deleted: number }>(`SELECT json, deleted FROM messages WHERE created_at > ? ORDER BY created_at`, since)
      .toArray()
      .map((r) => ({ ...(JSON.parse(r.json) as StoredMessage), deleted: r.deleted === 1 }));
  }

  private presence(): PlazaPresence[] {
    const seen = new Map<string, PlazaPresence>();
    for (const ws of this.ctx.getWebSockets()) {
      const p = toPresence(ws.deserializeAttachment() as Attachment);
      if (p) seen.set(p.user.id, p);
    }
    return [...seen.values()];
  }

  // ── Sending ─────────────────────────────────────────────────────────────

  /** A message as one viewer sees it (their own reactions highlighted). */
  private view(m: StoredMessage, viewerId: string | null): ChatMessage {
    return {
      id: m.id,
      channel: "",
      author: m.author,
      body: m.body,
      createdAt: m.createdAt,
      reactions: Object.entries(m.reactions).map(([emoji, users]) => ({ emoji, count: users.length, viewerReacted: viewerId !== null && users.includes(viewerId) })),
    };
  }

  private broadcastMessage(m: StoredMessage) {
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment;
      this.send(ws, { type: "message", message: this.view(m, att.user?.id ?? null) });
    }
  }

  private send(ws: WebSocket, event: ChatServerEvent) {
    try {
      ws.send(JSON.stringify(event));
    } catch {
      // socket already closed
    }
  }

  private broadcast(event: ChatServerEvent, except?: WebSocket) {
    const data = JSON.stringify(event);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(data);
      } catch {
        // ignore closed sockets
      }
    }
  }
}

export type AdminAction =
  | { action: "delete"; messageId: string }
  | { action: "deleteByUser"; userId: string }
  | { action: "slow"; seconds: number }
  | { action: "mute"; userId: string; minutes: number }
  | { action: "unmute"; userId: string }
  | { action: "kick"; userId: string };

function toPresence(a: Attachment): PlazaPresence | null {
  return a.user && !a.hidden ? { user: a.user, x: a.x, y: a.y, state: a.state } : null;
}

function safeJson(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
