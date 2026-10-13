import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SITE_NAME } from "@forkvlift/shared";
import { app } from "../../src/app";
import { api, env, resetDb, seedCategory, seedProject, seedUser } from "./helpers";

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

describe("showcase RSS feeds (task 5.7)", () => {
  it("serves valid RSS 2.0 for published showcases without clone or fork wording", async () => {
    const now = Date.now();
    // Published showcase
    await env.DB.prepare(
      `INSERT INTO showcases (id, slug, owner_id, title, tagline, body_md, build_story_md, category_slug, kind, stage, ai_tools, tags, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, '', 'tools', 'web', 'finished', '["claude-code"]', '[]', ?, ?, ?)`,
    )
      .bind("shw_1", "synth-builder", "usr_ada", "Synth Builder", "A modular synth made with Claude", "Built in 3 hours with Web Audio API.", now - 1000, now, now)
      .run();

    // Draft showcase (must NOT appear)
    await env.DB.prepare(
      `INSERT INTO showcases (id, slug, owner_id, title, tagline, body_md, build_story_md, category_slug, kind, stage, ai_tools, tags, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, '', 'tools', 'web', 'finished', '["claude-code"]', '[]', NULL, ?, ?)`,
    )
      .bind("shw_2", "secret-draft", "usr_ada", "Secret Draft", "Unpublished project", "Draft details.", now, now)
      .run();

    const res = await app.request("/api/feeds/showcases.rss", {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/rss+xml");
    expect(res.headers.get("cache-control")).toContain("max-age=600");

    const xml = await res.text();
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain("<channel>");
    expect(xml).toContain("Synth Builder");
    expect(xml).toContain("modular synth made with Claude");
    expect(xml).toContain("/showcase/synth-builder");
    // Draft must not be in feed
    expect(xml).not.toContain("secret-draft");
    // Strict requirement: showcases never get clone or fork wording (look, don't take)
    expect(xml.toLowerCase()).not.toContain("clone");
    expect(xml.toLowerCase()).not.toContain("fork this");
    expect(xml.toLowerCase()).not.toContain("forks");
  });

  it("filters showcase RSS feed by category and user", async () => {
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO showcases (id, slug, owner_id, title, tagline, body_md, build_story_md, category_slug, kind, stage, ai_tools, tags, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '', '', 'games', 'game', 'finished', '[]', '[]', ?, ?, ?)`,
    )
      .bind("shw_g1", "space-vibe", "usr_ada", "Space Vibe", "Space adventure game", now - 2000, now, now)
      .run();

    await env.DB.prepare(
      `INSERT INTO showcases (id, slug, owner_id, title, tagline, body_md, build_story_md, category_slug, kind, stage, ai_tools, tags, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '', '', 'tools', 'web', 'finished', '[]', '[]', ?, ?, ?)`,
    )
      .bind("shw_t1", "cli-agent", "usr_bo", "CLI Agent", "Dev terminal tool", now - 1000, now, now)
      .run();

    // Filter by category
    const catRes = await app.request("/api/feeds/showcases.rss?category=games", {}, env);
    expect(catRes.status).toBe(200);
    const catXml = await catRes.text();
    expect(catXml).toContain("Space Vibe");
    expect(catXml).not.toContain("CLI Agent");

    // Filter by user
    const userRes = await app.request("/api/feeds/showcases.rss?user=bo", {}, env);
    expect(userRes.status).toBe(200);
    const userXml = await userRes.text();
    expect(userXml).toContain("CLI Agent");
    expect(userXml).not.toContain("Space Vibe");
  });

  it("excludes hidden or removed showcases from the feed", async () => {
    const now = Date.now();
    // Normal published showcase
    await env.DB.prepare(
      `INSERT INTO showcases (id, slug, owner_id, title, tagline, body_md, build_story_md, category_slug, kind, stage, ai_tools, tags, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '', '', 'tools', 'web', 'finished', '[]', '[]', ?, ?, ?)`,
    )
      .bind("shw_vis", "visible-showcase", "usr_ada", "Visible Showcase", "Visible", now - 3000, now, now)
      .run();

    // Hidden showcase (hidden_at IS NOT NULL)
    await env.DB.prepare(
      `INSERT INTO showcases (id, slug, owner_id, title, tagline, body_md, build_story_md, category_slug, kind, stage, ai_tools, tags, published_at, hidden_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '', '', 'tools', 'web', 'finished', '[]', '[]', ?, ?, ?, ?)`,
    )
      .bind("shw_hid", "hidden-showcase", "usr_ada", "Hidden Showcase", "Hidden", now - 2000, now - 500, now, now)
      .run();

    // Removed/deleted showcase (deleted_at IS NOT NULL)
    await env.DB.prepare(
      `INSERT INTO showcases (id, slug, owner_id, title, tagline, body_md, build_story_md, category_slug, kind, stage, ai_tools, tags, published_at, deleted_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '', '', 'tools', 'web', 'finished', '[]', '[]', ?, ?, ?, ?)`,
    )
      .bind("shw_del", "deleted-showcase", "usr_ada", "Deleted Showcase", "Deleted", now - 1000, now - 100, now, now)
      .run();

    const res = await app.request("/api/feeds/showcases.rss", {}, env);
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("Visible Showcase");
    expect(xml).not.toContain("Hidden Showcase");
    expect(xml).not.toContain("Deleted Showcase");
  });

  it("escapes < and & in showcase titles in RSS XML", async () => {
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO showcases (id, slug, owner_id, title, tagline, body_md, build_story_md, category_slug, kind, stage, ai_tools, tags, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '', '', 'games', 'game', 'finished', '[]', '[]', ?, ?, ?)`,
    )
      .bind(
        "shw_xml",
        "dungeons-and-dragons",
        "usr_ada",
        "Dungeons & Dragons <2026>",
        "Hack & Slash <fast>",
        now - 1000,
        now,
        now,
      )
      .run();

    const res = await app.request("/api/feeds/showcases.rss", {}, env);
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("<title>Dungeons &amp; Dragons &lt;2026&gt;</title>");
    expect(xml).not.toContain("Dungeons & Dragons <2026>");
  });

  it("truncates body_md in description to around 500 characters", async () => {
    const now = Date.now();
    const longBody = "A".repeat(800);
    await env.DB.prepare(
      `INSERT INTO showcases (id, slug, owner_id, title, tagline, body_md, build_story_md, category_slug, kind, stage, ai_tools, tags, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, '', ?, '', 'tools', 'web', 'finished', '[]', '[]', ?, ?, ?)`,
    )
      .bind("shw_long", "long-post", "usr_ada", "Long Post", longBody, now - 1000, now, now)
      .run();

    const res = await app.request("/api/feeds/showcases.rss", {}, env);
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain(`${"A".repeat(500)}…`);
    expect(xml).not.toContain("A".repeat(501));
  });

  it("escapes SQL LIKE wildcards (% and _) when filtering by tool", async () => {
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO showcases (id, slug, owner_id, title, tagline, body_md, build_story_md, category_slug, kind, stage, ai_tools, tags, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, '', '', '', 'tools', 'web', 'finished', '["tool_v1"]', '[]', ?, ?, ?)`,
    )
      .bind("shw_t_under", "tool-under", "usr_ada", "Tool Underscore", now - 2000, now, now)
      .run();

    await env.DB.prepare(
      `INSERT INTO showcases (id, slug, owner_id, title, tagline, body_md, build_story_md, category_slug, kind, stage, ai_tools, tags, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, '', '', '', 'tools', 'web', 'finished', '["tool-v1"]', '[]', ?, ?, ?)`,
    )
      .bind("shw_t_dash", "tool-dash", "usr_ada", "Tool Dash", now - 1000, now, now)
      .run();

    // Query for tool_v1: should not match tool-v1 even though '_' is a single-char wildcard in SQL
    const res = await app.request("/api/feeds/showcases.rss?tool=tool_v1", {}, env);
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("Tool Underscore");
    expect(xml).not.toContain("Tool Dash");
  });
});

describe("subscription savings stats (task 4.11)", () => {
  it("computes honest monthly savings from replaced paid products and forks", async () => {
    // Seed paid products
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO paid_products (slug, name, monthly_price_usd_cents) VALUES (?, ?, ?)`).bind("notion", "Notion", 1000), // $10/mo
      env.DB.prepare(`INSERT INTO paid_products (slug, name, monthly_price_usd_cents) VALUES (?, ?, ?)`).bind("trello", "Trello", 500),  // $5/mo
    ]);

    // Seed project replacing Notion with 10 forks
    await seedProject({
      slug: "open-notes",
      owner: "usr_ada",
      category: "tools",
      license: "MIT",
      isPublic: true,
      forks: 10,
      replaces: ["Notion"],
    });

    // Seed project replacing Trello with 4 forks
    await seedProject({
      slug: "open-board",
      owner: "usr_bo",
      category: "tools",
      license: "MIT",
      isPublic: true,
      forks: 4,
      replaces: ["Trello"],
    });

    // Seed project with no license (should be excluded)
    await seedProject({
      slug: "unlicensed-notes",
      owner: "usr_bo",
      category: "tools",
      license: null,
      isPublic: true,
      forks: 20,
      replaces: ["Notion"],
    });

    const res = await api<{ estimatedMonthlySavingsUsd: number; forkCount: number; asOf: string }>("/api/stats/savings");
    expect(res.status).toBe(200);
    // (10 forks * $10) + (4 forks * $5) = $100 + $20 = $120/mo
    expect(res.body.estimatedMonthlySavingsUsd).toBe(120);
    // Total forks of licensed projects: 10 + 4 = 14
    expect(res.body.forkCount).toBe(14);
    expect(res.body.asOf).toBeTruthy();
  });
});
