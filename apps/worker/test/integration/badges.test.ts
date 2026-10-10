import { beforeEach, describe, expect, it } from "vitest";
import type { Board, BoardCard } from "@forkvlift/shared";
import { recordActiveDay } from "../../src/core/badges";
import { api, env, resetDb, seedUser } from "./helpers";

let ada = "";
beforeEach(async () => {
  await resetDb();
  ada = await seedUser("usr_ada", "ada");
});

const badges = async () => (await env.DB.prepare(`SELECT badge_key FROM user_badges WHERE user_id = 'usr_ada'`).all<{ badge_key: string }>()).results.map((r) => r.badge_key);
const call = <T>(path: string, method = "GET", body?: unknown) => api<T>(path, { method, as: ada, body: body === undefined ? undefined : JSON.stringify(body) });

describe("Bug Squasher", () => {
  it("is earned after 10 different cards leave Bug fix", async () => {
    const board = (await call<Board>("/api/studio/board")).body;
    const bug = board.columns.find((c) => c.title === "Bug fix")!;
    const done = board.columns.find((c) => c.title === "Ready for release")!;
    const cards: BoardCard[] = [];
    for (let i = 0; i < 10; i++) cards.push((await call<BoardCard>("/api/studio/cards", "POST", { columnId: bug.id, title: `Bug ${i}`, idea: null, projectId: null })).body);

    // Moving the same card out twice counts once; moves within the column don't count.
    await call(`/api/studio/cards/${cards[0]!.id}/move`, "POST", { columnId: bug.id, position: 3 });
    await call(`/api/studio/cards/${cards[0]!.id}/move`, "POST", { columnId: done.id, position: 0 });
    await call(`/api/studio/cards/${cards[0]!.id}/move`, "POST", { columnId: bug.id, position: 0 });
    await call(`/api/studio/cards/${cards[0]!.id}/move`, "POST", { columnId: done.id, position: 0 });
    for (const c of cards.slice(1, 9)) await call(`/api/studio/cards/${c.id}/move`, "POST", { columnId: done.id, position: 0 });
    expect(await badges()).not.toContain("bug-squasher");

    await call(`/api/studio/cards/${cards[9]!.id}/move`, "POST", { columnId: done.id, position: 0 });
    expect(await badges()).toContain("bug-squasher");
  });
});

describe("7-day Streak", () => {
  it("needs seven consecutive UTC days", async () => {
    const day = 86_400_000;
    const start = Date.UTC(2026, 9, 1, 12);
    for (let i = 0; i < 6; i++) await recordActiveDay(env.DB, "usr_ada", start + i * day);
    await recordActiveDay(env.DB, "usr_ada", start + 5 * day + 3600_000); // same day again
    expect(await badges()).not.toContain("streak-7");

    // A gap resets the window.
    await recordActiveDay(env.DB, "usr_ada", start + 7 * day);
    expect(await badges()).not.toContain("streak-7");

    await recordActiveDay(env.DB, "usr_ada", start + 6 * day);
    await recordActiveDay(env.DB, "usr_ada", start + 8 * day);
    expect(await badges()).toContain("streak-7");
  });
});
