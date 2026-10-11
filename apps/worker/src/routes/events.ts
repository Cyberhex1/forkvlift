import type { Hono } from "hono";
import type { AppEnv } from "../env";
import { mount } from "../core/http";
import * as events from "../core/events";
import * as showcaseEvents from "../core/showcase-events";
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
  // Showcase-only events (5.9).
  mount(app, "listShowcaseEventEntries", async ({ params, query }, c) => showcaseEvents.listEntries(c.env.DB, await events.eventBySlug(c.env.DB, params.slug), c.get("user")?.id ?? null, query));
  mount(app, "submitShowcaseEntry", async ({ params, body }, c) => {
    await verifyTurnstile(c.env, body.turnstileToken, clientIp(c.req.raw));
    return showcaseEvents.submitEntry(c.env.DB, c.get("user")!, await events.eventBySlug(c.env.DB, params.slug), body.showcaseId);
  });
  mount(app, "withdrawShowcaseEntry", async ({ params }, c) => {
    await showcaseEvents.withdrawEntry(c.env.DB, c.get("user")!, await events.eventBySlug(c.env.DB, params.slug), params.id);
    return { ok: true as const };
  });
  mount(app, "voteGrowthEntry", ({ params, body }, c) => events.vote(c.env.DB, c.get("user")!, params.slug, body.entryId));
}
