import { beforeEach, describe, expect, it } from "vitest";
import type { ProjectCard, ProjectDetail } from "@forkvlift/shared";
import { api, resetDb, seedCategory, seedProject, seedUser } from "./helpers";

interface ListBody {
  items: ProjectCard[];
  nextCursor: string | null;
  hiddenUnlicensedCount: number;
}

let adaToken = "";

beforeEach(async () => {
  await resetDb();
  await seedCategory("tools");
  await seedCategory("games");
  await seedCategory("roguelikes", "games");
  adaToken = await seedUser("usr_ada", "ada", { githubLogin: "ada" });
  await seedUser("usr_bo", "bo");

  await seedProject({ slug: "plant-pal", owner: "usr_ada", tagline: "Watering reminders for plants", stars: 50, upvotes: 3, tags: ["garden"], replaces: ["Planta"] });
  await seedProject({ slug: "dungeon", owner: "usr_bo", category: "roguelikes", stage: "wip", stars: 500, forks: 40, upvotes: 1, stack: ["Godot"] });
  await seedProject({ slug: "secret-notes", owner: "usr_bo", license: null, tagline: "Notes app with no license", replaces: ["Notion"] });
  await seedProject({ slug: "private-thing", owner: "usr_ada", isPublic: false });
  await seedProject({ slug: "old-hit", owner: "usr_bo", upvotes: 30, publishedDaysAgo: 300, liveUrl: "https://example.com", staffPick: true });
});

describe("GET /api/projects", () => {
  it("hides unlicensed and private projects by default, and counts the hidden ones", async () => {
    const { status, body } = await api<ListBody>("/api/projects");
    expect(status).toBe(200);
    const slugs = body.items.map((p) => p.slug);
    expect(slugs).not.toContain("secret-notes");
    expect(slugs).not.toContain("private-thing");
    expect(body.hiddenUnlicensedCount).toBe(1);
  });

  it("shows unlicensed projects when asked", async () => {
    const { body } = await api<ListBody>("/api/projects?showUnlicensed=true");
    expect(body.items.find((p) => p.slug === "secret-notes")?.license).toBeNull();
    expect(body.hiddenUnlicensedCount).toBe(0);
  });

  it("searches names, taglines, tags and the replaces field", async () => {
    expect((await api<ListBody>("/api/projects?q=water")).body.items.map((p) => p.slug)).toEqual(["plant-pal"]);
    expect((await api<ListBody>("/api/projects?q=garden")).body.items.map((p) => p.slug)).toEqual(["plant-pal"]);
    const notion = await api<ListBody>("/api/projects?q=notion");
    expect(notion.body.items).toHaveLength(0);
    expect(notion.body.hiddenUnlicensedCount).toBe(1);
  });

  it("includes sub-categories when filtering by a parent", async () => {
    expect((await api<ListBody>("/api/projects?category=games")).body.items.map((p) => p.slug)).toEqual(["dungeon"]);
  });

  it("filters by stage, stack, demo and paid-product replacement", async () => {
    expect((await api<ListBody>("/api/projects?stage=wip")).body.items.map((p) => p.slug)).toEqual(["dungeon"]);
    expect((await api<ListBody>("/api/projects?stack=godot")).body.items.map((p) => p.slug)).toEqual(["dungeon"]);
    expect((await api<ListBody>("/api/projects?hasDemo=true")).body.items.map((p) => p.slug)).toEqual(["old-hit"]);
    expect((await api<ListBody>("/api/projects?replacesPaid=true")).body.items.map((p) => p.slug)).toEqual(["plant-pal"]);
  });

  it("sorts", async () => {
    expect((await api<ListBody>("/api/projects?sort=most_starred")).body.items[0]?.slug).toBe("dungeon");
    expect((await api<ListBody>("/api/projects?sort=newest")).body.items.at(-1)?.slug).toBe("old-hit");
    expect((await api<ListBody>("/api/projects?sort=staff_picks")).body.items.map((p) => p.slug)).toEqual(["old-hit"]);
    // Trending favors recent votes: plant-pal (3 votes, 1 day) beats old-hit (30 votes, 300 days).
    const trending = (await api<ListBody>("/api/projects")).body.items.map((p) => p.slug);
    expect(trending.indexOf("plant-pal")).toBeLessThan(trending.indexOf("old-hit"));
  });

  it("paginates without repeats, including random order", async () => {
    for (const sort of ["newest", "random"]) {
      const first = await api<ListBody>(`/api/projects?sort=${sort}&limit=2`);
      expect(first.body.items).toHaveLength(2);
      const second = await api<ListBody>(`/api/projects?sort=${sort}&limit=2&cursor=${first.body.nextCursor}`);
      const all = [...first.body.items, ...second.body.items].map((p) => p.slug);
      expect(new Set(all).size).toBe(3);
      expect(second.body.nextCursor).toBeNull();
    }
  });

  it("rejects a bad cursor", async () => {
    expect((await api("/api/projects?cursor=nope")).status).toBe(400);
  });
});

describe("GET /api/projects/:slug", () => {
  it("returns the panel data", async () => {
    const { status, body } = await api<ProjectDetail>("/api/projects/plant-pal");
    expect(status).toBe(200);
    expect(body).toMatchObject({ slug: "plant-pal", verifiedAuthor: true, license: { spdx: "MIT" }, wipStatus: null });
    expect(body.author?.username).toBe("ada");
  });

  it("opens unlicensed projects by direct link", async () => {
    const { status, body } = await api<ProjectDetail>("/api/projects/secret-notes");
    expect(status).toBe(200);
    expect(body.license).toBeNull();
  });

  it("shows a WIP status box", async () => {
    expect((await api<ProjectDetail>("/api/projects/dungeon")).body.wipStatus).not.toBeNull();
  });

  it("hides private projects from everyone but the owner", async () => {
    expect((await api("/api/projects/private-thing")).status).toBe(404);
    expect((await api("/api/projects/private-thing", { as: adaToken })).status).toBe(200);
  });
});

describe("votes", () => {
  it("upvotes once per user and can be undone", async () => {
    const vote = (value: 0 | 1) => api<{ upvotes: number }>("/api/projects/dungeon/vote", { method: "POST", as: adaToken, body: JSON.stringify({ value }) });
    expect((await vote(1)).body.upvotes).toBe(1); // recounted from the votes table
    expect((await vote(1)).body.upvotes).toBe(1);
    const list = await api<ListBody>("/api/projects?stage=wip", { as: adaToken });
    expect(list.body.items[0]?.viewer?.upvoted).toBe(true);
    expect((await vote(0)).body.upvotes).toBe(0);
  });

  it("requires sign-in", async () => {
    expect((await api("/api/projects/dungeon/vote", { method: "POST", body: JSON.stringify({ value: 1 }) })).status).toBe(401);
  });
});

describe("profiles", () => {
  it("lists a user's projects, showing their own unlicensed ones only to them", async () => {
    const outsider = await api<ListBody>("/api/users/bo/projects");
    expect(outsider.body.items.map((p) => p.slug).sort()).toEqual(["dungeon", "old-hit"]);
    expect(outsider.body.hiddenUnlicensedCount).toBe(1);
    const boToken = "tok_usr_bo";
    const self = await api<ListBody>("/api/users/bo/projects", { as: boToken });
    expect(self.body.items.map((p) => p.slug)).toContain("secret-notes");
  });
});

describe("categories", () => {
  it("counts listed, licensed projects", async () => {
    const { body } = await api<{ items: { slug: string; projectCount: number }[] }>("/api/categories");
    expect(body.items.find((c) => c.slug === "tools")?.projectCount).toBe(2);
  });
});
