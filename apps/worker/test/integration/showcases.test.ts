import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShowcaseCard, ShowcaseComment, ShowcaseDetail } from "@forkvlift/shared";
import { normalizeEmbed } from "../../src/core/showcases";
import { api, env, resetDb, seedCategory, seedProject, seedUser } from "./helpers";

let ada = "";
let bo = "";
let admin = "";
beforeEach(async () => {
  await resetDb();
  await env.DB.prepare(`DELETE FROM reports`).run();
  await seedCategory("tools");
  await seedCategory("games");
  ada = await seedUser("usr_ada", "ada");
  bo = await seedUser("usr_bo", "bo");
  admin = await seedUser("usr_boss", "boss", { role: "admin" });
  vi.stubGlobal("fetch", async () => Response.json({ success: true }));
});
afterEach(() => vi.unstubAllGlobals());

const call = <T>(path: string, method: string, as: string | undefined, body?: unknown) => api<T>(path, { method, as, body: body === undefined ? undefined : JSON.stringify(body) });
const input = (over: Record<string, unknown> = {}) => ({
  title: "Neon Drift", tagline: "An arcade racer made in a weekend", bodyMd: "Drive fast.", buildStoryMd: "Claude wrote the physics.",
  categorySlug: "games", kind: "game", stage: "finished", coverKey: null,
  media: [{ embedUrl: "https://youtu.be/dQw4w9WgXcQ", alt: "Trailer" }],
  links: [{ kind: "store", label: "Steam", url: "https://store.example.com/neon-drift" }],
  repoUrl: null, aiTools: ["claude-code"], buildTime: "a weekend", tags: ["racing"], publish: true, turnstileToken: "t", ...over,
});

describe("showcases", () => {
  it("normalizes YouTube and Vimeo, refuses other video hosts", () => {
    expect(normalizeEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(normalizeEmbed("https://youtube.com/shorts/abcdefghijk")).toBe("https://www.youtube-nocookie.com/embed/abcdefghijk");
    expect(normalizeEmbed("https://vimeo.com/123456789")).toBe("https://player.vimeo.com/video/123456789");
    expect(() => normalizeEmbed("https://evil.example/video.mp4")).toThrow();
  });

  it("creates a closed-source showcase with media and paid-store links; never forkable", async () => {
    const res = await call<ShowcaseDetail>("/api/showcases", "POST", ada, input());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      slug: "neon-drift", status: "published", hasPublicCode: false, catalogProject: null,
      media: [{ kind: "embed", url: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" }],
      links: [{ kind: "store", label: "Steam" }],
      maker: { username: "ada" },
    });
    expect(res.body).not.toHaveProperty("cloneCommand");
    expect((await call("/api/showcases", "POST", ada, input({ media: [{ embedUrl: "https://evil.example/x", alt: "" }] }))).status).toBe(400);
  });

  it("links to the catalog when the repo is already listed", async () => {
    const pid = await seedProject({ slug: "neon-src", owner: "usr_ada" });
    const res = await call<ShowcaseDetail>("/api/showcases", "POST", ada, input({ repoUrl: "https://github.com/ada/neon-src" }));
    expect(res.body).toMatchObject({ hasPublicCode: true, catalogProject: { id: pid, slug: "neon-src" } });
  });

  it("drafts are private until published", async () => {
    const draft = (await call<ShowcaseDetail>("/api/showcases", "POST", ada, input({ publish: false }))).body;
    expect(draft.status).toBe("draft");
    expect((await api("/api/showcases/neon-drift")).status).toBe(404);
    expect((await api<{ items: ShowcaseCard[] }>("/api/showcases")).body.items).toHaveLength(0);
    expect((await call<{ items: ShowcaseCard[] }>("/api/me/showcases", "GET", ada)).body.items.map((s) => s.status)).toEqual(["draft"]);
    expect((await call("/api/showcases/neon-drift", "PATCH", bo, { publish: true })).status).toBe(404);
    await call("/api/showcases/neon-drift", "PATCH", ada, { publish: true, tagline: "Now out" });
    const pub = await api<ShowcaseDetail>("/api/showcases/neon-drift");
    expect(pub.body).toMatchObject({ status: "published", tagline: "Now out" });
  });

  it("feed filters, votes (not your own), saves and comments", async () => {
    await call("/api/showcases", "POST", ada, input());
    await call("/api/showcases", "POST", bo, input({ title: "Budget Buddy", categorySlug: "tools", kind: "tool", aiTools: ["cursor"] }));
    expect((await api<{ items: ShowcaseCard[] }>("/api/showcases?kind=game")).body.items.map((s) => s.slug)).toEqual(["neon-drift"]);
    expect((await api<{ items: ShowcaseCard[] }>("/api/showcases?tool=cursor")).body.items.map((s) => s.slug)).toEqual(["budget-buddy"]);

    expect((await call("/api/showcases/neon-drift/vote", "POST", ada, { value: 1 })).status).toBe(400);
    expect((await call<{ upvotes: number }>("/api/showcases/neon-drift/vote", "POST", bo, { value: 1 })).body.upvotes).toBe(1);
    expect((await api<{ items: ShowcaseCard[] }>("/api/showcases?sort=top")).body.items[0]!.slug).toBe("neon-drift");
    await call("/api/showcases/budget-buddy/save", "PUT", ada, { saved: true });
    expect((await call<{ items: ShowcaseCard[] }>("/api/me/showcases/saved", "GET", ada)).body.items.map((s) => s.slug)).toEqual(["budget-buddy"]);

    const comment = (await call<ShowcaseComment>("/api/showcases/neon-drift/comments", "POST", bo, { body: "So smooth", parentId: null, turnstileToken: "t" })).body;
    expect((await api<ShowcaseDetail>("/api/showcases/neon-drift")).body.commentCount).toBe(1);
    const note = await env.DB.prepare(`SELECT href FROM notifications WHERE user_id = 'usr_ada'`).first<{ href: string }>();
    expect(note!.href).toBe(`/showcase/neon-drift#comment-${comment.id}`);
    // The maker can remove comments on their own showcase.
    expect((await call(`/api/showcases/neon-drift/comments/${comment.id}`, "DELETE", ada)).status).toBe(200);
    expect((await api<{ items: ShowcaseComment[] }>("/api/showcases/neon-drift/comments")).body.items).toHaveLength(0);
  });

  it("can be reported and hidden by moderators; staff picks are admin-only", async () => {
    const s = (await call<ShowcaseDetail>("/api/showcases", "POST", ada, input())).body;
    expect((await call("/api/reports", "POST", bo, { targetType: "showcase", targetId: s.id, reason: "spam", note: "" })).status).toBe(200);
    const queue = await call<{ items: { id: string; targetLabel: string }[] }>("/api/admin/reports", "GET", admin);
    expect(queue.body.items[0]!.targetLabel).toBe("Showcase: Neon Drift");
    await call(`/api/admin/reports/${queue.body.items[0]!.id}/resolve`, "POST", admin, { outcome: "resolved", action: "hide", note: "" });
    expect((await api("/api/showcases/neon-drift")).status).toBe(404);

    expect((await call("/api/admin/showcases/neon-drift/staff-pick", "POST", ada, { staffPick: true })).status).toBe(403);
    expect((await call("/api/admin/showcases/neon-drift/staff-pick", "POST", admin, { staffPick: true })).status).toBe(200);
  });
});
