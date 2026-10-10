import { beforeEach, describe, expect, it } from "vitest";
import type { Profile } from "@forkvlift/shared";
import { app } from "../../src/app";
import { api, env, resetDb, seedCategory, seedProject, seedUser } from "./helpers";
import { COOKIES } from "@forkvlift/shared";

let ada = "";
let bo = "";
let adaProject = "";
beforeEach(async () => {
  await resetDb();
  await seedCategory("tools");
  ada = await seedUser("usr_ada", "ada");
  bo = await seedUser("usr_bo", "bo");
  adaProject = await seedProject({ slug: "ada-one", owner: "usr_ada", forks: 7 });
  await seedProject({ slug: "ada-secret", owner: "usr_ada", license: null });
  const child = await seedProject({ slug: "bo-fork", owner: "usr_bo" });
  await env.DB.prepare(`INSERT INTO forks (child_id, parent_id) VALUES (?, ?)`).bind(child, adaProject).run();
});

const json = (method: string, body: unknown, as = ada) => ({ method, as, body: JSON.stringify(body) });

describe("profiles", () => {
  it("shows stats, showcase and viewer flags", async () => {
    await api("/api/me/showcase", json("PUT", { projectIds: [adaProject] }));
    await api("/api/follows", json("POST", { targetType: "user", targetId: "usr_ada" }, bo)); // 2.5 (Sol); fine if 501
    const res = await api<Profile>("/api/users/ADA", { as: bo });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      user: { username: "ada" },
      // "Projects published" counts every listed project, unlicensed included.
      stats: { projects: 2, forksOfWork: 7, forkedBy: 1 },
      showcase: [{ slug: "ada-one" }],
      viewer: { isSelf: false, blocked: false },
    });
    expect((await api("/api/users/nobody")).status).toBe(404);
  });

  it("edits the profile and refuses taken or reserved usernames", async () => {
    const edited = await api<Profile>("/api/me", json("PATCH", { displayName: "Ada L.", bio: "Builds things", username: "ada-l" }));
    expect(edited.body).toMatchObject({ user: { username: "ada-l", displayName: "Ada L." }, bio: "Builds things" });
    expect((await api("/api/me", json("PATCH", { username: "BO" }))).status).toBe(409);
    expect((await api("/api/me", json("PATCH", { username: "admin" }))).status).toBe(400);
  });

  it("only pins your own public projects", async () => {
    const bos = await env.DB.prepare(`SELECT id FROM projects WHERE slug = 'bo-fork'`).first<{ id: string }>();
    expect((await api("/api/me/showcase", json("PUT", { projectIds: [bos!.id] }))).status).toBe(400);
  });

  it("saves the avatar", async () => {
    const avatar = { hair: "bob", outfit: "hoodie", color: "pixel-9", accessory: null };
    await api("/api/me/avatar", json("PUT", avatar));
    expect((await api<Profile>("/api/users/ada")).body.user.avatar).toEqual(avatar);
  });
});

describe("settings", () => {
  it("needs the disclaimer before showing unlicensed projects", async () => {
    expect((await api("/api/me/settings", json("PATCH", { showUnlicensed: true }))).status).toBe(400);
    const ok = await api<{ showUnlicensed: boolean; unlicensedDisclaimerAcceptedAt: string | null }>("/api/me/settings", json("PATCH", { showUnlicensed: true, acceptUnlicensedDisclaimer: true }));
    expect(ok.body.showUnlicensed).toBe(true);
    expect(ok.body.unlicensedDisclaimerAcceptedAt).not.toBeNull();
  });
});

describe("export and delete", () => {
  it("exports everything the user made", async () => {
    const res = await app.request("/api/me/export", { headers: { cookie: `${COOKIES.session}=${ada}` } }, env);
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="forklift-export-/);
    const data = (await res.json()) as { user: { username: string }; projects: unknown[] };
    expect(data.user.username).toBe("ada");
    expect(data.projects).toHaveLength(2);
  });

  it("deletes the account after typed confirmation", async () => {
    expect((await api("/api/me", json("DELETE", { confirmUsername: "nope" }))).status).toBe(400);
    expect((await api("/api/me", json("DELETE", { confirmUsername: "Ada" }))).status).toBe(200);
    expect((await api("/api/users/ada")).status).toBe(404);
    expect((await api("/api/projects/ada-one")).status).toBe(404);
    expect((await api<{ user: unknown }>("/api/auth/me", { as: ada })).body.user).toBeNull();
    const row = await env.DB.prepare(`SELECT email, github_id, display_name FROM users WHERE id = 'usr_ada'`).first();
    expect(row).toMatchObject({ email: null, github_id: null, display_name: "Deleted user" });
  });
});
