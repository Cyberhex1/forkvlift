import type { Hono } from "hono";
import type { AlternativeProduct } from "@forkvlift/shared";
import type { AppEnv } from "../env";
import { mount } from "../core/http";
import { notFound } from "../core/errors";
import { sha256Hex, slugify } from "../core/ids";
import { LISTED, PROJECT_SELECT, rowsToCards, type ProjectRow } from "../core/projects/rows";
import { emptyPage, missing, todo } from "./_stubs";

/** Names come only from published projects; there is no price catalog. */
async function alternativeGroups(db: D1Database) {
  const { results } = await db.prepare(`SELECT p.id, p.license_spdx, j.value AS name
    FROM projects p, json_each(CASE WHEN json_valid(p.replaces) THEN p.replaces ELSE '[]' END) j
    WHERE ${LISTED} AND j.type = 'text' ORDER BY lower(j.value), j.value, p.id`)
    .all<{ id: string; license_spdx: string | null; name: string }>();
  const groups = new Map<string, { product: AlternativeProduct; names: Set<string>; licensed: Set<string>; all: Set<string> }>();
  for (const row of results) {
    const name = row.name.trim().slice(0, 60);
    if (!name) continue;
    const slug = slugify(name) || `product-${(await sha256Hex(name.toLowerCase())).slice(0, 16)}`;
    let group = groups.get(slug);
    if (!group) {
      group = { product: { slug, name, projectCount: 0, monthlyPriceUsd: null }, names: new Set(), licensed: new Set(), all: new Set() };
      groups.set(slug, group);
    }
    group.names.add(row.name);
    group.all.add(row.id);
    if (row.license_spdx) group.licensed.add(row.id);
    group.product.projectCount = group.licensed.size;
  }
  return groups;
}

/** Requests board + alternatives directory. Owner: Sol (tasks 4.5, 4.7). */
export function registerGrowth(app: Hono<AppEnv>) {
  mount(app, "listRequests", () => emptyPage());
  mount(app, "getRequest", () => missing("Request"));
  mount(app, "createRequest", () => todo("4.5"));
  mount(app, "claimRequest", () => todo("4.5"));

  mount(app, "listAlternatives", async (_, c) => {
    const groups = await alternativeGroups(c.env.DB);
    return { items: [...groups.values()].filter(g => g.licensed.size).map(g => g.product).sort((a, b) => a.name.localeCompare(b.name)) };
  });
  mount(app, "getAlternatives", async ({ params, query }, c) => {
    const db = c.env.DB;
    const group = (await alternativeGroups(db)).get(params.product);
    if (!group) throw notFound("Product not found");
    const names = [...group.names];
    const { results } = await db.prepare(`${PROJECT_SELECT} WHERE ${LISTED}
      AND (? = 1 OR p.license_spdx IS NOT NULL)
      AND EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(p.replaces) THEN p.replaces ELSE '[]' END) j
        WHERE j.type = 'text' AND j.value IN (SELECT value FROM json_each(?)))
      ORDER BY p.upvotes DESC, p.published_at DESC, p.id`)
      .bind(query.showUnlicensed ? 1 : 0, JSON.stringify(names)).all<ProjectRow>();
    return { product: { ...group.product, projectCount: query.showUnlicensed ? group.all.size : group.licensed.size },
      items: await rowsToCards(db, results, c.get("user")?.id ?? null),
      hiddenUnlicensedCount: query.showUnlicensed ? 0 : group.all.size - group.licensed.size };
  });
}
