import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { deleteCookie } from "hono/cookie";
import { COOKIES, DEFAULT_USER_SETTINGS, SITE_SLUG, type UserSettings } from "@forkvlift/shared";
import type { AppEnv } from "../env";
import * as account from "../core/account";
import { getDb, schema } from "../core/db";
import { HttpError, mount } from "../core/http";
import { listProjects } from "../core/projects/list";
import { missing } from "./_stubs";

/** Public profiles + the viewer's own account. Opus. */
export function registerUsers(app: Hono<AppEnv>) {
  mount(app, "getProfile", ({ params }, c) => account.getProfile(c.env.DB, params.username, c.get("user")));

  mount(app, "listUserProjects", async ({ params, query }, c) => {
    const owner = await c.env.DB.prepare(`SELECT id FROM users WHERE lower(username) = lower(?) AND deleted_at IS NULL`)
      .bind(params.username)
      .first<{ id: string }>();
    if (!owner) return missing("User");
    const viewer = c.get("user");
    return listProjects(c.env.DB, { sort: "newest", ...query }, viewer?.id ?? null, {
      ownerId: owner.id,
      forksOnly: query.tab === "forks",
      // Authors always see their own unlicensed projects.
      includeOwnUnlicensed: viewer?.id === owner.id,
    });
  });

  mount(app, "updateMe", ({ body }, c) => account.updateMe(c.env.DB, c.get("user")!, body));

  mount(app, "getSettings", (_, c) => c.get("user")!.settings);

  mount(app, "updateSettings", async ({ body }, c) => {
    const user = c.get("user")!;
    const { acceptUnlicensedDisclaimer, ...changes } = body;
    const current = user.settings;
    const next: UserSettings = { ...DEFAULT_USER_SETTINGS, ...current, ...changes };

    // Showing unlicensed projects needs the one-time disclaimer acceptance.
    if (changes.showUnlicensed === true && !current.unlicensedDisclaimerAcceptedAt) {
      if (!acceptUnlicensedDisclaimer) {
        throw new HttpError("bad_request", "Accept the no-license disclaimer to show unlicensed projects.");
      }
      next.unlicensedDisclaimerAcceptedAt = new Date().toISOString();
    }

    await getDb(c.env).insert(schema.profiles).values({ userId: user.id }).onConflictDoNothing();
    await getDb(c.env).update(schema.profiles).set({ settings: next, updatedAt: new Date() }).where(eq(schema.profiles.userId, user.id));
    return next;
  });

  mount(app, "updateAvatar", ({ body }, c) => account.updateAvatar(c.env.DB, c.get("user")!.id, body));
  mount(app, "setShowcase", async ({ body }, c) => ({ projectIds: await account.setShowcase(c.env.DB, c.get("user")!.id, body.projectIds) }));

  // Exports are built on request, so they're always "ready".
  mount(app, "exportData", () => ({ status: "ready" as const, downloadUrl: "/api/me/export" }));
  mount(app, "downloadExport", async (_, c) => {
    const data = await account.buildExport(c.env.DB, c.get("user")!.id);
    const date = new Date().toISOString().slice(0, 10);
    return c.body(JSON.stringify(data, null, 2), 200, {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${SITE_SLUG}-export-${date}.json"`,
    });
  });

  mount(app, "deleteAccount", async ({ body }, c) => {
    await account.deleteAccount(c.env.DB, c.get("user")!, body.confirmUsername);
    deleteCookie(c, COOKIES.session, { path: "/", secure: new URL(c.req.url).protocol === "https:" });
    return { ok: true as const };
  });
}
