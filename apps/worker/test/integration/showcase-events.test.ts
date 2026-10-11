import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GrowthEvent, GrowthEventDetail, ShowcaseDetail, ShowcaseEventEntry } from "@forkvlift/shared";
import { api, env, resetDb, seedCategory, seedProject, seedUser } from "./helpers";

let ada = "";
let bo = "";
let cy = "";
let admin = "";
const H = 3_600_000;

beforeEach(async () => {
  await resetDb();
  await seedCategory("games");
  await seedCategory("tools");
  ada = await seedUser("usr_ada", "ada");
  bo = await seedUser("usr_bo", "bo");
  cy = await seedUser("usr_cy", "cy");
  admin = await seedUser("usr_boss", "boss", { role: "admin" });
  vi.stubGlobal("fetch", async () => Response.json({ success: true }));
});
afterEach(() => vi.unstubAllGlobals());

const call = <T>(path: string, method: string, as: string | undefined, body?: unknown) => api<T>(path, { method, as, body: body === undefined ? undefined : JSON.stringify(body) });
const iso = (offset: number) => new Date(Date.now() + offset).toISOString();
const showcase = async (as: string, title: string, publish = true) =>
  (
    await call<ShowcaseDetail>("/api/showcases", "POST", as, {
      title, tagline: "Made with AI", bodyMd: "", buildStoryMd: "", categorySlug: "games", kind: "game", stage: "finished", coverKey: null,
      media: [], links: [], repoUrl: null, aiTools: [], buildTime: null, tags: [], publish, turnstileToken: "t",
    })
  ).body;
async function showOff() {
  const r = await call<GrowthEvent>("/api/admin/events", "POST", admin, { slug: "show-off-1", kind: "show_off", title: "Show-off Saturday", bodyMd: "Show us what you made", featuredProjectId: null, startsAt: iso(-H), submissionEndsAt: iso(H), votingEndsAt: iso(2 * H) });
  expect(r.status).toBe(200);
  return r.body;
}
const toVoting = () => env.DB.prepare(`UPDATE growth_events SET submission_ends_at = ?, voting_ends_at = ?`).bind(Date.now() - 1000, Date.now() + H).run();
const enter = (as: string, showcaseId: string) => call<ShowcaseEventEntry>("/api/events/show-off-1/showcase-entries", "POST", as, { showcaseId, turnstileToken: "t" });

describe("showcase-only events (5.9)", () => {
  it("makers enter their own published showcases once; projects and competitions stay out", async () => {
    const a = await showcase(ada, "Neon Drift");
    const draft = await showcase(ada, "Secret Draft", false);
    const b = await showcase(bo, "Pixel Quest");
    const pid = await seedProject({ slug: "ada-tool", owner: "usr_ada" });
    await showOff();

    expect((await call<GrowthEventDetail>("/api/events/show-off-1", "GET", ada)).body.viewerCanSubmit).toBe(true);
    expect((await call<GrowthEventDetail>("/api/events/show-off-1", "GET", cy)).body.viewerCanSubmit).toBe(false);
    expect((await enter(ada, b.id)).status).toBe(403); // not theirs
    expect((await enter(ada, draft.id)).status).toBe(403); // unpublished
    expect((await enter(ada, a.id)).status).toBe(200);
    expect((await enter(ada, a.id)).status).toBe(409);
    expect((await call("/api/events/show-off-1/entries", "POST", ada, { projectId: pid, turnstileToken: "t" })).status).toBe(400);

    const ev = await call<{ id: string }>("/api/events/show-off-1", "GET", undefined);
    expect((await api<GrowthEvent>("/api/events/show-off-1")).body.entryCount).toBe(1);
    const comp = await call("/api/admin/competitions", "POST", admin, {
      eventId: ev.body.id, slug: "c", title: "Nope", rulesMd: "", eligibilityMd: "", judgingEndsAt: iso(3 * H), prizes: [],
      criteria: [{ label: "Fun", description: "", maxScore: 10, weight: 1 }], judgeUsernames: ["boss"],
    });
    expect(comp.status).toBe(400);
    expect((await call("/api/admin/events", "POST", admin, { slug: "x", kind: "show_off", title: "With feature", bodyMd: "", featuredProjectId: pid, startsAt: iso(-H), submissionEndsAt: iso(H), votingEndsAt: iso(2 * H) })).status).toBe(400);
  });

  it("one vote per person through the event ballot, no self-votes, ranked by votes", async () => {
    const a = await showcase(ada, "Neon Drift");
    const b = await showcase(bo, "Pixel Quest");
    await showOff();
    const ea = (await enter(ada, a.id)).body;
    const eb = (await enter(bo, b.id)).body;
    expect((await call("/api/events/show-off-1/ballot", "PUT", cy, { entryId: ea.id })).status).toBe(409); // not voting yet

    await toVoting();
    expect((await call(`/api/events/show-off-1/showcase-entries/${ea.id}`, "DELETE", ada)).status).toBe(409); // too late to withdraw
    expect((await call("/api/events/show-off-1/ballot", "PUT", ada, { entryId: ea.id })).status).toBe(403);
    expect((await call("/api/events/show-off-1/ballot", "PUT", ada, { entryId: eb.id })).status).toBe(200);
    expect((await call("/api/events/show-off-1/ballot", "PUT", cy, { entryId: ea.id })).status).toBe(200);
    expect((await call("/api/events/show-off-1/ballot", "PUT", cy, { entryId: eb.id })).status).toBe(200); // moved, not added

    const board = await call<{ items: ShowcaseEventEntry[] }>("/api/events/show-off-1/showcase-entries?sort=rank", "GET", cy);
    expect(board.body.items.map((i) => [i.showcase.slug, i.voteCount, i.rank, i.viewerVoted])).toEqual([
      ["pixel-quest", 2, 1, true],
      ["neon-drift", 0, 2, false],
    ]);
    expect((await call<GrowthEventDetail>("/api/events/show-off-1", "GET", cy)).body.viewerBallot).toBe(eb.id);

    // Banned voters stop counting; hidden showcases drop out.
    await env.DB.prepare(`UPDATE users SET banned_at = ? WHERE id = 'usr_cy'`).bind(Date.now()).run();
    expect((await api<{ items: ShowcaseEventEntry[] }>("/api/events/show-off-1/showcase-entries?sort=rank")).body.items[0]!.voteCount).toBe(1);
    await env.DB.prepare(`UPDATE showcases SET hidden_at = ? WHERE slug = 'pixel-quest'`).bind(Date.now()).run();
    expect((await api<{ items: ShowcaseEventEntry[] }>("/api/events/show-off-1/showcase-entries")).body.items.map((i) => i.showcase.slug)).toEqual(["neon-drift"]);
  });

  it("withdrawing an entry while submissions are open removes its votes too", async () => {
    const a = await showcase(ada, "Neon Drift");
    await showOff();
    const ea = (await enter(ada, a.id)).body;
    expect((await call(`/api/events/show-off-1/showcase-entries/${ea.id}`, "DELETE", bo)).status).toBe(404);
    expect((await call(`/api/events/show-off-1/showcase-entries/${ea.id}`, "DELETE", ada)).status).toBe(200);
    expect((await api<{ items: ShowcaseEventEntry[] }>("/api/events/show-off-1/showcase-entries")).body.items).toHaveLength(0);
    expect((await enter(ada, a.id)).status).toBe(200); // can enter again
  });
});
