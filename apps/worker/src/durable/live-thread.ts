/**
 * Live forum thread (task 3.3). Viewers hold a WebSocket; the Worker POSTs new
 * posts to /broadcast after saving them. Signed-in viewers send {"type":"typing"}
 * while composing; everyone gets {"type":"typing","count":n} ("3 people are typing").
 */
import { DurableObject } from "cloudflare:workers";
import { ThreadLiveEvent } from "@forkvlift/shared";

const TYPING_WINDOW_MS = 6000;

interface Attachment {
  signedIn: boolean;
  typingAt: number;
}

export class LiveThread extends DurableObject<Env> {
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/broadcast") {
      this.broadcast(ThreadLiveEvent.parse(await request.json()));
      return new Response(null, { status: 204 });
    }
    if (request.headers.get("upgrade") !== "websocket") return new Response("Expected WebSocket", { status: 426 });
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ signedIn: request.headers.get("x-fv-signed-in") === "1", typingAt: 0 } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment;
    if (!att.signedIn) return;
    let type: unknown;
    try {
      type = (JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw)) as { type?: unknown }).type;
    } catch {
      return;
    }
    if (type !== "typing") return;
    const now = Date.now();
    if (now - att.typingAt < 2000) return;
    att.typingAt = now;
    ws.serializeAttachment(att);
    this.broadcastTyping();
    // Tell everyone when the count drops back.
    await this.ctx.storage.setAlarm(now + TYPING_WINDOW_MS + 500);
  }

  override async alarm(): Promise<void> {
    this.broadcastTyping();
  }

  private broadcastTyping() {
    const now = Date.now();
    const count = this.ctx.getWebSockets().filter((ws) => now - (ws.deserializeAttachment() as Attachment).typingAt < TYPING_WINDOW_MS).length;
    this.broadcast({ type: "typing", count });
  }

  private broadcast(event: ThreadLiveEvent) {
    const data = JSON.stringify(event);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        // ignore closed sockets
      }
    }
  }
}
