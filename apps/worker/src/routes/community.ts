import type { Hono } from "hono";
import type { ChatChannel } from "@forkvlift/shared";
import type { AppEnv } from "../env";
import { mount } from "../core/http";
import { emptyPage, missing, todo } from "./_stubs";

/** Starting chat channels (product plan, "Live chat"). Category rooms come with task 3.1. */
const CHANNELS: ChatChannel[] = [
  { slug: "general", name: "#general", description: "Hang out", kind: "general", onlineCount: 0, slowModeSeconds: 0 },
  { slug: "help", name: "#help", description: "Quick questions", kind: "general", onlineCount: 0, slowModeSeconds: 0 },
  { slug: "showcase", name: "#showcase", description: "Show what you made", kind: "general", onlineCount: 0, slowModeSeconds: 0 },
  { slug: "gamedev", name: "#gamedev", description: "Games and engines", kind: "general", onlineCount: 0, slowModeSeconds: 0 },
];

/** Forum, chat, resources, reports. Opus (tasks 3.1–3.5). */
export function registerCommunity(app: Hono<AppEnv>) {
  mount(app, "listForumBoards", () => ({ items: [] }));
  mount(app, "listThreads", () => emptyPage());
  mount(app, "createThread", () => todo("3.3"));
  mount(app, "getThread", () => missing("Thread"));
  mount(app, "createPost", () => todo("3.3"));
  mount(app, "votePost", () => todo("3.3"));
  mount(app, "markSolved", () => todo("3.3"));
  mount(app, "threadLive", ({ params }, c) => {
    if (c.req.header("upgrade") !== "websocket") return c.text("Expected a WebSocket upgrade", 426);
    const stub = c.env.LIVE_THREAD.get(c.env.LIVE_THREAD.idFromName(params.id));
    return stub.fetch(c.req.raw);
  });

  mount(app, "listChannels", () => ({ items: CHANNELS }));
  mount(app, "channelHistory", () => emptyPage());
  mount(app, "channelSocket", ({ params }, c) => {
    if (c.req.header("upgrade") !== "websocket") return c.text("Expected a WebSocket upgrade", 426);
    if (!CHANNELS.some((ch) => ch.slug === params.slug)) missing("Channel");
    const user = c.get("user");
    // Identity is passed to the Durable Object in a header we set ourselves;
    // anything the client sent under that name is dropped.
    const headers = new Headers(c.req.raw.headers);
    headers.delete("x-fv-user");
    headers.delete("x-fv-channel");
    headers.set("x-fv-channel", params.slug);
    if (user) {
      headers.set(
        "x-fv-user",
        JSON.stringify({ id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl, avatar: user.avatar }),
      );
    }
    const stub = c.env.CHAT_ROOM.get(c.env.CHAT_ROOM.idFromName(params.slug));
    return stub.fetch(new Request(c.req.raw, { headers }));
  });

  mount(app, "listResources", () => emptyPage());
  mount(app, "getResource", () => missing("Resource"));
  mount(app, "createResource", () => todo("3.5"));
  mount(app, "reportResourceResult", () => todo("3.5"));
  mount(app, "rateResource", () => todo("3.5"));

  mount(app, "createReport", () => todo("3.4"));
}
