import { beforeEach, describe, expect, it } from "vitest";
import { routes, type Collection, type CollectionDetail, type Follow } from "@forkvlift/shared";
import { api, env, resetDb, seedCategory, seedProject, seedUser } from "./helpers";

let adaId = "", boId = "", ada = "", bo = "", project = "", unlicensed = "", ownPrivate = "", foreignPrivate = "";
const json = (body: unknown) => JSON.stringify(body);
const write = (path: string, method: string, body?: unknown, as = ada) => api(path, { method, as, ...(body === undefined ? {} : { body: json(body) }) });
async function create(isPublic = false) {
  const result = await api<Collection>("/api/collections", { method: "POST", as: ada, body: json({ name: "Weekend projects", description: "Projects to explore", isPublic }) });
  expect(result.status).toBe(200);
  expect(routes.createCollection.response.safeParse(result.body).success).toBe(true);
  return result.body;
}
beforeEach(async () => {
  await resetDb();
  await seedCategory("tools");
  adaId = `usr_ada_${crypto.randomUUID()}`; boId = `usr_bo_${crypto.randomUUID()}`;
  ada = await seedUser(adaId, "ada");
  bo = await seedUser(boId, "bo");
  project = await seedProject({ slug: "planner", owner: adaId, tags: ["plan"], stage: "wip" });
  unlicensed = await seedProject({ slug: "no-license", owner: boId, license: null });
  ownPrivate = await seedProject({ slug: "private-idea", owner: adaId, isPublic: false });
  foreignPrivate = await seedProject({ slug: "other-private", owner: boId, isPublic: false });
});

describe("follows", () => {
  it("requires sign-in and rejects self-follows", async () => {
    expect((await write("/api/follows", "POST", { targetType: "user", targetId: boId }, "")).status).toBe(401);
    expect((await write("/api/follows", "POST", { targetType: "user", targetId: adaId })).status).toBe(400);
    expect((await api("/api/me/following")).status).toBe(401);
  });
  it("404s missing or inaccessible targets for follow and unfollow", async () => {
    for (const targetType of ["user", "category", "project"]) for (const method of ["POST", "DELETE"])
      expect((await write("/api/follows", method, { targetType, targetId: "missing" })).status).toBe(404);
    expect((await write("/api/follows", "POST", { targetType: "project", targetId: foreignPrivate })).status).toBe(404);
    await env.DB.prepare("UPDATE categories SET status = 'rejected' WHERE slug = 'tools'").run();
    expect((await write("/api/follows", "POST", { targetType: "category", targetId: "tools" })).status).toBe(404);
  });
  it("follows all target types idempotently and paginates without repeats", async () => {
    const targets = [{ targetType: "user", targetId: boId }, { targetType: "category", targetId: "tools" }, { targetType: "project", targetId: project }];
    for (const body of targets) {
      expect((await write("/api/follows", "POST", body)).status).toBe(200);
      expect((await write("/api/follows", "POST", body)).status).toBe(200);
    }
    const page1 = await api<{ items: Follow[]; nextCursor: string }>("/api/me/following?limit=2", { as: ada });
    const page2 = await api<{ items: Follow[]; nextCursor: string | null }>(`/api/me/following?limit=2&cursor=${page1.body.nextCursor}`, { as: ada });
    const items = [...page1.body.items, ...page2.body.items];
    expect(items).toHaveLength(3);
    expect(new Set(items.map(f => f.targetType))).toEqual(new Set(["user", "category", "project"]));
    expect(items.map(f => f.href)).toEqual(expect.arrayContaining(["/u/bo", "/?category=tools", "/p/planner"]));
    expect(page2.body.nextCursor).toBeNull();
    expect(routes.listFollowing.response.safeParse(page1.body).success).toBe(true);
    expect((await api<{ items: Follow[] }>("/api/me/following", { as: bo })).body.items).toEqual([]);
    expect((await api("/api/me/following?cursor=not-base64", { as: ada })).status).toBe(400);
    for (const body of targets) {
      expect((await write("/api/follows", "DELETE", body)).status).toBe(200);
      expect((await write("/api/follows", "DELETE", body)).status).toBe(200);
    }
    expect((await api<{ items: Follow[] }>("/api/me/following", { as: ada })).body.items).toEqual([]);
  });
  it("omits targets after they become hidden, deleted, or inactive", async () => {
    await write("/api/follows", "POST", { targetType: "project", targetId: project });
    await write("/api/follows", "POST", { targetType: "user", targetId: boId });
    await write("/api/follows", "POST", { targetType: "category", targetId: "tools" });
    await env.DB.batch([
      env.DB.prepare("UPDATE projects SET hidden_at = ? WHERE id = ?").bind(Date.now(), project),
      env.DB.prepare("UPDATE users SET deleted_at = ? WHERE id = ?").bind(Date.now(), boId),
      env.DB.prepare("UPDATE categories SET status = 'rejected' WHERE slug = 'tools'"),
    ]);
    expect((await api<{ items: Follow[] }>("/api/me/following", { as: ada })).body.items).toEqual([]);
  });
});

describe("collections and bookmarks", () => {
  it("creates one private Saved collection atomically, only when the owner needs it", async () => {
    expect((await api<{ items: Collection[] }>("/api/users/ada/collections")).body.items).toEqual([]);
    expect((await env.DB.prepare("SELECT count(*) AS n FROM collections").first<{ n: number }>())?.n).toBe(0);
    const results = await Promise.all(Array.from({ length: 4 }, () => api<{ items: Collection[] }>("/api/users/ADA/collections", { as: ada })));
    for (const result of results) {
      expect(result.body.items).toHaveLength(1);
      expect(result.body.items[0]).toMatchObject({ name: "Saved", isDefault: true, isPublic: false, itemCount: 0 });
    }
    expect(new Set(results.map(r => r.body.items[0]!.id)).size).toBe(1);
    expect((await api("/api/users/missing/collections")).status).toBe(404);
  });
  it("preserves Saved identity but allows description and visibility changes", async () => {
    const saved = (await api<{ items: Collection[] }>("/api/users/ada/collections", { as: ada })).body.items[0]!;
    expect((await write(`/api/collections/${saved.id}`, "PATCH", { name: "Renamed" })).status).toBe(400);
    expect((await write(`/api/collections/${saved.id}`, "DELETE")).status).toBe(400);
    expect((await write(`/api/collections/${saved.id}`, "PATCH", { name: "Saved", description: "My bookmarks", isPublic: true })).status).toBe(200);
    expect((await api<CollectionDetail>(`/api/collections/${saved.id}`)).body.collection).toMatchObject({ name: "Saved", description: "My bookmarks", isDefault: true, isPublic: true });
  });
  it("404s private collections to other users and anonymous viewers on every route", async () => {
    const col = await create();
    const path = `/api/collections/${col.id}`;
    expect((await api(path)).status).toBe(404);
    expect((await api(path, { as: bo })).status).toBe(404);
    expect((await write(path, "PATCH", { name: "stolen" }, bo)).status).toBe(404);
    expect((await write(path, "DELETE", undefined, bo)).status).toBe(404);
    expect((await write(`${path}/items`, "POST", { projectId: project }, bo)).status).toBe(404);
    expect((await write(`${path}/items/${project}`, "DELETE", undefined, bo)).status).toBe(404);
    expect((await api<{ items: Collection[] }>("/api/users/ada/collections", { as: bo })).body.items).toEqual([]);
    expect((await api(path, { as: ada })).status).toBe(200);
  });
  it("public collections can be read but only their owner can edit or delete them", async () => {
    const col = await create(true);
    const path = `/api/collections/${col.id}`;
    expect((await api(path)).status).toBe(200);
    for (const [url, method, body] of [[path, "PATCH", { name: "stolen" }], [path, "DELETE", undefined], [`${path}/items`, "POST", { projectId: project }], [`${path}/items/${project}`, "DELETE", undefined]] as const)
      expect((await write(url, method, body, bo)).status).toBe(403);
    expect((await write(path, "PATCH", { name: "Actual edit", description: "Owner edit", isPublic: false })).status).toBe(200);
    expect((await api(path)).status).toBe(404);
    expect((await write(path, "DELETE")).status).toBe(200);
    expect((await api(path, { as: ada })).status).toBe(404);
  });
  it("adds/removes idempotently, maps complete WIP cards and updates saved flags", async () => {
    const col = await create(true);
    const path = `/api/collections/${col.id}`;
    for (let i = 0; i < 2; i++) expect((await write(`${path}/items`, "POST", { projectId: project })).status).toBe(200);
    const detail = await api<CollectionDetail>(path, { as: ada });
    expect(routes.getCollection.response.safeParse(detail.body).success).toBe(true);
    expect(detail.body.collection.itemCount).toBe(1);
    expect(detail.body.items).toHaveLength(1);
    expect(detail.body.items[0]).toMatchObject({ id: project, stage: "wip", tags: ["plan"], author: { username: "ada" }, viewer: { saved: true } });
    expect((await api<CollectionDetail>(path)).body.items[0]?.viewer).toBeNull();
    for (let i = 0; i < 2; i++) expect((await write(`${path}/items/${project}`, "DELETE")).status).toBe(200);
    expect((await api<CollectionDetail>(path, { as: ada })).body.items).toEqual([]);
    expect((await api<{ items: { viewer: { saved: boolean } }[] }>("/api/projects", { as: ada })).body.items.every(p => !p.viewer.saved)).toBe(true);
  });
  it("only the collection owner sees unlicensed and their own private cards; counts never leak them", async () => {
    const col = await create(true);
    const path = `/api/collections/${col.id}`;
    for (const projectId of [project, unlicensed, ownPrivate]) expect((await write(`${path}/items`, "POST", { projectId })).status).toBe(200);
    expect((await write(`${path}/items`, "POST", { projectId: foreignPrivate })).status).toBe(404);
    expect((await write(`${path}/items`, "POST", { projectId: "missing" })).status).toBe(404);
    expect((await api<CollectionDetail>(path, { as: ada })).body.items.map(p => p.id)).toEqual([project, unlicensed, ownPrivate]);
    for (const as of [undefined, bo]) {
      const detail = await api<CollectionDetail>(path, { as });
      expect(detail.body.items.map(p => p.id)).toEqual([project]);
      expect(detail.body.collection.itemCount).toBe(1);
      const list = await api<{ items: Collection[] }>("/api/users/ada/collections", { as });
      expect(list.body.items[0]?.itemCount).toBe(1);
    }
    await env.DB.prepare("UPDATE projects SET hidden_at = ? WHERE id = ?").bind(Date.now(), unlicensed).run();
    expect((await api<CollectionDetail>(path, { as: ada })).body.items).toHaveLength(2);
  });
  it("deleting a collection cascades its items without affecting other collections", async () => {
    const col = await create(), other = await create();
    for (const id of [col.id, other.id]) await write(`/api/collections/${id}/items`, "POST", { projectId: project });
    await write(`/api/collections/${col.id}`, "DELETE");
    expect((await env.DB.prepare("SELECT count(*) AS n FROM collection_items WHERE collection_id = ?").bind(col.id).first<{ n: number }>())?.n).toBe(0);
    expect((await api<CollectionDetail>(`/api/collections/${other.id}`, { as: ada })).body.items).toHaveLength(1);
  });
  it("authenticates every collection write and rejects malformed bodies", async () => {
    const col = await create(true);
    for (const [path, method, body] of [["/api/collections", "POST", {}], [`/api/collections/${col.id}`, "PATCH", {}], [`/api/collections/${col.id}`, "DELETE", undefined], [`/api/collections/${col.id}/items`, "POST", { projectId: project }], [`/api/collections/${col.id}/items/${project}`, "DELETE", undefined]] as const)
      expect((await write(path, method, body, "")).status).toBe(401);
    expect((await write("/api/collections", "POST", { name: "", description: "", isPublic: false })).status).toBe(400);
    expect((await write(`/api/collections/${col.id}/items`, "POST", { projectId: "" })).status).toBe(400);
  });
});
