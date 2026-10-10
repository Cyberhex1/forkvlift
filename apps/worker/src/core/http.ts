/**
 * Route mounting. Every contract route is registered with mount(), which:
 *   1. applies the route's auth level,
 *   2. rate-limits writes,
 *   3. validates params/query/body against the contract,
 *   4. in local dev (fixtures on) answers JSON routes from the dev fixtures,
 *   5. otherwise calls the real handler and returns its result as JSON.
 */
import type { Context, Hono } from "hono";
import { ERROR_STATUS, routes, type ErrorCode, type ParsedInput, type RouteDef, type RouteId, type RouteOutput, type Routes } from "@forkvlift/shared";
import type { AppEnv } from "../env";
import { authMiddleware } from "./auth/middleware";
import { HttpError } from "./errors";
import { rateLimitWrites } from "./security";
import { fixturesEnabled, serveFixture } from "./fixtures";

export { HttpError, notFound, notImplemented } from "./errors";

export function errorResponse(c: Context, code: ErrorCode, message: string, details?: unknown) {
  return c.json({ error: { code, message, ...(details === undefined ? {} : { details }) } }, ERROR_STATUS[code] as 400);
}

export type AppContext = Context<AppEnv>;
export type Handler<K extends RouteId> = (
  input: ParsedInput<Routes[K]>,
  c: AppContext,
) => RouteOutput<Routes[K]> | Response | Promise<RouteOutput<Routes[K]> | Response>;

const mounted = new Set<RouteId>();

export function mount<K extends RouteId>(app: Hono<AppEnv>, id: K, handler: Handler<K>): void {
  const def = routes[id] as RouteDef;
  mounted.add(id);
  app.on(def.method, def.path, authMiddleware(def.auth), rateLimitWrites(def), async (c) => {
    const input = (await parseInput(c, def)) as ParsedInput<Routes[K]>;

    if (__FIXTURES__ && def.kind === "json" && fixturesEnabled(c)) {
      return serveFixture(c, id, input);
    }

    const out = await handler(input, c);
    if (out instanceof Response) return out;
    return c.json(out as object);
  });
}

export function unmountedRoutes(): RouteId[] {
  return (Object.keys(routes) as RouteId[]).filter((id) => !mounted.has(id));
}

async function parseInput(c: AppContext, def: RouteDef) {
  const params = def.params ? parseOr400(def.params, c.req.param(), "params") : {};
  const query = def.query ? parseOr400(def.query, c.req.query(), "query") : {};
  let body: unknown = undefined;
  if (def.body) {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      throw new HttpError("invalid_request", "Body must be JSON");
    }
    body = parseOr400(def.body, raw, "body");
  }
  return { params, query, body };
}

function parseOr400(schema: NonNullable<RouteDef["params"]>, value: unknown, where: string) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpError(
      "invalid_request",
      `Invalid ${where}`,
      result.error.issues.map((i) => ({ path: [where, ...i.path].join("."), message: i.message })),
    );
  }
  return result.data;
}
