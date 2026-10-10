/**
 * Live forum thread: viewers hold a WebSocket; the Worker POSTs new events to
 * /broadcast after writing them to D1. Task 3.3 wires posting + typing counts.
 */
import { DurableObject } from "cloudflare:workers";
import { ThreadLiveEvent } from "@forkvlift/shared";

export class LiveThread extends DurableObject<Env> {
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/broadcast") {
      const event = ThreadLiveEvent.parse(await request.json());
      const data = JSON.stringify(event);
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(data);
        } catch {
          // ignore closed sockets
        }
      }
      return new Response(null, { status: 204 });
    }
    if (request.headers.get("upgrade") !== "websocket") return new Response("Expected WebSocket", { status: 426 });
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(): Promise<void> {
    // Viewers only listen for now.
  }
}
