import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { DEFAULT_USER_SETTINGS, type UserSettings } from "@forkvlift/shared";
import type { AppEnv } from "../env";
import { getDb, schema } from "../core/db";
import { HttpError, mount } from "../core/http";
import { listProjects } from "../core/projects/list";
import { missing, todo } from "./_stubs";

/** Public profiles + the viewer's own account. Opus. */
export function registerUsers(app: Hono<AppEnv>) {
  mount(app, "getProfile", () => missing("User"));
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

  mount(app, "updateMe", () => todo("2.8"));

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

    await getDb(c.env).update(schema.profiles).set({ settings: next, updatedAt: new Date() }).where(eq(schema.profiles.userId, user.id));
    return next;
  });

  mount(app, "updateAvatar", () => todo("3.11"));
  mount(app, "setShowcase", () => todo("2.8"));
  mount(app, "exportData", () => todo("2.10"));
  mount(app, "deleteAccount", () => todo("2.10"));
}
