import type { Hono } from "hono";
import type { ChatChannel, ChatMessage } from "@forkvlift/shared";
import type { AppEnv } from "../env";
import { mount } from "../core/http";
import { notFound } from "../core/errors";
import * as forum from "../core/forum";
import { CHAT_CHANNEL_SLUGS, createReport } from "../core/moderation";
import * as resources from "../core/resources";
import { clientIp, verifyTurnstile } from "../core/security";
import type { StoredMessage } from "../durable/chat-room";

/** Chat channels (product plan: #general, #help, #showcase, #gamedev, plus rooms for big categories). */
const CHANNELS: Omit<ChatChannel, "onlineCount" | "slowModeSeconds">[] = [
  { slug: "general", name: "#general", description: "Hang out", kind: "general" },
  { slug: "help", name: "#help", description: "Quick questions", kind: "general" },
  { slug: "showcase", name: "#showcase", description: "Show what you made", kind: "general" },
  { slug: "gamedev", name: "#gamedev", description: "Games and engines", kind: "general" },
  { slug: "ai-and-agents", name: "#ai-and-agents", description: "Agents, prompts and local models", kind: "category" },
  { slug: "developer-tools", name: "#developer-tools", description: "Editors, CLIs, MCP servers", kind: "category" },
  { slug: "productivity", name: "#productivity", description: "Notes, to-do, calendars", kind: "category" },
  { slug: "creative-and-design", name: "#creative-and-design", description: "Art, music, design tools", kind: "category" },
];
if (CHANNELS.map((c) => c.slug).join() !== CHAT_CHANNEL_SLUGS.join()) throw new Error("Chat channel lists are out of sync");

const chatStub = (env: Env, slug: string) => env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(slug));

/** Forum, chat, resources, reports. Opus (tasks 3.1–3.5). */
export function registerCommunity(app: Hono<AppEnv>) {
  // ── Forum (3.3) ──────────────────────────────────────────────────────
  mount(app, "listForumBoards", async (_, c) => ({ items: await forum.listBoards(c.env.DB) }));
  mount(app, "listThreads", ({ params, query }, c) => forum.listThreads(c.env.DB, params.slug, query));
  mount(app, "createThread", async ({ params, body }, c) => {
    await verifyTurnstile(c.env, body.turnstileToken, clientIp(c.req.raw));
    return forum.createThread(c.env.DB, c.get("user")!, params.slug, body);
  });
  mount(app, "getThread", ({ params, query }, c) => forum.getThread(c.env.DB, params.id, query));
  mount(app, "createPost", async ({ params, body }, c) => {
    await verifyTurnstile(c.env, body.turnstileToken, clientIp(c.req.raw));
    return forum.createPost(c.env, c.get("user")!, params.id, body.bodyMd);
  });
  mount(app, "votePost", async ({ params, body }, c) => ({ upvotes: await forum.votePost(c.env.DB, c.get("user")!.id, params.id, body.value) }));
  mount(app, "markSolved", ({ params, body }, c) => forum.markSolved(c.env.DB, c.get("user")!, params.id, body.postId));
  mount(app, "threadLive", ({ params }, c) => {
    if (c.req.header("upgrade") !== "websocket") return c.text("Expected a WebSocket upgrade", 426);
    const headers = new Headers(c.req.raw.headers);
    headers.set("x-fv-signed-in", c.get("user") ? "1" : "0");
    const stub = c.env.LIVE_THREAD.get(c.env.LIVE_THREAD.idFromName(params.id));
    return stub.fetch(new Request(c.req.raw, { headers }));
  });

  // ── Chat / Plaza (3.1, 3.2) ──────────────────────────────────────────
  mount(app, "listChannels", async (_, c) => {
    const cached = await c.env.CACHE.get<ChatChannel[]>("chat:channels", "json").catch(() => null);
    if (cached) return { items: cached };
    const items = await Promise.all(
      CHANNELS.map(async (ch) => {
        try {
          const stats = (await (await chatStub(c.env, ch.slug).fetch("https://chat-room/stats")).json()) as { online: number; slowModeSeconds: number };
          return { ...ch, onlineCount: stats.online, slowModeSeconds: stats.slowModeSeconds };
        } catch {
          return { ...ch, onlineCount: 0, slowModeSeconds: 0 };
        }
      }),
    );
    await c.env.CACHE.put("chat:channels", JSON.stringify(items), { expirationTtl: 60 }).catch(() => undefined);
    return { items };
  });

  mount(app, "channelHistory", async ({ params, query }, c) => {
    if (!CHANNELS.some((ch) => ch.slug === params.slug)) throw notFound("Channel not found");
    const url = new URL("https://chat-room/history");
    if (query.cursor) url.searchParams.set("before", query.cursor);
    url.searchParams.set("limit", String(query.limit ?? 50));
    const page = (await (await chatStub(c.env, params.slug).fetch(url)).json()) as { items: StoredMessage[]; nextCursor: string | null };
    const viewer = c.get("user")?.id ?? null;
    const items: ChatMessage[] = page.items.map((m) => ({
      id: m.id,
      channel: params.slug,
      author: m.author,
      body: m.body,
      createdAt: m.createdAt,
      reactions: Object.entries(m.reactions).map(([emoji, users]) => ({ emoji, count: users.length, viewerReacted: viewer !== null && users.includes(viewer) })),
    }));
    return { items, nextCursor: page.nextCursor };
  });

  mount(app, "channelSocket", async ({ params }, c) => {
    if (c.req.header("upgrade") !== "websocket") return c.text("Expected a WebSocket upgrade", 426);
    if (!CHANNELS.some((ch) => ch.slug === params.slug)) throw notFound("Channel not found");
    const user = c.get("user");
    // Identity reaches the Durable Object only through headers we set; anything
    // the client sent under these names is dropped.
    const headers = new Headers(c.req.raw.headers);
    for (const h of ["x-fv-user", "x-fv-joined", "x-fv-hidden"]) headers.delete(h);
    if (user) {
      const joined = await c.env.DB.prepare(`SELECT created_at FROM users WHERE id = ?`).bind(user.id).first<{ created_at: number }>();
      headers.set("x-fv-user", JSON.stringify({ id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl, avatar: user.avatar }));
      headers.set("x-fv-joined", String(joined?.created_at ?? Date.now()));
      headers.set("x-fv-hidden", user.settings.hideOnlineStatus ? "1" : "0");
    }
    return chatStub(c.env, params.slug).fetch(new Request(c.req.raw, { headers }));
  });

  // ── Resources (3.5) ──────────────────────────────────────────────────
  mount(app, "listResources", ({ query }, c) => resources.listResources(c.env.DB, query));
  mount(app, "getResource", ({ params }, c) => resources.getResource(c.env.DB, params.slug));
  mount(app, "createResource", async ({ body }, c) => {
    await verifyTurnstile(c.env, body.turnstileToken, clientIp(c.req.raw));
    return resources.createResource(c.env, c.get("user")!, body);
  });
  mount(app, "reportResourceResult", ({ params, body }, c) => resources.reportResult(c.env.DB, c.get("user")!.id, params.slug, body.worked, body.note));
  mount(app, "rateResource", ({ params, body }, c) => resources.rate(c.env.DB, c.get("user")!.id, params.slug, body.stars));

  // ── Reports (3.4) ────────────────────────────────────────────────────
  mount(app, "createReport", async ({ body }, c) => {
    await createReport(c.env.DB, c.get("user")!.id, body);
    return { ok: true as const };
  });
}
