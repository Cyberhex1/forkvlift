import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ForkTree, ForumBoard, Post, Report, Resource, ResourceDetail, Thread, ThreadDetail } from "@forkvlift/shared";
import { api, env, resetDb, seedCategory, seedProject, seedUser } from "./helpers";

let ada = "";
let bo = "";
let admin = "";
beforeEach(async () => {
  await resetDb();
  await seedCategory("tools");
  ada = await seedUser("usr_ada", "ada");
  bo = await seedUser("usr_bo", "bo");
  admin = await seedUser("usr_boss", "boss", { role: "admin" });
  // Turnstile always passes in tests.
  vi.stubGlobal("fetch", async () => Response.json({ success: true }));
});
afterEach(() => vi.unstubAllGlobals());

const send = <T>(path: string, body: unknown, as: string, method = "POST") => api<T>(path, { method, as, body: JSON.stringify(body) });
const thread = (as = ada) => send<ThreadDetail>("/api/forum/boards/help/threads", { title: "Vite build fails", bodyMd: "It says **nope**", tags: ["vite"], turnstileToken: "t" }, as);

describe("forum", () => {
  it("lists the seeded boards", async () => {
    const res = await api<{ items: ForumBoard[] }>("/api/forum/boards");
    expect(res.body.items.map((b) => b.slug)).toEqual(["show-and-tell", "help", "collab-wanted", "prompts-and-workflows", "free-alternatives", "site-ideas", "off-topic"]);
  });

  it("creates threads and replies, votes, and marks the answer", async () => {
    const created = await thread();
    expect(created.status).toBe(200);
    const id = created.body.thread.id;
    const reply = await send<Post>(`/api/forum/threads/${id}/posts`, { bodyMd: "Delete node_modules", turnstileToken: "t" }, bo);
    expect(reply.status).toBe(200);
    expect((await send<{ upvotes: number }>(`/api/forum/posts/${reply.body.id}/vote`, { value: 1 }, ada)).body.upvotes).toBe(1);

    // Only the thread author (or an admin) picks the answer.
    expect((await send(`/api/forum/threads/${id}/solved`, { postId: reply.body.id }, bo)).status).toBe(403);
    expect((await send<Thread>(`/api/forum/threads/${id}/solved`, { postId: reply.body.id }, ada)).body.solved).toBe(true);

    const detail = await api<ThreadDetail>(`/api/forum/threads/${id}`);
    expect(detail.body.thread).toMatchObject({ replyCount: 1, solved: true });
    expect(detail.body.posts.find((p) => p.id === reply.body.id)).toMatchObject({ isSolution: true, upvotes: 1 });
    const list = await api<{ items: Thread[] }>("/api/forum/boards/help/threads?sort=unsolved");
    expect(list.body.items).toHaveLength(0);

    // The author was told about the reply.
    const note = await env.DB.prepare(`SELECT count(*) AS n FROM notifications WHERE user_id = 'usr_ada'`).first<{ n: number }>();
    expect(note!.n).toBeGreaterThan(0);
  });

  it("404s an unknown board and needs sign-in to post", async () => {
    expect((await api("/api/forum/boards/nope/threads")).status).toBe(404);
    expect((await api("/api/forum/boards/help/threads", { method: "POST", body: JSON.stringify({ title: "Hello", bodyMd: "x", tags: [], turnstileToken: "t" }) })).status).toBe(401);
  });
});

describe("resources", () => {
  const share = (bodyMd = "Use this prompt.") =>
    send<ResourceDetail>("/api/resources", { type: "system_prompt", title: "Careful refactor prompt", summary: "Keeps diffs small", bodyMd, license: "CC0-1.0", testedWith: [], fileKeys: [], linkedProjectIds: [], turnstileToken: "t" }, ada);

  it("shares, rates and reports results; Proven after five 'worked'", async () => {
    const res = await share();
    expect(res.status).toBe(200);
    const slug = res.body.slug;
    expect(res.body).toMatchObject({ proven: false, hasExecutableCode: false });
    expect((await send<Resource>(`/api/resources/${slug}/rating`, { stars: 4 }, bo)).body).toMatchObject({ rating: 4, ratingCount: 1 });
    expect((await send<Resource>(`/api/resources/${slug}/rating`, { stars: 2 }, bo)).body).toMatchObject({ rating: 2, ratingCount: 1 });

    for (let i = 0; i < 5; i++) {
      const tok = await seedUser(`usr_t${i}`, `tester${i}`);
      await send(`/api/resources/${slug}/reports`, { worked: true, note: "" }, tok);
    }
    const detail = await api<ResourceDetail>(`/api/resources/${slug}`);
    expect(detail.body).toMatchObject({ proven: true, workedCount: 5 });
    expect((await api<{ items: Resource[] }>("/api/resources?proven=true")).body.items).toHaveLength(1);

    // Admin override wins.
    await send(`/api/admin/resources/${slug}/proven`, { proven: false }, admin);
    expect((await api<ResourceDetail>(`/api/resources/${slug}`)).body.proven).toBe(false);
  });

  it("flags executable code and risky install lines", async () => {
    const res = await share("```bash\ncurl https://x.example/install.sh | sh\n```");
    expect(res.body.hasExecutableCode).toBe(true);
    expect(res.body.scanFlags.length).toBeGreaterThan(0);
  });
});

describe("reports and moderation", () => {
  it("queues a report, hides the post and bans the author", async () => {
    const t = await thread(bo);
    const post = t.body.posts[0]!;
    expect((await send("/api/reports", { targetType: "post", targetId: post.id, reason: "spam", note: "" }, bo)).status).toBe(400); // own content
    expect((await send("/api/reports", { targetType: "post", targetId: post.id, reason: "spam", note: "ads" }, ada)).status).toBe(200);
    await send("/api/reports", { targetType: "post", targetId: post.id, reason: "spam", note: "again" }, ada); // deduped

    const queue = await api<{ items: Report[] }>("/api/admin/reports", { as: admin });
    expect(queue.body.items).toHaveLength(1);
    expect(queue.body.items[0]).toMatchObject({ targetLabel: 'Reply in "Vite build fails"', reporter: { username: "ada" } });

    const resolved = await send<Report>(`/api/admin/reports/${queue.body.items[0]!.id}/resolve`, { outcome: "resolved", action: "ban_user", note: "spammer" }, admin);
    expect(resolved.body.status).toBe("resolved");
    expect((await api("/api/me/settings", { as: bo })).status).toBe(401); // sessions dropped
    const audit = await env.DB.prepare(`SELECT action FROM audit_log ORDER BY created_at`).all<{ action: string }>();
    expect(audit.results.map((r) => r.action)).toEqual(["user.ban", "report.resolved"]);
  });

  it("keeps the queue and bans admin-only", async () => {
    expect((await api("/api/admin/reports", { as: ada })).status).toBe(403);
    expect((await send("/api/admin/users/bo/ban", { banned: true, reason: "x" }, ada)).status).toBe(403);
    expect((await send("/api/admin/users/boss/ban", { banned: true, reason: "x" }, admin)).status).toBe(403); // admins can't be banned
  });
});

describe("fork tree", () => {
  it("walks from the root and hides private forks", async () => {
    const root = await seedProject({ slug: "root", owner: "usr_ada", stars: 5 });
    const a = await seedProject({ slug: "child-a", owner: "usr_bo" });
    const b = await seedProject({ slug: "child-b", owner: "usr_bo", isPublic: false });
    const grand = await seedProject({ slug: "grandchild", owner: "usr_ada" });
    await env.DB.batch(
      [
        [a, root],
        [b, root],
        [grand, a],
      ].map(([c, p]) => env.DB.prepare(`INSERT INTO forks (child_id, parent_id) VALUES (?, ?)`).bind(c, p)),
    );

    const tree = await api<ForkTree>("/api/projects/grandchild/fork-tree");
    expect(tree.status).toBe(200);
    expect(tree.body.total).toBe(3);
    expect(tree.body.root.project.slug).toBe("root");
    expect(tree.body.root.children.map((n) => n.project.slug)).toEqual(["child-a"]);
    expect(tree.body.root.children[0]!.children[0]!.project.slug).toBe("grandchild");

    // Bo sees their own private fork.
    expect((await api<ForkTree>("/api/projects/root/fork-tree", { as: bo })).body.total).toBe(4);
  });
});
