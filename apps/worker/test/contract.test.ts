/**
 * Contract test: every route in packages/shared is registered, and in fixture
 * mode every JSON GET returns a body that matches its response schema.
 */
import { describe, expect, it } from "vitest";
import { ApiErrorBody, buildPath, COOKIES, ROUTE_IDS, routes, type RouteDef } from "@forkvlift/shared";
import { app } from "../src/app";
import { unmountedRoutes } from "../src/core/http";

const env = { ENVIRONMENT: "local", USE_FIXTURES: "true" } as unknown as Env;

const PARAMS: Record<string, string> = {
  slug: "fixture-pixel-planner",
  username: "fx-ada",
  id: "fx_col_1",
  key: "k",
  product: "notion",
  itemId: "fx_rm_1",
  projectId: "fx_prj_1",
};
const OVERRIDES: Record<string, Record<string, string>> = {
  getThread: { id: "fx_thr_1" },
  getCollection: { id: "fx_col_alts" },
  getResource: { slug: "fixture-plan-scaffold-ship" },
  listThreads: { slug: "help" },
  channelHistory: { slug: "general" },
  getRequest: { id: "fx_req_1" },
};

const QUERIES: Record<string, string> = { similarProjects: "?q=plant+tracker" };

function pathFor(id: string, def: RouteDef) {
  const names = [...def.path.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1]!);
  const params = Object.fromEntries(names.map((n) => [n, OVERRIDES[id]?.[n] ?? PARAMS[n] ?? "x"]));
  return buildPath(def.path, params) + (QUERIES[id] ?? "");
}

const asAdmin = { cookie: `${COOKIES.devUser}=fx_user_admin` };

describe("API contract", () => {
  it("registers a handler for every route", () => {
    expect(unmountedRoutes()).toEqual([]);
  });

  for (const id of ROUTE_IDS) {
    const def = routes[id] as RouteDef;
    if (def.kind !== "json" || def.method !== "GET") continue;

    it(`${id}: ${def.method} ${def.path} matches its response schema`, async () => {
      const res = await app.request(pathFor(id, def), { headers: asAdmin }, env);
      const body = await res.json();
      expect(res.status, JSON.stringify(body)).toBe(200);
      const parsed = def.response!.safeParse(body);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    });
  }

  for (const id of ROUTE_IDS) {
    const def = routes[id] as RouteDef;
    if (!def.body || def.body.safeParse({}).success) continue;
    it(`${id}: rejects an invalid body with the error shape`, async () => {
      const res = await app.request(pathFor(id, def), { method: def.method, headers: { ...asAdmin, "content-type": "application/json" }, body: "{}" }, env);
      expect(res.status).toBe(400);
      expect(ApiErrorBody.safeParse(await res.json()).success).toBe(true);
    });
  }

  it("requires sign-in for user routes", async () => {
    const res = await app.request("/api/studio/board", {}, env);
    expect(res.status).toBe(401);
  });

  it("keeps unlicensed projects hidden unless asked", async () => {
    const hidden = (await (await app.request("/api/projects", {}, env)).json()) as { items: { license: unknown }[]; hiddenUnlicensedCount: number };
    expect(hidden.items.every((p) => p.license)).toBe(true);
    expect(hidden.hiddenUnlicensedCount).toBeGreaterThan(0);
    const shown = (await (await app.request("/api/projects?showUnlicensed=true", {}, env)).json()) as { items: { license: unknown }[] };
    expect(shown.items.some((p) => !p.license)).toBe(true);
  });
});
