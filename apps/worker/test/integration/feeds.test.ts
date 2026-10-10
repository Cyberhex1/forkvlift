import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SITE_NAME } from "@forkvlift/shared";
import { app } from "../../src/app";
import { env, resetDb, seedCategory, seedProject, seedUser } from "./helpers";

beforeEach(async () => {
  await resetDb();
  await seedCategory("tools");
  await seedUser("usr_ada", "ada");
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
