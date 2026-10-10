import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIES, type ProjectDetail } from "@forkvlift/shared";
import { app } from "../../src/app";
import { fakeGithub } from "./github-fake";
import { api, env, resetDb, seedCategory, seedUser } from "./helpers";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

let ada = "";
let bo = "";
beforeEach(async () => {
  await resetDb();
  await env.CACHE.list().then((l) => Promise.all(l.keys.map((k) => env.CACHE.delete(k.name))));
  await seedCategory("tools");
  ada = await seedUser("usr_ada", "ada");
  bo = await seedUser("usr_bo", "bo");
  fakeGithub({ "ada/board": { owner: "ada" } });
});
afterEach(() => vi.unstubAllGlobals());

const reserve = (as: string, body: object) => api<{ key: string; uploadUrl: string }>("/api/uploads", { method: "POST", as, body: JSON.stringify(body) });
const put = (as: string, url: string, bytes: Uint8Array | string, type: string) =>
  app.request(url, { method: "PUT", headers: { cookie: `${COOKIES.session}=${as}`, "content-type": type }, body: bytes }, env);

describe("uploads", () => {
  it("reserves, uploads and serves an image", async () => {
    const r = await reserve(ada, { kind: "thumbnail", contentType: "image/png", size: PNG.byteLength });
    expect(r.status).toBe(200);
    const res = await put(ada, r.body.uploadUrl, PNG, "image/png");
    expect(res.status).toBe(200);
    const { url } = (await res.json()) as { url: string };
    const served = await app.request(url, {}, env);
    expect(served.headers.get("content-type")).toBe("image/png");
    expect(served.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG);
  });

  it("refuses wrong types, oversize files and disguised HTML", async () => {
    expect((await reserve(ada, { kind: "thumbnail", contentType: "image/svg+xml", size: 10 })).status).toBe(400);
    expect((await reserve(ada, { kind: "avatar", contentType: "image/png", size: 3 * 1024 * 1024 })).status).toBe(400);
    const r = await reserve(ada, { kind: "thumbnail", contentType: "image/png", size: 100 });
    expect((await put(ada, r.body.uploadUrl, "<script>alert(1)</script>", "image/png")).status).toBe(400);
  });

  it("only lets the reserving user upload", async () => {
    const r = await reserve(ada, { kind: "thumbnail", contentType: "image/png", size: PNG.byteLength });
    expect((await put(bo, r.body.uploadUrl, PNG, "image/png")).status).toBe(403);
  });

  it("attaches uploads to a project as thumbnail and gallery, but only the owner's", async () => {
    const r = await reserve(ada, { kind: "thumbnail", contentType: "image/png", size: PNG.byteLength });
    await put(ada, r.body.uploadUrl, PNG, "image/png");
    const body = {
      name: "Board", repoUrl: "https://github.com/ada/board", tagline: "", description: "", categorySlug: "tools", tags: [], stage: "finished",
      isPublic: true, liveUrl: null, releaseUrl: null, stack: [], platforms: [], difficulty: null, aiTools: [], buildTime: null,
      aiInvolvement: null, replaces: [], isTemplate: false, whatWorks: null, whatsMissing: null, lookingForHelp: null,
      thumbnailKey: r.body.key, mediaKeys: [r.body.key], forkedFromSlug: null, turnstileToken: "t",
    };
    expect((await api("/api/projects", { method: "POST", as: bo, body: JSON.stringify({ ...body, repoUrl: null }) })).status).toBe(400);
    const created = await api<ProjectDetail>("/api/projects", { method: "POST", as: ada, body: JSON.stringify(body) });
    expect(created.body.thumbnailUrl).toBe(`/api/media/${r.body.key}`);
    expect(created.body.media).toMatchObject([{ kind: "image", url: `/api/media/${r.body.key}` }]);
  });

  it("404s unknown media keys", async () => {
    expect((await app.request("/api/media/thumbnail.usr_x.aaaaaaaaaaaaaaaa.png", {}, env)).status).toBe(404);
    expect((await app.request("/api/media/..%2Fsecret", {}, env)).status).toBe(404);
  });
});
