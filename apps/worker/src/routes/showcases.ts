import type { Hono } from "hono";
import type { AppEnv } from "../env";
import { mount } from "../core/http";
import { notFound } from "../core/errors";
import * as showcases from "../core/showcases";
import { searchShowcases } from "../core/showcase-search";
import { clientIp, verifyTurnstile } from "../core/security";

/** Showcases (Phase 5, task 5.1). Opus. */
export function registerShowcases(app: Hono<AppEnv>) {
  mount(app, "listShowcases", ({ query }, c) => searchShowcases(c.env, query, c.get("user")?.id ?? null));
  mount(app, "getShowcase", ({ params }, c) => showcases.getShowcase(c.env.DB, params.slug, c.get("user")));
  mount(app, "createShowcase", async ({ body }, c) => {
    await verifyTurnstile(c.env, body.turnstileToken, clientIp(c.req.raw));
    return showcases.createShowcase(c.env, c.get("user")!, body);
  });
  mount(app, "updateShowcase", ({ params, body }, c) => showcases.updateShowcase(c.env, c.get("user")!, params.slug, body));
  mount(app, "deleteShowcase", async ({ params }, c) => {
    await showcases.deleteShowcase(c.env.DB, c.get("user")!, params.slug);
    return { ok: true as const };
  });
  mount(app, "myShowcases", ({ query }, c) => showcases.listShowcases(c.env.DB, query, c.get("user")!.id, { ownerId: c.get("user")!.id, includeDrafts: true }));
  mount(app, "savedShowcases", ({ query }, c) => showcases.listShowcases(c.env.DB, query, c.get("user")!.id, { savedBy: c.get("user")!.id }));
  mount(app, "userShowcases", async ({ params, query }, c) => {
    const u = await c.env.DB.prepare(`SELECT id FROM users WHERE lower(username) = lower(?) AND deleted_at IS NULL`).bind(params.username).first<{ id: string }>();
    if (!u) throw notFound("User not found");
    return showcases.listShowcases(c.env.DB, { ...query, sort: "new" }, c.get("user")?.id ?? null, { ownerId: u.id });
  });
  mount(app, "voteShowcase", ({ params, body }, c) => showcases.vote(c.env.DB, c.get("user")!, params.slug, body.value));
  mount(app, "saveShowcase", ({ params, body }, c) => showcases.save(c.env.DB, c.get("user")!, params.slug, body.saved));
  mount(app, "listShowcaseComments", ({ params, query }, c) => showcases.listComments(c.env.DB, params.slug, c.get("user"), query));
  mount(app, "createShowcaseComment", async ({ params, body }, c) => {
    await verifyTurnstile(c.env, body.turnstileToken, clientIp(c.req.raw));
    return showcases.createComment(c.env.DB, c.get("user")!, params.slug, body.body, body.parentId);
  });
  mount(app, "deleteShowcaseComment", async ({ params }, c) => {
    await showcases.deleteComment(c.env.DB, c.get("user")!, params.slug, params.id);
    return { ok: true as const };
  });
}
