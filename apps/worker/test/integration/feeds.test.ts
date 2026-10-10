import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SITE_NAME } from "@forkvlift/shared";
import { app } from "../../src/app";
import { env, resetDb, seedCategory, seedProject, seedUser } from "./helpers";

beforeEach(async () => {
  await resetDb();
  await seedCategory("tools");
  await seedCategory("games");
  await seedUser("usr_ada", "ada");
  await seedUser("usr_bo", "bo");
  vi.stubGlobal("fetch", async () => Response.json({ success: true }));
});
afterEach(() => vi.unstubAllGlobals());

describe("live README badge (task 4.8)", () => {
  it("serves an SVG badge for a listed project with cache headers", async () => {
    await seedProject({
      slug: "pixel-editor",
      owner: "usr_ada",
      category: "tools",
      license: "MIT",
      isPublic: true,
      forks: 14,
      upvotes: 42,
    });

    const res = await app.request("/api/badge/pixel-editor", {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");
    expect(res.headers.get("cache-control")).toContain("max-age=300");
    expect(res.headers.get("cache-control")).toContain("stale-while-revalidate=86400");

    const svg = await res.text();
    expect(svg).toContain("<svg");
    expect(svg).toContain(SITE_NAME);
    expect(svg).toContain("14 forks · 42 upvotes");
    expect(svg).toContain("/p/pixel-editor");
  });

  it("404s for unlisted or non-existent projects", async () => {
    const res = await app.request("/api/badge/does-not-exist", {}, env);
    expect(res.status).toBe(404);
  });
});

describe("RSS feeds (task 4.9)", () => {
  it("serves valid RSS 2.0 and excludes unlicensed projects", async () => {
    await seedProject({
      slug: "licensed-tool",
      owner: "usr_ada",
      category: "tools",
      license: "MIT",
      isPublic: true,
      tagline: "Great open tool",
    });

    await seedProject({
      slug: "unlicensed-project",
      owner: "usr_ada",
      category: "tools",
      license: null,
      isPublic: true,
      tagline: "No license here",
    });

    const res = await app.request("/api/feeds/projects.rss", {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/rss+xml");
    expect(res.headers.get("cache-control")).toContain("max-age=600");

    const xml = await res.text();
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain("<channel>");
    expect(xml).toContain("licensed-tool");
    expect(xml).toContain("Great open tool");
    // Unlicensed projects must never appear in the RSS feed
    expect(xml).not.toContain("unlicensed-project");
  });

  it("filters RSS feed by category and user", async () => {
    await seedProject({
      slug: "game-one",
      owner: "usr_ada",
      category: "games",
      license: "MIT",
      isPublic: true,
    });
    await seedProject({
      slug: "tool-by-bo",
      owner: "usr_bo",
      category: "tools",
      license: "Apache-2.0",
      isPublic: true,
    });

    // Category filter
    const catRes = await app.request("/api/feeds/projects.rss?category=games", {}, env);
    expect(catRes.status).toBe(200);
    const catXml = await catRes.text();
    expect(catXml).toContain("game-one");
    expect(catXml).not.toContain("tool-by-bo");

    // User filter
    const userRes = await app.request("/api/feeds/projects.rss?user=bo", {}, env);
    expect(userRes.status).toBe(200);
    const userXml = await userRes.text();
    expect(userXml).toContain("tool-by-bo");
    expect(userXml).not.toContain("game-one");
  });
});
