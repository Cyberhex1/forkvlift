import type { Hono } from "hono";
import { SITE_NAME, SITE_TAGLINE } from "@forkvlift/shared";
import type { AppEnv } from "../env";
import { mount } from "../core/http";
import { missing } from "./_stubs";

/** RSS, README badge, savings counter. Owner: Flash (tasks 4.8, 4.9, 4.11). */
export function registerFeeds(app: Hono<AppEnv>) {
  mount(app, "savingsStats", () => ({ estimatedMonthlySavingsUsd: 0, forkCount: 0, asOf: new Date().toISOString() }));

  mount(app, "projectsRss", (_, c) => {
    const origin = new URL(c.req.url).origin;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${SITE_NAME}: new projects</title>
<link>${origin}/</link>
<description>${SITE_TAGLINE}</description>
</channel></rss>`;
    return c.body(xml, 200, { "content-type": "application/rss+xml; charset=utf-8" });
  });

  mount(app, "readmeBadge", () => missing("Project"));
}
