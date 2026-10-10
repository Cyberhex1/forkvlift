import type { MiddlewareHandler } from "hono";
import type { AuthLevel } from "@forkvlift/shared";
import type { AppEnv } from "../../env";
import { noteActivity } from "../badges";
import { HttpError } from "../errors";
import { fixtureSessionUser, fixturesEnabled } from "../fixtures";
import { verifyAccessJwt } from "./access";
import { sessionUserFromCookie } from "./session";

/** Loads the viewer for every route, then enforces the route's auth level. */
export function authMiddleware(level: AuthLevel): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    let user = null;
    if (__FIXTURES__ && fixturesEnabled(c)) user = await fixtureSessionUser(c);
    if (!user) user = await sessionUserFromCookie(c);
    c.set("user", user);
    c.set("adminActor", null);
    if (user && !user.id.startsWith("fx_")) {
      const ctx = executionCtx(c);
      if (ctx) noteActivity(c.env.DB, user.id, (p) => ctx.waitUntil(p));
    }

    if (level === "user" && !user) throw new HttpError("unauthorized", "Sign in to do that.");

    if (level === "admin") {
      const actor = await adminActor(c.env, c.req.raw, user);
      if (!actor) throw new HttpError("forbidden", "Admins only.");
      c.set("adminActor", actor);
    }
    return next();
  };
}

/** Hono throws when there is no ExecutionContext (e.g. app.request in tests). */
function executionCtx(c: { readonly executionCtx: { waitUntil(p: Promise<unknown>): void } }): { waitUntil(p: Promise<unknown>): void } | null {
  try {
    return c.executionCtx;
  } catch {
    return null;
  }
}

async function adminActor(env: Env, request: Request, user: { id: string; role: string } | null): Promise<string | null> {
  // Fixture admin, local dev only.
  if (__FIXTURES__ && user?.role === "admin" && user.id.startsWith("fx_")) return user.id;

  // Production path: the request came through Cloudflare Access.
  const email = await verifyAccessJwt(env, request);
  if (email) return `access:${email}`;

  // Local convenience: a signed-in admin without Access.
  if (env.ENVIRONMENT === "local" && env.ALLOW_SESSION_ADMIN === "true" && user?.role === "admin") return user.id;
  return null;
}
