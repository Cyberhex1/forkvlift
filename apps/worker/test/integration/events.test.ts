import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventEntry, GrowthEvent, GrowthEventDetail } from "@forkvlift/shared";
import { api, env, resetDb, seedCategory, seedProject, seedUser } from "./helpers";

let ada = "";
let bo = "";
let cy = "";
let admin = "";
let adaProject = "";
let boProject = "";
let original = "";
const H = 3_600_000;

beforeEach(async () => {
  await resetDb();
  await seedCategory("tools");
  ada = await seedUser("usr_ada", "ada");
  bo = await seedUser("usr_bo", "bo");
  cy = await seedUser("usr_cy", "cy");
  admin = await seedUser("usr_boss", "boss", { role: "admin" });
  adaProject = await seedProject({ slug: "ada-tool", owner: "usr_ada" });
  boProject = await seedProject({ slug: "bo-tool", owner: "usr_bo" });
  original = await seedProject({ slug: "original", owner: "usr_cy" });
  await seedProject({ slug: "ada-secret", owner: "usr_ada", license: null });
  vi.stubGlobal("fetch", async () => Response.json({ success: true }));
});
afterEach(() => vi.unstubAllGlobals());

const call = <T>(path: string, method: string, as: string | undefined, body?: unknown) => api<T>(path, { method, as, body: body === undefined ? undefined : JSON.stringify(body) });
const iso = (offset: number) => new Date(Date.now() + offset).toISOString();
async function jam(kind: "build_jam" | "fork_friday" = "build_jam", featuredProjectId: string | null = null) {
  const r = await call<GrowthEvent>("/api/admin/events", "POST", admin, { slug: "jam-1", kind, title: "Tiny tools jam", bodyMd: "Theme: tiny tools", featuredProjectId, startsAt: iso(-H), submissionEndsAt: iso(H), votingEndsAt: iso(2 * H) });
  expect(r.status).toBe(200);
  return r.body;
}
const toVoting = () => env.DB.prepare(`UPDATE growth_events SET submission_ends_at = ?, voting_ends_at = ?`).bind(Date.now() - 1000, Date.now() + H).run();
const enter = (as: string, projectId: string) => call<EventEntry>("/api/events/jam-1/entries", "POST", as, { projectId, turnstileToken: "t" });

describe("growth events", () => {
  it("only admins schedule events, and windows must be in order", async () => {
    expect((await call("/api/admin/events", "POST", ada, { slug: "x", kind: "build_jam", title: "Nope", bodyMd: "", featuredProjectId: null, startsAt: iso(0), submissionEndsAt: iso(H), votingEndsAt: iso(2 * H) })).status).toBe(403);
    expect((await call("/api/admin/events", "POST", admin, { slug: "x", kind: "build_jam", title: "Backwards", bodyMd: "", featuredProjectId: null, startsAt: iso(2 * H), submissionEndsAt: iso(H), votingEndsAt: iso(3 * H) })).status).toBe(400);
    const e = await jam();
    expect(e.status).toBe("submitting");
    expect((await api<{ items: GrowthEvent[] }>("/api/events")).body.items.map((x) => x.slug)).toEqual(["jam-1"]);
  });

  it("owners enter their own public, licensed projects once", async () => {
    await jam();
    expect((await call<GrowthEventDetail>("/api/events/jam-1", "GET", ada)).body.viewerCanSubmit).toBe(true);
    expect((await enter(ada, boProject)).status).toBe(403); // not theirs
    const secret = await env.DB.prepare(`SELECT id FROM projects WHERE slug = 'ada-secret'`).first<{ id: string }>();
    expect((await enter(ada, secret!.id)).status).toBe(403); // unlicensed
    expect((await enter(ada, adaProject)).status).toBe(200);
    expect((await enter(ada, adaProject)).status).toBe(409);
    expect((await call("/api/events/jam-1/ballot", "PUT", bo, { entryId: null })).status).toBe(409); // not voting yet
  });

  it("one vote per person, no self-votes, ranked by votes then entry time", async () => {
    await jam();
    const a = (await enter(ada, adaProject)).body;
    const b = (await enter(bo, boProject)).body;
    await toVoting();
    expect((await enter(cy, original)).status).toBe(409); // submissions closed
    expect((await call("/api/events/jam-1/ballot", "PUT", ada, { entryId: a.id })).status).toBe(403);
    await call("/api/events/jam-1/ballot", "PUT", ada, { entryId: b.id });
    await call("/api/events/jam-1/ballot", "PUT", cy, { entryId: a.id });
    await call("/api/events/jam-1/ballot", "PUT", cy, { entryId: b.id }); // changes vote, not a second one
    const board = await api<{ items: EventEntry[] }>("/api/events/jam-1/entries?sort=rank");
    expect(board.body.items.map((e) => [e.project.slug, e.voteCount, e.rank])).toEqual([
      ["bo-tool", 2, 1],
      ["ada-tool", 0, 2],
    ]);
    // A banned voter stops counting.
    await env.DB.prepare(`UPDATE users SET banned_at = ? WHERE id = 'usr_cy'`).bind(Date.now()).run();
    expect((await api<{ items: EventEntry[] }>("/api/events/jam-1/entries?sort=rank")).body.items[0]!.voteCount).toBe(1);
  });

  it("Fork Friday entries must descend from the featured project", async () => {
    await jam("fork_friday", original);
    expect((await enter(ada, adaProject)).status).toBe(403);
    await env.DB.prepare(`INSERT INTO forks (child_id, parent_id) VALUES (?, ?)`).bind(adaProject, original).run();
    expect((await enter(ada, adaProject)).status).toBe(200);
  });

  it("ended events keep their results", async () => {
    const e = await jam();
    await env.DB.prepare(`UPDATE growth_events SET starts_at = ?, submission_ends_at = ?, voting_ends_at = ?`).bind(Date.now() - 3 * H, Date.now() - 2 * H, Date.now() - H).run();
    expect((await call(`/api/admin/events/${e.id}`, "PATCH", admin, { cancelled: true })).status).toBe(409);
    expect((await call<GrowthEvent>(`/api/admin/events/${e.id}`, "PATCH", admin, { title: "Tiny tools jam (results)" })).body.title).toBe("Tiny tools jam (results)");
  });
});
