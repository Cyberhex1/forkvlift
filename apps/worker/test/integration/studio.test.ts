import { beforeEach, describe, expect, it } from "vitest";
import type { Board, BoardCard, BoardColumn, ProjectDetail, ProjectPlan } from "@forkvlift/shared";
import { api, env, resetDb, seedCategory, seedProject, seedUser } from "./helpers";

let ada = "";
let bo = "";
beforeEach(async () => {
  await resetDb();
  await env.DB.prepare(`DELETE FROM roadmap_items`).run();
  await seedCategory("tools");
  ada = await seedUser("usr_ada", "ada");
  bo = await seedUser("usr_bo", "bo");
});

const call = <T>(path: string, method = "GET", body?: unknown, as = ada) => api<T>(path, { method, as, body: body === undefined ? undefined : JSON.stringify(body) });
const board = async (as = ada) => (await call<Board>("/api/studio/board", "GET", undefined, as)).body;
const addCard = async (columnId: string, title: string, projectId: string | null = null) =>
  (await call<BoardCard>("/api/studio/cards", "POST", { columnId, title, idea: null, projectId })).body;
const titlesIn = (b: Board, columnId: string) => b.cards.filter((c) => c.columnId === columnId).sort((x, y) => x.position - y.position).map((c) => c.title);

describe("board", () => {
  it("is created with the default columns on first visit, once", async () => {
    const b = await board();
    expect(b.columns.map((c) => c.title)).toEqual(["Idea", "Develop", "Bug fix", "Ready for release"]);
    expect((await board()).id).toBe(b.id);
    expect((await api("/api/studio/board")).status).toBe(401);
  });

  it("is private to its owner", async () => {
    const col = (await board()).columns[0]!;
    const card = await addCard(col.id, "Secret idea");
    await board(bo);
    expect((await call(`/api/studio/cards/${card.id}`, "PATCH", { title: "x" }, bo)).status).toBe(404);
    expect((await call(`/api/studio/columns/${col.id}`, "PATCH", { title: "x" }, bo)).status).toBe(404);
    expect((await call(`/api/studio/cards/${card.id}/plan`, "GET", undefined, bo)).status).toBe(404);
  });
});

describe("columns", () => {
  it("adds, renames, recolors, collapses, reorders and deletes", async () => {
    const b = await board();
    const created = (await call<BoardColumn>("/api/studio/columns", "POST", { title: "Testing" })).body;
    expect(created.position).toBe(4);
    const patched = (await call<BoardColumn>(`/api/studio/columns/${created.id}`, "PATCH", { title: "QA", color: "pixel-6", collapsed: true, wipLimit: 2 })).body;
    expect(patched).toMatchObject({ title: "QA", color: "pixel-6", collapsed: true, wipLimit: 2 });
    expect((await call(`/api/studio/columns/${created.id}`, "PATCH", { color: "#ff0000" })).status).toBe(400);

    const order = [created.id, ...b.columns.map((c) => c.id)];
    const reordered = (await call<{ columns: BoardColumn[] }>("/api/studio/columns/order", "PUT", { columnIds: order })).body.columns;
    expect(reordered.map((c) => c.title)).toEqual(["QA", "Idea", "Develop", "Bug fix", "Ready for release"]);
    expect((await call("/api/studio/columns/order", "PUT", { columnIds: order.slice(1) })).status).toBe(400);
  });

  it("moves cards to the first column when a column is deleted, and keeps at least one", async () => {
    const b = await board();
    const [idea, develop] = b.columns;
    await addCard(idea!.id, "A");
    await addCard(develop!.id, "B");
    await call(`/api/studio/columns/${develop!.id}`, "DELETE");
    const after = await board();
    expect(after.columns).toHaveLength(3);
    expect(titlesIn(after, idea!.id)).toEqual(["A", "B"]);
    for (const c of after.columns.slice(1)) await call(`/api/studio/columns/${c.id}`, "DELETE");
    expect((await call(`/api/studio/columns/${idea!.id}`, "DELETE")).status).toBe(409);
  });
});

describe("cards", () => {
  it("moves within and across columns with dense positions", async () => {
    const [idea, develop] = (await board()).columns;
    const a = await addCard(idea!.id, "A");
    await addCard(idea!.id, "B");
    await addCard(idea!.id, "C");
    await call(`/api/studio/cards/${a.id}/move`, "POST", { columnId: idea!.id, position: 2 });
    expect(titlesIn(await board(), idea!.id)).toEqual(["B", "C", "A"]);
    await call(`/api/studio/cards/${a.id}/move`, "POST", { columnId: develop!.id, position: 0 });
    const after = await board();
    expect(titlesIn(after, idea!.id)).toEqual(["B", "C"]);
    expect(after.cards.filter((c) => c.columnId === idea!.id).map((c) => c.position).sort()).toEqual([0, 1]);
    expect(titlesIn(after, develop!.id)).toEqual(["A"]);
  });

  it("enforces WIP limits on add and move", async () => {
    const [idea, develop] = (await board()).columns;
    await call(`/api/studio/columns/${develop!.id}`, "PATCH", { wipLimit: 1 });
    await addCard(develop!.id, "Busy");
    expect((await call("/api/studio/cards", "POST", { columnId: develop!.id, title: "Too many", idea: null, projectId: null })).status).toBe(409);
    const waiting = await addCard(idea!.id, "Waiting");
    expect((await call(`/api/studio/cards/${waiting.id}/move`, "POST", { columnId: develop!.id, position: 0 })).status).toBe(409);
  });

  it("links own projects only, and publishing syncs the project", async () => {
    const mine = await seedProject({ slug: "mine", owner: "usr_ada", stage: "wip", isPublic: false });
    const theirs = await seedProject({ slug: "theirs", owner: "usr_bo" });
    const col = (await board()).columns[1]!;
    expect((await call("/api/studio/cards", "POST", { columnId: col.id, title: "x", idea: null, projectId: theirs })).status).toBe(400);
    const card = await addCard(col.id, "Mine", mine);
    expect(card.project?.slug).toBe("mine");
    expect((await call("/api/studio/cards", "POST", { columnId: col.id, title: "dup", idea: null, projectId: mine })).status).toBe(409);

    await call(`/api/studio/cards/${card.id}`, "PATCH", { isPublic: true, stage: "adoption" });
    const project = await api<ProjectDetail>("/api/projects/mine");
    expect(project.status).toBe(200);
    expect(project.body.stage).toBe("adoption");
  });

  it("shows the Studio column on public WIP cards", async () => {
    const mine = await seedProject({ slug: "wipper", owner: "usr_ada", stage: "wip" });
    const col = (await board()).columns.find((c) => c.title === "Bug fix")!;
    await addCard(col.id, "Wipper", mine);
    const list = await api<{ items: { slug: string; studioColumnTitle: string | null }[] }>("/api/projects?stage=wip");
    expect(list.body.items.find((p) => p.slug === "wipper")?.studioColumnTitle).toBe("Bug fix");
  });

  it("keeps idea cards private until they have a repo", async () => {
    const card = await addCard((await board()).columns[0]!.id, "Just an idea");
    expect((await call(`/api/studio/cards/${card.id}`, "PATCH", { isPublic: true })).status).toBe(400);
  });

  it("deletes and renumbers", async () => {
    const col = (await board()).columns[0]!;
    const a = await addCard(col.id, "A");
    await addCard(col.id, "B");
    await call(`/api/studio/cards/${a.id}`, "DELETE");
    const after = await board();
    expect(after.cards.map((c) => [c.title, c.position])).toEqual([["B", 0]]);
  });
});

describe("planning tools", () => {
  it("saves checklist, notes, prompts and a roadmap that keeps votes", async () => {
    const mine = await seedProject({ slug: "planned", owner: "usr_ada" });
    const card = await addCard((await board()).columns[1]!.id, "Planned", mine);
    const empty = (await call<ProjectPlan>(`/api/studio/cards/${card.id}/plan`)).body;
    expect(empty).toMatchObject({ checklist: [], notesMd: "", roadmap: [] });

    const plan = (
      await call<ProjectPlan>(`/api/studio/cards/${card.id}/plan`, "PATCH", {
        checklist: [{ id: "c1", text: "Ship", done: false }],
        notesMd: "# Notes",
        lookingForHelp: "Sound design",
        roadmap: [{ id: "new-1", title: "Dark mode", status: "planned", votes: 0 }],
      })
    ).body;
    expect(plan.roadmap).toHaveLength(1);
    const itemId = plan.roadmap[0]!.id;

    // A visitor upvotes; the count survives the author's next edit.
    const vote = await call<{ votes: number }>(`/api/projects/planned/roadmap/${itemId}/vote`, "POST", undefined, bo);
    expect(vote.body.votes).toBe(1);
    const edited = (await call<ProjectPlan>(`/api/studio/cards/${card.id}/plan`, "PATCH", { roadmap: [{ id: itemId, title: "Dark mode!", status: "in_progress", votes: 0 }] })).body;
    expect(edited.roadmap[0]).toMatchObject({ title: "Dark mode!", status: "in_progress", votes: 1 });
    expect(edited.checklist).toHaveLength(1); // untouched fields kept

    expect((await api<ProjectDetail>("/api/projects/planned")).body.lookingForHelp).toBe("Sound design");
  });
});
