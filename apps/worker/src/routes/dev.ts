/**
 * Local-dev helpers, not part of the contract. Registered only when __FIXTURES__
 * is true, so they don't exist in any deployed build.
 *
 *   /api/dev/login?as=fx-ada&returnTo=/studio   sign in as a fixture user
 *   /api/dev/logout
 *   /api/dev/users                               list fixture users
 */
import type { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { COOKIES } from "@forkvlift/shared";
import type { AppEnv } from "../env";
import { safeReturnTo } from "../core/security";

export function registerDev(app: Hono<AppEnv>) {
  if (!__FIXTURES__) return;

  app.get("/api/dev/users", async (c) => {
    const { fxUsers } = await import("@forkvlift/shared/fixtures");
    return c.json({ items: Object.values(fxUsers) });
  });

  app.get("/api/dev/login", async (c) => {
    const { fxUsers } = await import("@forkvlift/shared/fixtures");
    const as = c.req.query("as") ?? "fx-ada";
    const user = Object.values(fxUsers).find((u) => u.username === as || u.id === as);
    if (!user) return c.json({ error: { code: "not_found", message: `No fixture user "${as}"` } }, 404);
    setCookie(c, COOKIES.devUser, user.id, { httpOnly: true, sameSite: "Lax", path: "/" });
    return c.redirect(safeReturnTo(c.req.query("returnTo")), 302);
  });

  app.get("/api/dev/logout", (c) => {
    deleteCookie(c, COOKIES.devUser, { path: "/" });
    return c.redirect(safeReturnTo(c.req.query("returnTo")), 302);
  });
}
