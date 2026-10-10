import type { Hono } from "hono";
import { SITE_NAME, SITE_TAGLINE } from "@forkvlift/shared";
import type { AppEnv } from "../env";
import { mount, notFound } from "../core/http";
import { LISTED, parseJson } from "../core/projects/rows";

function escapeXml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

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

interface FeedItemRow {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category_name: string | null;
  author_name: string | null;
  author_username: string | null;
  published_at: number | null;
  created_at: number;
}

/** RSS, README badge, savings counter. Owner: Flash (tasks 4.8, 4.9, 4.11). */
export function registerFeeds(app: Hono<AppEnv>) {
  mount(app, "savingsStats", async (_, c) => {
    // 1. Total forks of active listed projects with open licenses
    const totalForksRow = await c.env.DB.prepare(
      `SELECT coalesce(sum(p.forks), 0) AS total_forks
       FROM projects p
       WHERE ${LISTED} AND p.license_spdx IS NOT NULL`,
    ).first<{ total_forks: number }>();

    // 2. Listed projects that declare "replaces"
    const { results: projectRows } = await c.env.DB.prepare(
      `SELECT p.forks, p.replaces
       FROM projects p
       WHERE ${LISTED} AND p.license_spdx IS NOT NULL AND json_array_length(coalesce(p.replaces, '[]')) > 0`,
    ).all<{ forks: number; replaces: string | null }>();

    // 3. Paid products lookup
    const { results: paidRows } = await c.env.DB.prepare(
      `SELECT slug, name, monthly_price_usd_cents FROM paid_products WHERE monthly_price_usd_cents IS NOT NULL`,
    ).all<{ slug: string; name: string; monthly_price_usd_cents: number }>();

    const priceMap = new Map<string, number>();
    for (const prod of paidRows) {
      priceMap.set(prod.slug.toLowerCase(), prod.monthly_price_usd_cents);
      priceMap.set(prod.name.toLowerCase(), prod.monthly_price_usd_cents);
    }

    let totalMonthlyCents = 0;
    for (const prj of projectRows) {
      const replacesList = parseJson<string[]>(prj.replaces, []);
      const forks = Math.max(1, prj.forks);
      for (const rep of replacesList) {
        const priceCents =
          priceMap.get(rep.toLowerCase()) ?? priceMap.get(rep.toLowerCase().replace(/\s+/g, "-"));
        if (priceCents && priceCents > 0) {
          totalMonthlyCents += forks * priceCents;
        }
      }
    }

    const estimatedMonthlySavingsUsd = Math.round(totalMonthlyCents / 100);

    return {
      estimatedMonthlySavingsUsd,
      forkCount: totalForksRow?.total_forks ?? 0,
      asOf: new Date().toISOString(),
    };
  });

  mount(app, "projectsRss", async ({ query }, c) => {
    const origin = new URL(c.req.url).origin;
    const conditions = [LISTED, "p.license_spdx IS NOT NULL"];
    const bindings: unknown[] = [];

    if (query.category) {
      conditions.push("p.category_slug = ?");
      bindings.push(query.category);
    }
    if (query.user) {
      conditions.push("(u.username = ? OR u.github_login = ?)");
      bindings.push(query.user, query.user);
    }

    const { results } = await c.env.DB.prepare(
      `SELECT p.slug, p.name, p.tagline, p.description, p.published_at, p.created_at,
              c.name AS category_name, u.display_name AS author_name, u.username AS author_username
       FROM projects p
       LEFT JOIN categories c ON c.slug = p.category_slug
       LEFT JOIN users u ON u.id = p.owner_id AND u.deleted_at IS NULL
       WHERE ${conditions.join(" AND ")}
       ORDER BY p.published_at DESC, p.created_at DESC
       LIMIT 50`,
    )
      .bind(...bindings)
      .all<FeedItemRow>();

    let channelTitle = `${SITE_NAME}: new projects`;
    let channelLink = `${origin}/`;
    let channelDescription = SITE_TAGLINE;

    if (query.category) {
      const catName = results[0]?.category_name ?? query.category;
      channelTitle = `${SITE_NAME}: ${catName} projects`;
      channelLink = `${origin}/?category=${encodeURIComponent(query.category)}`;
      channelDescription = `New vibe-coded projects in ${catName} on ${SITE_NAME}.`;
    } else if (query.user) {
      const authorName = results[0]?.author_name ?? query.user;
      channelTitle = `${SITE_NAME}: projects by ${authorName}`;
      channelLink = `${origin}/u/${encodeURIComponent(query.user)}`;
      channelDescription = `Projects created by ${authorName} on ${SITE_NAME}.`;
    }

    const feedUrl = c.req.url;
    const nowRfc822 = new Date().toUTCString();

    const itemsXml = results
      .map((item) => {
        const itemUrl = `${origin}/p/${encodeURIComponent(item.slug)}`;
        const pubDate = new Date(item.published_at ?? item.created_at).toUTCString();
        const desc = item.tagline ? `${item.tagline} — ${item.description}` : item.description;
        const author = item.author_name ? `<author>${escapeXml(item.author_name)}</author>` : "";
        const category = item.category_name ? `<category>${escapeXml(item.category_name)}</category>` : "";

        return `    <item>
      <title>${escapeXml(item.name)}</title>
      <link>${itemUrl}</link>
      <guid isPermaLink="true">${itemUrl}</guid>
      <description>${escapeXml(desc)}</description>
      <pubDate>${pubDate}</pubDate>
      ${author}
      ${category}
    </item>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <link>${channelLink}</link>
    <description>${escapeXml(channelDescription)}</description>
    <language>en</language>
    <lastBuildDate>${nowRfc822}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

    return c.body(xml, 200, {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=600, stale-while-revalidate=86400",
      "x-content-type-options": "nosniff",
    });
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

