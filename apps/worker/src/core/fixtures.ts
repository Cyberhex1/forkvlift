/**
 * Dev-fixture plumbing. Every call site is wrapped in `if (__FIXTURES__)`, which
 * Vite replaces with `false` for builds, so the dynamic import below (and the
 * whole fixtures module) is dropped from anything that deploys.
 */
import { getCookie } from "hono/cookie";
import { COOKIES, type ParsedInput, type RouteId, type Routes, type SessionUser } from "@forkvlift/shared";
import type { Context } from "hono";
import type { AppEnv } from "../env";

type AppContext = Context<AppEnv>;

export function fixturesEnabled(c: AppContext): boolean {
  return __FIXTURES__ && c.env.USE_FIXTURES !== "false";
}

export async function fixtureSessionUser(c: AppContext): Promise<SessionUser | null> {
  if (!__FIXTURES__) return null;
  const id = getCookie(c, COOKIES.devUser);
  if (!id) return null;
  const { fxSessionUser } = await import("@forkvlift/shared/fixtures");
  return fxSessionUser(id);
}

export async function serveFixture<K extends RouteId>(c: AppContext, id: K, input: ParsedInput<Routes[K]>): Promise<Response> {
  if (!__FIXTURES__) throw new Error("fixtures are not available in this build");
  const { routeFixtures, FixtureError } = await import("@forkvlift/shared/fixtures");
  const fn = (routeFixtures as unknown as Record<string, ((i: unknown, ctx: unknown) => unknown) | undefined>)[id];
  if (!fn) return c.json({ error: { code: "not_implemented", message: `No fixture for ${id}` } }, 501);
  try {
    const user = c.get("user");
    return c.json(fn(input, { viewerId: user?.id ?? null }) as object);
  } catch (err) {
    if (err instanceof FixtureError) {
      const { ERROR_STATUS } = await import("@forkvlift/shared");
      return c.json({ error: { code: err.code, message: err.message } }, ERROR_STATUS[err.code] as 400);
    }
    throw err;
  }
}
