import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIES, type ResourceDetail } from "@forkvlift/shared";
import { app } from "../../src/app";
import { api, env, resetDb, seedCategory, seedProject, seedUser } from "./helpers";

let ada = "";
beforeEach(async () => {
  await resetDb();
  await env.DB.prepare(`DELETE FROM subscribers`).run();
  await seedCategory("games");
  await seedCategory("tools");
  ada = await seedUser("usr_ada", "ada");
  vi.stubGlobal("fetch", async () => Response.json({ success: true }));
});
afterEach(() => vi.unstubAllGlobals());

const post = <T>(path: string, body: unknown, as?: string) => api<T>(path, { method: "POST", as, body: JSON.stringify(body) });

describe("resource uploads keep their file names (3.9)", () => {
  it("stores a script under its real name and flags what it does", async () => {
    const script = "#!/bin/sh\ncurl -fsSL https://example.com/install.sh | sh\n";
    const r = await post<{ key: string; uploadUrl: string }>("/api/uploads", { kind: "resource", contentType: "text/plain", size: script.length, filename: "setup.sh" }, ada);
    expect(r.status).toBe(200);
    const put = await app.request(r.body.uploadUrl, { method: "PUT", headers: { cookie: `${COOKIES.session}=${ada}`, "content-type": "text/plain" }, body: script }, env);
    expect(put.status).toBe(200);
    const created = await post<ResourceDetail>("/api/resources", { type: "workflow", title: "Setup helper", summary: "", bodyMd: "Run the script.", license: "MIT", testedWith: [], fileKeys: [r.body.key], linkedProjectIds: [], turnstileToken: "t" }, ada);
    expect(created.status).toBe(200);
    expect(created.body.files).toEqual([{ path: "setup.sh", size: script.length }]);
    expect(created.body.hasExecutableCode).toBe(true);
    expect(created.body.scanFlags.some((f) => f.startsWith("setup.sh:"))).toBe(true);

    const media = await app.request(`/api/media/${r.body.key}`, {}, env);
    expect(media.headers.get("content-disposition")).toBe('attachment; filename="setup.sh"');
  });

  it("rejects names that don't match the type, or names on non-resource uploads", async () => {
    expect((await post("/api/uploads", { kind: "resource", contentType: "text/plain", size: 10, filename: "evil.zip" }, ada)).status).toBe(400);
    expect((await post("/api/uploads", { kind: "resource", contentType: "text/plain", size: 10, filename: "../x.sh" }, ada)).status).toBe(400);
    expect((await post("/api/uploads", { kind: "thumbnail", contentType: "image/png", size: 10, filename: "a.png" }, ada)).status).toBe(400);
  });
});

describe("RSS feed URLs (4.9)", () => {
  it("serves per-category and per-user feeds", async () => {
    await seedProject({ slug: "dungeon", owner: "usr_ada", category: "games" });
    await seedProject({ slug: "tool-thing", category: "tools" });
    const cat = await (await app.request("/api/feeds/category/games/projects.rss", {}, env)).text();
    expect(cat).toContain("<title>dungeon</title>");
    expect(cat).not.toContain("tool-thing");
    const user = await (await app.request("/api/feeds/users/ada/projects.rss", {}, env)).text();
    expect(user).toContain("/p/dungeon");
    expect(user).toContain("/u/ada");
  });
});

describe("newsletter (4.10)", () => {
  it("double opt-in: pending until confirmed; unsubscribe and come back", async () => {
    expect((await post<{ status: string }>("/api/newsletter/subscribe", { email: "Reader@Example.com", turnstileToken: "t" })).body.status).toBe("pending");
    const row = await env.DB.prepare(`SELECT email, token, status FROM subscribers`).first<{ email: string; token: string; status: string }>();
    expect(row).toMatchObject({ email: "reader@example.com", status: "pending" });

    expect((await post("/api/newsletter/confirm", { token: "x".repeat(20) })).status).toBe(404);
    expect((await post("/api/newsletter/confirm", { token: row!.token })).status).toBe(200);
    expect((await post<{ status: string }>("/api/newsletter/subscribe", { email: "reader@example.com", turnstileToken: "t" })).body.status).toBe("confirmed");

    await post("/api/newsletter/unsubscribe", { token: row!.token });
    expect((await env.DB.prepare(`SELECT status FROM subscribers`).first<{ status: string }>())!.status).toBe("unsubscribed");
    // The old link no longer confirms.
    expect((await post("/api/newsletter/confirm", { token: row!.token })).status).toBe(404);
    await post("/api/newsletter/subscribe", { email: "reader@example.com", turnstileToken: "t" });
    const again = await env.DB.prepare(`SELECT token, status FROM subscribers`).first<{ token: string; status: string }>();
    expect(again!.status).toBe("pending");
    expect(again!.token).not.toBe(row!.token);
  });

  it("validates the email", async () => {
    expect((await post("/api/newsletter/subscribe", { email: "nope", turnstileToken: "t" })).status).toBe(400);
  });
});
