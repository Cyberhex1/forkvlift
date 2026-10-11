import type { Hono } from "hono";
import type { AppEnv } from "../env";
import { ingestMergedPull, mirrorConfigured, verifyWebhook } from "../core/mirror";

/** GitHub webhook for the catalog mirror repo (task 4.13). Signed with MIRROR_WEBHOOK_SECRET. */
export function registerMirror(app: Hono<AppEnv>) {
  app.post("/api/mirror/webhook", async (c) => {
    if (!mirrorConfigured(c.env) || !c.env.MIRROR_WEBHOOK_SECRET) return c.json({ error: { code: "unavailable", message: "Mirror not configured" } }, 503);
    const body = await c.req.text();
    if (!(await verifyWebhook(c.env.MIRROR_WEBHOOK_SECRET, body, c.req.header("x-hub-signature-256") ?? null))) {
      return c.json({ error: { code: "unauthorized", message: "Bad signature" } }, 401);
    }
    if (c.req.header("x-github-event") !== "pull_request") return c.body(null, 204);
    let event: unknown;
    try {
      event = JSON.parse(body);
    } catch {
      return c.json({ error: { code: "invalid_request", message: "Bad JSON" } }, 400);
    }
    // GitHub expects a quick answer; the imports run after it.
    const work = ingestMergedPull(c.env, event as Parameters<typeof ingestMergedPull>[1]).then((r) => {
      if (r.queued.length || r.skipped.length) console.log(`[mirror] queued ${r.queued.length}, skipped ${r.skipped.length}`);
    });
    try {
      c.executionCtx.waitUntil(work);
    } catch {
      await work;
    }
    return c.body(null, 202);
  });
}
