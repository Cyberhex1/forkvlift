/* eslint-disable @typescript-eslint/no-explicit-any -- loosely shaped JSON in tests */
import { beforeEach, describe, expect, it } from "vitest";
import type { ApiKey } from "@forkvlift/shared";
import { app } from "../../src/app";
import { api, env, resetDb, seedCategory, seedProject, seedUser } from "./helpers";

let ada = "";
beforeEach(async () => {
  await resetDb();
  await seedCategory("tools");
  ada = await seedUser("usr_ada", "ada");
  await seedProject({ slug: "pixel-paint", tagline: "Pixel art drawing editor", owner: "usr_ada", stars: 10 });
  await seedProject({ slug: "secret-notes", tagline: "Notes app", license: null });
});

const v1 = async (path: string, key?: string) => {
  const res = await app.request(path, { headers: key ? { authorization: `Bearer ${key}` } : {} }, env);
  return { status: res.status, headers: res.headers, body: (await res.json()) as Record<string, any> };
};

describe("API keys", () => {
  it("creates, lists, uses and revokes a key; the secret is shown once", async () => {
    const created = await api<{ key: ApiKey; secret: string }>("/api/me/api-keys", { method: "POST", as: ada, body: JSON.stringify({ name: "My script" }) });
    expect(created.status).toBe(200);
    expect(created.body.secret).toMatch(/^fl_[0-9a-f]{12}_[0-9a-f]{32}$/);
    expect(created.body.secret.startsWith(created.body.key.prefix)).toBe(true);
    const stored = await env.DB.prepare(`SELECT key_hash FROM api_keys`).first<{ key_hash: string }>();
    expect(stored!.key_hash).not.toContain(created.body.secret);

    expect((await v1("/api/v1/projects", created.body.secret)).status).toBe(200);
    const listed = await api<{ items: ApiKey[] }>("/api/me/api-keys", { as: ada });
    expect(listed.body.items).toHaveLength(1);
    expect(listed.body.items[0]!.lastUsedAt).not.toBeNull();

    await api(`/api/me/api-keys/${created.body.key.id}`, { method: "DELETE", as: ada });
    expect((await v1("/api/v1/projects", created.body.secret)).status).toBe(401);
    expect((await api<{ items: ApiKey[] }>("/api/me/api-keys", { as: ada })).body.items).toHaveLength(0);
  });

  it("rejects malformed keys and caps active keys at five", async () => {
    expect((await v1("/api/v1/projects", "nope")).status).toBe(401);
    for (let i = 0; i < 5; i++) await api("/api/me/api-keys", { method: "POST", as: ada, body: JSON.stringify({ name: `k${i}` }) });
    expect((await api("/api/me/api-keys", { method: "POST", as: ada, body: JSON.stringify({ name: "k6" }) })).status).toBe(409);
  });
});

describe("/api/v1", () => {
  it("lists licensed projects by default, with CORS", async () => {
    const res = await v1("/api/v1/projects");
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.body.data.map((p: { slug: string }) => p.slug)).toEqual(["pixel-paint"]);
    expect(res.body.data[0]).toMatchObject({ license: { spdx: "MIT" }, author: "ada", url: expect.stringMatching(/\/p\/pixel-paint$/) });
    const all = await v1("/api/v1/projects?include_unlicensed=true");
    expect(all.body.data).toHaveLength(2);
  });

  it("returns details with a starter prompt, and no clone command without a license", async () => {
    const detail = await v1("/api/v1/projects/pixel-paint");
    expect(detail.body.data).toMatchObject({ slug: "pixel-paint", clone_command: expect.stringContaining("git clone"), starter_prompt: expect.stringContaining("LICENSE") });
    expect((await v1("/api/v1/projects/secret-notes")).body.data.clone_command).toBeNull();
    expect((await v1("/api/v1/projects/ghost")).status).toBe(404);
  });

  it("searches and validates input", async () => {
    expect((await v1("/api/v1/search?q=pixel%20art")).body.data.map((p: { slug: string }) => p.slug)).toEqual(["pixel-paint"]);
    expect((await v1("/api/v1/search?q=x")).status).toBe(400);
    expect((await v1("/api/v1/projects?limit=500")).status).toBe(400);
  });
});
