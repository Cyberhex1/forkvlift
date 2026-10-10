import { env } from "cloudflare:test";
import { COOKIES } from "@forkvlift/shared";
import { app } from "../../src/app";
import { sha256Hex } from "../../src/core/ids";
import { syncProjectSearch } from "../../src/core/projects/search";

export { env };

export async function api<T = unknown>(path: string, init: RequestInit & { as?: string } = {}): Promise<{ status: number; body: T }> {
  const headers = new Headers(init.headers);
  if (init.as) headers.set("cookie", `${COOKIES.session}=${init.as}`);
  if (init.body) headers.set("content-type", "application/json");
  const res = await app.request(path, { ...init, headers }, env);
  return { status: res.status, body: (await res.json()) as T };
}

export async function seedUser(id: string, username: string, opts: { githubLogin?: string; role?: "user" | "admin" } = {}): Promise<string> {
  const token = `tok_${id}`;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO users (id, username, display_name, github_login, role) VALUES (?, ?, ?, ?, ?)`).bind(id, username, username, opts.githubLogin ?? username, opts.role ?? "user"),
    env.DB.prepare(`INSERT INTO profiles (user_id, settings) VALUES (?, NULL)`).bind(id),
    env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`).bind(await sha256Hex(token), id, Date.now() + 86_400_000),
  ]);
  return token;
}

export async function seedCategory(slug: string, parent: string | null = null) {
  await env.DB.prepare(`INSERT INTO categories (slug, name, parent_slug) VALUES (?, ?, ?)`).bind(slug, slug, parent).run();
}

/** Empty every table the tests write to. */
export async function resetDb() {
  const tables = ["projects_fts", "votes", "comments", "collection_items", "collections", "project_tags", "forks", "board_cards", "board_columns", "boards", "projects", "sessions", "profiles", "avatars", "users", "categories"];
  await env.DB.batch(tables.map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
}

let n = 0;
export interface SeedProject {
  slug: string;
  owner?: string | null;
  category?: string;
  license?: string | null;
  stage?: "finished" | "wip" | "adoption";
  isPublic?: boolean;
  stars?: number;
  forks?: number;
  upvotes?: number;
  publishedDaysAgo?: number;
  tagline?: string;
  tags?: string[];
  replaces?: string[];
  stack?: string[];
  liveUrl?: string | null;
  staffPick?: boolean;
}

export async function seedProject(p: SeedProject): Promise<string> {
  const id = `prj_t${++n}`;
  const published = Date.now() - (p.publishedDaysAgo ?? 1) * 86_400_000;
  const owner = p.owner === undefined ? null : p.owner;
  // Seeded users are usr_<login>, so the repo lives under the same GitHub login.
  const repoOwner = owner ? owner.replace(/^usr_/, "") : "someone";
  await env.DB.prepare(
    `INSERT INTO projects (id, slug, name, tagline, description, owner_id, source, category_slug, stage, is_public, repo_url, repo_full_name,
       license_spdx, license_name, stars, forks, upvotes, replaces, stack, live_url, staff_pick, published_at)
     VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      p.slug,
      p.slug,
      p.tagline ?? "",
      owner,
      owner ? "community" : "curated",
      p.category ?? "tools",
      p.stage ?? "finished",
      p.isPublic === false ? 0 : 1,
      `https://github.com/${repoOwner}/${p.slug}`,
      `${repoOwner}/${p.slug}`,
      p.license === undefined ? "MIT" : p.license,
      p.license === null ? null : "MIT License",
      p.stars ?? 0,
      p.forks ?? 0,
      p.upvotes ?? 0,
      JSON.stringify(p.replaces ?? []),
      JSON.stringify(p.stack ?? []),
      p.liveUrl ?? null,
      p.staffPick ? 1 : 0,
      published,
    )
    .run();
  for (const tag of p.tags ?? []) await env.DB.prepare(`INSERT INTO project_tags (project_id, tag) VALUES (?, ?)`).bind(id, tag).run();
  await syncProjectSearch(env.DB, id);
  return id;
}
