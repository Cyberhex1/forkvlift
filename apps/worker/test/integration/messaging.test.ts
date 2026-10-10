import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CollabRequest, Conversation, DirectMessage } from "@forkvlift/shared";
import { api, env, resetDb, seedCategory, seedProject, seedUser } from "./helpers";

let ada = "";
let bo = "";
let cy = "";
let boProject = "";
beforeEach(async () => {
  await resetDb();
  await env.DB.batch(["messages", "conversation_members", "conversations", "collab_requests", "notifications", "blocks"].map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
  await seedCategory("tools");
  ada = await seedUser("usr_ada", "ada");
  bo = await seedUser("usr_bo", "bo");
  cy = await seedUser("usr_cy", "cy");
  boProject = await seedProject({ slug: "bo-thing", owner: "usr_bo", license: null });
  vi.stubGlobal("fetch", async () => Response.json({ success: true })); // Turnstile
});
afterEach(() => vi.unstubAllGlobals());

const post = <T>(path: string, body: unknown, as: string) => api<T>(path, { method: "POST", as, body: JSON.stringify(body) });
const setPolicy = (userId: string, dmPolicy: string) =>
  env.DB.prepare(`UPDATE profiles SET settings = ? WHERE user_id = ?`).bind(JSON.stringify({ dmPolicy }), userId).run();
const unread = async (as: string) => (await api<{ unreadCount: number }>("/api/notifications", { as })).body.unreadCount;

describe("direct messages", () => {
  it("starts, reuses and reads a conversation with unread counts and notifications", async () => {
    const first = await post<Conversation>("/api/conversations", { username: "bo", body: "Hi Bo" }, ada);
    expect(first.status).toBe(200);
    expect(first.body.participants.map((p) => p.username).sort()).toEqual(["ada", "bo"]);
    const again = await post<Conversation>("/api/conversations", { username: "BO", body: "Me again" }, ada);
    expect(again.body.id).toBe(first.body.id);

    const inbox = await api<{ items: Conversation[] }>("/api/conversations", { as: bo });
    expect(inbox.body.items[0]).toMatchObject({ unreadCount: 2, lastMessagePreview: "Me again" });
    expect(await unread(bo)).toBe(2);

    const msgs = await api<{ items: DirectMessage[] }>(`/api/conversations/${first.body.id}/messages`, { as: bo });
    expect(msgs.body.items.map((m) => m.body)).toEqual(["Me again", "Hi Bo"]);
    expect(msgs.body.items[0]?.sender.username).toBe("ada");
    expect((await api<{ items: Conversation[] }>("/api/conversations", { as: bo })).body.items[0]?.unreadCount).toBe(0);

    const reply = await post<DirectMessage>(`/api/conversations/${first.body.id}/messages`, { body: "Hey!" }, bo);
    expect(reply.body).toMatchObject({ body: "Hey!", sender: { username: "bo" } });
    expect((await api(`/api/conversations/${first.body.id}/messages`, { as: cy })).status).toBe(404);
  });

  it("respects DM policies", async () => {
    await setPolicy("usr_bo", "nobody");
    expect((await post("/api/conversations", { username: "bo", body: "hi" }, ada)).status).toBe(403);
    await setPolicy("usr_bo", "followers");
    expect((await post("/api/conversations", { username: "bo", body: "hi" }, ada)).status).toBe(403);
    await env.DB.prepare(`INSERT INTO follows (follower_id, target_type, target_id) VALUES ('usr_bo', 'user', 'usr_ada')`).run();
    expect((await post("/api/conversations", { username: "bo", body: "hi" }, ada)).status).toBe(200);
  });

  it("blocks stop messages both ways; mutes only silence notifications", async () => {
    const conv = await post<Conversation>("/api/conversations", { username: "bo", body: "hi" }, ada);
    await post("/api/blocks", { username: "ada", kind: "block" }, bo);
    expect((await post(`/api/conversations/${conv.body.id}/messages`, { body: "still there?" }, ada)).status).toBe(403);
    expect((await post("/api/conversations", { username: "ada", body: "x" }, bo)).status).toBe(403);
    await api("/api/blocks/ada", { method: "DELETE", as: bo });

    await post("/api/blocks", { username: "ada", kind: "mute" }, bo);
    const before = await unread(bo);
    expect((await post(`/api/conversations/${conv.body.id}/messages`, { body: "muted" }, ada)).status).toBe(200);
    expect(await unread(bo)).toBe(before);
    expect((await api<{ items: { kind: string }[] }>("/api/blocks", { as: bo })).body.items[0]?.kind).toBe("mute");
  });

  it("refuses to message yourself or unknown users", async () => {
    expect((await post("/api/conversations", { username: "ada", body: "me" }, ada)).status).toBe(400);
    expect((await post("/api/conversations", { username: "ghost", body: "boo" }, ada)).status).toBe(404);
  });
});

describe("collab requests", () => {
  const request = (as: string, body: Partial<Record<string, unknown>>) =>
    post<CollabRequest>("/api/collab-requests", { toUsername: "bo", projectId: null, kind: "collab", role: "Pixel art", availability: "Weekends", message: "Let's build", turnstileToken: "t", ...body }, as);

  it("sends, lists, dedupes and answers", async () => {
    const sent = await request(ada, {});
    expect(sent.body).toMatchObject({ status: "pending", from: { username: "ada" }, to: { username: "bo" } });
    expect((await request(ada, {})).status).toBe(409);
    const inbox = await api<{ items: CollabRequest[] }>("/api/collab-requests?box=inbox", { as: bo });
    expect(inbox.body.items).toHaveLength(1);
    const answered = await post<CollabRequest>(`/api/collab-requests/${sent.body.id}/respond`, { accept: true }, bo);
    expect(answered.body.status).toBe("accepted");
    expect((await post(`/api/collab-requests/${sent.body.id}/respond`, { accept: false }, bo)).status).toBe(409);
    expect((await post(`/api/collab-requests/${sent.body.id}/respond`, { accept: true }, ada)).status).toBe(404);
    expect(await unread(ada)).toBe(1);
  });

  it("asks permission to build on an unlicensed project (the panel's \"Request to build on this\")", async () => {
    const res = await request(ada, { kind: "build_permission", projectId: boProject });
    expect(res.body.project?.slug).toBe("bo-thing");
    expect((await request(cy, { kind: "build_permission", projectId: null })).status).toBe(400);
    expect((await request(cy, { kind: "build_permission", projectId: boProject, toUsername: "ada" })).status).toBe(400);
  });
});

describe("in-app notification preferences", () => {
  it("skips types the recipient switched off", async () => {
    await env.DB.prepare(`UPDATE profiles SET settings = ? WHERE user_id = 'usr_bo'`).bind(JSON.stringify({ notifications: { message: { email: false, push: false } } })).run();
    await api("/api/conversations", { method: "POST", as: ada, body: JSON.stringify({ username: "bo", body: "hi" }) });
    expect(await unread(bo)).toBe(0);
  });
});
