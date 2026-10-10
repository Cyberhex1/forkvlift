import type { Hono } from "hono";
import type { AppEnv } from "../env";
import { mount } from "../core/http";
import * as events from "../core/events";
import { clientIp, verifyTurnstile } from "../core/security";

/** Launch days, Fork Friday and build jams (task 4.6). Opus. */
export function registerEvents(app: Hono<AppEnv>) {
  mount(app, "listGrowthEvents", ({ query }, c) => events.listEvents(c.env.DB, query));
  mount(app, "getGrowthEvent", ({ params }, c) => events.getEvent(c.env.DB, params.slug, c.get("user")));
  mount(app, "listGrowthEventEntries", ({ params, query }, c) => events.listEntries(c.env.DB, params.slug, c.get("user")?.id ?? null, query));
  mount(app, "submitGrowthEntry", async ({ params, body }, c) => {
    await verifyTurnstile(c.env, body.turnstileToken, clientIp(c.req.raw));
    return events.submitEntry(c.env.DB, c.get("user")!, params.slug, body.projectId);
  });
  mount(app, "withdrawGrowthEntry", async ({ params }, c) => {
    await events.withdrawEntry(c.env.DB, c.get("user")!, params.slug, params.id);
    return { ok: true as const };
  });
  mount(app, "voteGrowthEntry", ({ params, body }, c) => events.vote(c.env.DB, c.get("user")!, params.slug, body.entryId));
}
