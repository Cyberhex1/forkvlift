import type { Hono } from "hono";
import { SITE_NAME, SITE_TAGLINE } from "@forkvlift/shared";
import type { AppEnv } from "../env";
import { mount, notFound } from "../core/http";
import { LISTED } from "../core/projects/rows";

export function renderReadmeBadge(origin: string, slug: string, forks: number, upvotes: number): string {
  const label = SITE_NAME;
  const value = `${forks} fork${forks === 1 ? "" : "s"} · ${upvotes} upvote${upvotes === 1 ? "" : "s"}`;

  const labelWidth = Math.max(54, label.length * 7.5 + 14);
  const valueWidth = Math.max(70, value.length * 7.2 + 14);
  const totalWidth = Math.round(labelWidth + valueWidth);
  const labelTextX = Math.round(labelWidth / 2);
  const valueTextX = Math.round(labelWidth + valueWidth / 2);
  const href = `${origin}/p/${encodeURIComponent(slug)}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <a xlink:href="${href}" target="_blank">
    <linearGradient id="s" x2="0" y2="100%">
      <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
      <stop offset="1" stop-opacity=".1"/>
    </linearGradient>
    <clipPath id="r">
      <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
    </clipPath>
    <g clip-path="url(#r)">
      <rect width="${Math.round(labelWidth)}" height="20" fill="#1a1c2c"/>
      <rect x="${Math.round(labelWidth)}" width="${Math.round(valueWidth)}" height="20" fill="#3b5dc9"/>
      <rect width="${totalWidth}" height="20" fill="url(#s)"/>
    </g>
    <g fill="#fff" text-anchor="middle" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="11">
      <text aria-hidden="true" x="${labelTextX}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
      <text x="${labelTextX}" y="14">${label}</text>
      <text aria-hidden="true" x="${valueTextX}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
      <text x="${valueTextX}" y="14">${value}</text>
    </g>
  </a>
</svg>`;
}

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

  mount(app, "readmeBadge", async ({ params }, c) => {
    const row = await c.env.DB.prepare(
      `SELECT p.name, p.slug, p.forks, p.upvotes FROM projects p WHERE p.slug = ? AND ${LISTED}`,
    )
      .bind(params.slug)
      .first<{ name: string; slug: string; forks: number; upvotes: number }>();

    if (!row) throw notFound("Project not found");

    const origin = new URL(c.req.url).origin;
    const svg = renderReadmeBadge(origin, row.slug, row.forks, row.upvotes);
    return c.body(svg, 200, {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=300, stale-while-revalidate=86400",
      "x-content-type-options": "nosniff",
    });
  });
}

