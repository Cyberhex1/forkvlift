import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Award, CompetitionRound, EventEntry, GrowthEvent, Scorecard } from "@forkvlift/shared";
import { api, env, resetDb, seedCategory, seedProject, seedUser } from "./helpers";

let ada = "";
let bo = "";
let judge = "";
let admin = "";
let adaProject = "";
let boProject = "";
const H = 3_600_000;

beforeEach(async () => {
  await resetDb();
  await seedCategory("tools");
  ada = await seedUser("usr_ada", "ada");
  bo = await seedUser("usr_bo", "bo");
  judge = await seedUser("usr_jo", "jo");
  admin = await seedUser("usr_boss", "boss", { role: "admin" });
  adaProject = await seedProject({ slug: "ada-tool", owner: "usr_ada" });
  boProject = await seedProject({ slug: "bo-tool", owner: "usr_bo" });
  vi.stubGlobal("fetch", async () => Response.json({ success: true }));
});
afterEach(() => vi.unstubAllGlobals());

const call = <T>(path: string, method: string, as: string | undefined, body?: unknown) => api<T>(path, { method, as, body: body === undefined ? undefined : JSON.stringify(body) });
const iso = (offset: number) => new Date(Date.now() + offset).toISOString();

async function setup() {
  const ev = (await call<GrowthEvent>("/api/admin/events", "POST", admin, { slug: "cup-jam", kind: "build_jam", title: "Cup jam", bodyMd: "", featuredProjectId: null, startsAt: iso(-H), submissionEndsAt: iso(H), votingEndsAt: iso(2 * H) })).body;
  const comp = await call<CompetitionRound>("/api/admin/competitions", "POST", admin, {
    eventId: ev.id, slug: "tiny-cup", title: "Tiny Tools Cup", rulesMd: "Be nice", eligibilityMd: "Open licenses",
    judgingEndsAt: iso(3 * H),
    prizes: [{ label: "Best tool", descriptionMd: "Glory", sponsorName: null, sponsorUrl: null, place: 1 }],
    criteria: [{ label: "Useful", description: "", maxScore: 10, weight: 2 }, { label: "Polish", description: "", maxScore: 5, weight: 1 }],
    judgeUsernames: ["jo", "bo"],
  });
  expect(comp.status).toBe(200);
  return { ev, comp: comp.body };
}
const enter = (as: string, projectId: string) => call<EventEntry>("/api/events/cup-jam/entries", "POST", as, { projectId, turnstileToken: "t" });
const toJudging = () => env.DB.prepare(`UPDATE growth_events SET submission_ends_at = ?`).bind(Date.now() - 1000).run();
const closeJudging = () => env.DB.prepare(`UPDATE competition_rounds SET judging_ends_at = ?`).bind(Date.now() - 1000).run();

describe("competitions", () => {
  it("admins can list and reopen drafts; the public and members can't", async () => {
    const { comp } = await setup();
    const list = await call<{ items: CompetitionRound[] }>("/api/admin/competitions", "GET", admin);
    expect(list.body.items.map((r) => [r.slug, r.status])).toEqual([["tiny-cup", "draft"]]);
    expect((await call<CompetitionRound>(`/api/admin/competitions/${comp.id}`, "GET", admin)).body.status).toBe("draft");
    expect((await call("/api/admin/competitions", "GET", ada)).status).toBe(403);
    expect((await call(`/api/admin/competitions/${comp.id}`, "GET", ada)).status).toBe(403);
    expect((await api<{ items: CompetitionRound[] }>("/api/competitions")).body.items).toEqual([]);
  });

  it("drafts stay hidden until opened, and prizes freeze once open", async () => {
    const { comp } = await setup();
    expect(comp.status).toBe("draft");
    expect((await api("/api/competitions/tiny-cup")).status).toBe(404);
    const opened = await call<CompetitionRound>(`/api/admin/competitions/${comp.id}`, "PATCH", admin, { open: true });
    expect(opened.body.status).toBe("open");
    expect((await api<CompetitionRound>("/api/competitions/tiny-cup")).body.prizes.map((p) => p.label)).toEqual(["Best tool"]);
    expect((await call(`/api/admin/competitions/${comp.id}`, "PATCH", admin, { open: false })).status).toBe(409);
  });

  it("judges score others' entries during judging only; scores are bounded and final once submitted", async () => {
    const { comp } = await setup();
    await call(`/api/admin/competitions/${comp.id}`, "PATCH", admin, { open: true });
    const a = (await enter(ada, adaProject)).body;
    const b = (await enter(bo, boProject)).body;
    const crit = comp.criteria;
    const full = (u: number, p: number) => ({ scores: [{ criterionId: crit[0]!.id, score: u }, { criterionId: crit[1]!.id, score: p }], note: "", submit: true });

    expect((await call(`/api/competitions/tiny-cup/scorecards/${a.id}`, "PUT", judge, full(8, 4))).status).toBe(409); // still open
    await toJudging();
    expect((await call(`/api/competitions/tiny-cup/scorecards/${a.id}`, "PUT", ada, full(8, 4))).status).toBe(403); // not a judge
    expect((await call(`/api/competitions/tiny-cup/scorecards/${b.id}`, "PUT", bo, full(10, 5))).status).toBe(403); // own entry
    expect((await call(`/api/competitions/tiny-cup/scorecards/${a.id}`, "PUT", judge, full(11, 4))).status).toBe(400); // out of range
    expect((await call(`/api/competitions/tiny-cup/scorecards/${a.id}`, "PUT", judge, { scores: [{ criterionId: crit[0]!.id, score: 8 }], note: "", submit: true })).status).toBe(400); // incomplete
    expect((await call<Scorecard>(`/api/competitions/tiny-cup/scorecards/${a.id}`, "PUT", judge, full(8, 4))).body.submittedAt).not.toBeNull();
    expect((await call(`/api/competitions/tiny-cup/scorecards/${a.id}`, "PUT", judge, full(1, 1))).status).toBe(409); // final
    await call(`/api/competitions/tiny-cup/scorecards/${b.id}`, "PUT", judge, full(5, 5));
    await call(`/api/competitions/tiny-cup/scorecards/${a.id}`, "PUT", bo, full(10, 5));

    const judging = await call<{ conflicts: string[] }>("/api/competitions/tiny-cup/judging", "GET", bo);
    expect(judging.body.conflicts).toEqual([b.id]);
    const sc = await call<{ items: { entry: EventEntry; total: number; scorecards: number }[] }>(`/api/admin/competitions/${comp.id}/scores`, "GET", admin);
    // ada: (8/10*2 + 4/5*1 = 2.4) and (10/10*2 + 5/5 = 3) → 2.7; bo: 5/10*2 + 5/5 = 2
    expect(sc.body.items.map((x) => [x.entry.project.slug, x.total, x.scorecards])).toEqual([
      ["ada-tool", 2.7, 2],
      ["bo-tool", 2, 1],
    ]);
  });

  it("publishes once, with version checks, and winners stay on record", async () => {
    const { comp } = await setup();
    const opened = (await call<CompetitionRound>(`/api/admin/competitions/${comp.id}`, "PATCH", admin, { open: true })).body;
    const a = (await enter(ada, adaProject)).body;
    expect((await api<{ awards: Award[] }>("/api/competitions/tiny-cup/winners")).body.awards).toEqual([]);
    const prize = opened.prizes[0]!.id;
    expect((await call(`/api/admin/competitions/${comp.id}/publish`, "POST", admin, { awards: [{ prizeId: prize, entryId: a.id, rationaleMd: "" }], expectedVersion: opened.version })).status).toBe(409); // still open
    await toJudging();
    expect((await call(`/api/admin/competitions/${comp.id}/publish`, "POST", admin, { awards: [{ prizeId: prize, entryId: a.id, rationaleMd: "" }], expectedVersion: opened.version })).status).toBe(409); // judging still open
    await closeJudging();
    expect((await call(`/api/admin/competitions/${comp.id}/publish`, "POST", admin, { awards: [{ prizeId: prize, entryId: a.id, rationaleMd: "" }], expectedVersion: 1 })).status).toBe(409); // stale
    const pub = await call<{ awards: Award[] }>(`/api/admin/competitions/${comp.id}/publish`, "POST", admin, { awards: [{ prizeId: prize, entryId: a.id, rationaleMd: "Clean and useful" }], expectedVersion: opened.version });
    expect(pub.status).toBe(200);
    expect(pub.body.awards.map((w) => w.entry.project.slug)).toEqual(["ada-tool"]);
    expect((await call(`/api/admin/competitions/${comp.id}/publish`, "POST", admin, { awards: [{ prizeId: prize, entryId: a.id, rationaleMd: "" }], expectedVersion: opened.version + 1 })).status).toBe(409);
    expect((await call(`/api/admin/competitions/${comp.id}`, "PATCH", admin, { cancelled: true })).status).toBe(409);
    const winners = await api<{ competition: CompetitionRound; awards: Award[] }>("/api/competitions/tiny-cup/winners");
    expect(winners.body.competition.status).toBe("published");
    expect(winners.body.awards[0]!.rationaleMd).toBe("Clean and useful");
  });
});
