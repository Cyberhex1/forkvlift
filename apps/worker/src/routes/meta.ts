import type { Hono } from "hono";
import { SITE_NAME } from "@forkvlift/shared";
import type { AppEnv } from "../env";
import { mount } from "../core/http";
import { fixturesEnabled } from "../core/fixtures";

export function registerMeta(app: Hono<AppEnv>) {
  mount(app, "health", (_, c) => ({ ok: true as const, name: SITE_NAME, environment: c.env.ENVIRONMENT, fixtures: fixturesEnabled(c) }));

  mount(app, "siteConfig", (_, c) => ({
    siteName: SITE_NAME,
    environment: c.env.ENVIRONMENT,
    turnstileSiteKey: c.env.TURNSTILE_SITE_KEY || null,
    githubLogin: Boolean(c.env.GITHUB_CLIENT_ID),
    magicLink: c.env.ENVIRONMENT === "local",
    fixtures: fixturesEnabled(c),
  }));
}
