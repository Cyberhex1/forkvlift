/**
 * One chat channel (and its Plaza room). WebSocket hibernation keeps idle rooms free.
 * Phase 0: connect, hello, say, move, ping, with recent history in DO SQLite.
 * Task 3.1 adds slow mode, mutes/bans, reactions, typing; 3.2 adds idle/away.
 */
import { DurableObject } from "cloudflare:workers";
import { ChatClientEvent, type ChatMessage, type ChatServerEvent, type PlazaPresence, UserSummary } from "@forkvlift/shared";

interface Attachment {
  user: UserSummary | null;
  x: number;
  y: number;
}

const HISTORY = 50;

export class ChatRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, json TEXT NOT NULL)",
      );
    });
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade") !== "websocket") return new Response("Expected WebSocket", { status: 426 });
    const parsedUser = UserSummary.safeParse(safeJson(request.headers.get("x-fv-user")));
    const user = parsedUser.success ? parsedUser.data : null;

    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server, user ? [user.id] : []);
    const attachment: Attachment = { user, x: Math.random() * 0.8 + 0.1, y: Math.random() * 0.5 + 0.4 };
    server.serializeAttachment(attachment);

    this.send(server, {
      type: "hello",
      you: user,
      presence: this.presence(),
      history: this.history(),
      slowModeSeconds: 0,
    });
    if (user) this.broadcast({ type: "presence", presence: toPresence(attachment)! }, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const attachment = ws.deserializeAttachment() as Attachment;
    const parsed = ChatClientEvent.safeParse(safeJson(typeof raw === "string" ? raw : new TextDecoder().decode(raw)));
    if (!parsed.success) return this.send(ws, { type: "error", code: "invalid_event", message: "Unrecognized event" });
    const event = parsed.data;

    if (event.type === "ping") return this.send(ws, { type: "pong" });
    if (!attachment.user) return this.send(ws, { type: "error", code: "unauthorized", message: "Sign in to chat" });

    switch (event.type) {
      case "say": {
        const message: ChatMessage = {
          id: crypto.randomUUID(),
          channel: this.ctx.id.name ?? "general",
          author: attachment.user,
          body: event.body,
          createdAt: new Date().toISOString(),
          reactions: [],
        };
        this.ctx.storage.sql.exec("INSERT INTO messages (id, created_at, json) VALUES (?, ?, ?)", message.id, Date.now(), JSON.stringify(message));
        this.ctx.storage.sql.exec(
          "DELETE FROM messages WHERE id NOT IN (SELECT id FROM messages ORDER BY created_at DESC LIMIT ?)",
          HISTORY * 4,
        );
        this.broadcast({ type: "message", message });
        break;
      }
      case "move": {
        const next = { ...attachment, x: event.x, y: event.y };
        ws.serializeAttachment(next);
        this.broadcast({ type: "presence", presence: toPresence(next)! });
        break;
      }
      case "typing":
        this.broadcast({ type: "typing", userId: attachment.user.id }, ws);
        break;
      case "react":
        this.send(ws, { type: "error", code: "not_implemented", message: "Reactions arrive with task 3.1" });
        break;
    }
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    const attachment = ws.deserializeAttachment() as Attachment;
    if (attachment.user && !this.ctx.getWebSockets(attachment.user.id).some((other) => other !== ws)) {
      this.broadcast({ type: "leave", userId: attachment.user.id }, ws);
    }
  }

  private history(): ChatMessage[] {
    const rows = this.ctx.storage.sql.exec<{ json: string }>("SELECT json FROM messages ORDER BY created_at DESC LIMIT ?", HISTORY).toArray();
    return rows.map((r) => JSON.parse(r.json) as ChatMessage).reverse();
  }

  private presence(): PlazaPresence[] {
    const seen = new Map<string, PlazaPresence>();
    for (const ws of this.ctx.getWebSockets()) {
      const p = toPresence(ws.deserializeAttachment() as Attachment);
      if (p) seen.set(p.user.id, p);
    }
    return [...seen.values()];
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

function toPresence(a: Attachment): PlazaPresence | null {
  return a.user ? { user: a.user, x: a.x, y: a.y, state: "active" } : null;
}

function safeJson(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
