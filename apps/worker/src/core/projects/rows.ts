/**
 * Raw D1 rows for projects (with author + category joined) and their mapping to
 * the contract's ProjectCard / ProjectDetail.
 */
import { describeLicense, type ProjectCard, type UserSummary } from "@forkvlift/shared";

/** Columns selected by PROJECT_SELECT. */
export interface ProjectRow {
  rowid: number;
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  owner_id: string | null;
  source: "community" | "curated";
  claimed_at: number | null;
  category_slug: string;
  stage: "finished" | "wip" | "adoption";
  is_public: number;
  repo_url: string | null;
  repo_full_name: string | null;
  live_url: string | null;
  release_url: string | null;
  license_spdx: string | null;
  license_name: string | null;
  stars: number;
  forks: number;
  open_issues: number;
  contributors: number;
  last_commit_at: number | null;
  readme_html: string | null;
  stack: string | null;
  platforms: string | null;
  difficulty: string | null;
  ai_tools: string | null;
  build_time: string | null;
  ai_involvement: string | null;
  is_template: number;
  replaces: string | null;
  what_works: string | null;
  whats_missing: string | null;
  looking_for_help: string | null;
  starter_prompt: string | null;
  thumbnail_url: string | null;
  health_score: number;
  health: string | null;
  staff_pick: number;
  upvotes: number;
  comment_count: number;
  safety_flags: string | null;
  found_via_url: string | null;
  created_at: number;
  updated_at: number;
  published_at: number | null;
  deleted_at: number | null;
  hidden_at: number | null;
  // joined
  u_id: string | null;
  u_username: string | null;
  u_display_name: string | null;
  u_avatar_url: string | null;
  u_github_login: string | null;
  u_avatar: string | null;
  cat_name: string | null;
  cat_icon: string | null;
  studio_column: string | null;
}

export const PROJECT_SELECT = `
  SELECT p.rowid AS rowid, p.*,
    u.id AS u_id, u.username AS u_username, u.display_name AS u_display_name, u.avatar_url AS u_avatar_url,
    u.github_login AS u_github_login, av.config AS u_avatar,
    c.name AS cat_name, c.icon_key AS cat_icon,
    (SELECT bc.title FROM board_cards b JOIN board_columns bc ON bc.id = b.column_id WHERE b.project_id = p.id LIMIT 1) AS studio_column
  FROM projects p
  LEFT JOIN users u ON u.id = p.owner_id AND u.deleted_at IS NULL
  LEFT JOIN avatars av ON av.user_id = u.id
  LEFT JOIN categories c ON c.slug = p.category_slug`;

/** A project the public may see in lists. */
export const LISTED = `p.is_public = 1 AND p.deleted_at IS NULL AND p.hidden_at IS NULL AND p.published_at IS NOT NULL AND p.repo_url IS NOT NULL`;

export function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const iso = (ms: number) => new Date(ms).toISOString();

export function authorOf(r: ProjectRow): UserSummary | null {
  if (!r.u_id || !r.u_username) return null;
  return {
    id: r.u_id,
    username: r.u_username,
    displayName: r.u_display_name ?? r.u_username,
    avatarUrl: r.u_avatar_url,
    avatar: parseJson(r.u_avatar, null),
  };
}

export interface ViewerFlags {
  upvoted: Set<string>;
  saved: Set<string>;
}

export function toCard(r: ProjectRow, tags: string[], viewer: ViewerFlags | null): ProjectCard {
  const repoUrl = r.repo_url ?? `https://github.com/${r.repo_full_name}`;
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    description: r.description,
    thumbnailUrl: r.thumbnail_url,
    author: authorOf(r),
    source: r.source,
    claimed: r.source === "community" || r.claimed_at !== null,
    category: { slug: r.category_slug, name: r.cat_name ?? r.category_slug, iconKey: r.cat_icon },
    tags: tags.slice(0, 5),
    stage: r.stage,
    studioColumnTitle: r.stage === "finished" ? null : r.studio_column,
    license: describeLicense(r.license_spdx, r.license_name ?? undefined),
    stars: r.stars,
    forks: r.forks,
    upvotes: r.upvotes,
    commentCount: r.comment_count,
    repoUrl,
    cloneCommand: `git clone ${repoUrl}.git`,
    liveUrl: r.live_url,
    releaseUrl: r.release_url,
    buildFacts: {
      aiTools: parseJson(r.ai_tools, []),
      buildTime: r.build_time,
      aiInvolvement: (r.ai_involvement as ProjectCard["buildFacts"]["aiInvolvement"]) ?? null,
    },
    replaces: parseJson(r.replaces, []),
    isTemplate: r.is_template === 1,
    createdAt: iso(r.published_at ?? r.created_at),
    updatedAt: iso(r.last_commit_at ?? r.updated_at),
    viewer: viewer ? { upvoted: viewer.upvoted.has(r.id), saved: viewer.saved.has(r.id) } : null,
  };
}

/** Tags for many projects in one query. */
export async function loadTags(db: D1Database, ids: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!ids.length) return map;
  const { results } = await db
    .prepare(`SELECT project_id, tag FROM project_tags WHERE project_id IN (${ids.map(() => "?").join(",")}) ORDER BY tag`)
    .bind(...ids)
    .all<{ project_id: string; tag: string }>();
  for (const row of results) map.set(row.project_id, [...(map.get(row.project_id) ?? []), row.tag]);
  return map;
}

/** Which of these projects the viewer upvoted / saved. */
export async function loadViewerFlags(db: D1Database, viewerId: string | null, ids: string[]): Promise<ViewerFlags | null> {
  if (!viewerId) return null;
  const flags: ViewerFlags = { upvoted: new Set(), saved: new Set() };
  if (!ids.length) return flags;
  const marks = ids.map(() => "?").join(",");
  const [votes, saves] = await db.batch<{ id: string }>([
    db.prepare(`SELECT target_id AS id FROM votes WHERE user_id = ? AND target_type = 'project' AND value > 0 AND target_id IN (${marks})`).bind(viewerId, ...ids),
    db
      .prepare(
        `SELECT ci.project_id AS id FROM collection_items ci JOIN collections col ON col.id = ci.collection_id WHERE col.owner_id = ? AND ci.project_id IN (${marks})`,
      )
      .bind(viewerId, ...ids),
  ]);
  for (const v of votes?.results ?? []) flags.upvoted.add(v.id);
  for (const s of saves?.results ?? []) flags.saved.add(s.id);
  return flags;
}

export async function rowsToCards(db: D1Database, rows: ProjectRow[], viewerId: string | null): Promise<ProjectCard[]> {
  const ids = rows.map((r) => r.id);
  const [tags, flags] = await Promise.all([loadTags(db, ids), loadViewerFlags(db, viewerId, ids)]);
  return rows.map((r) => toCard(r, tags.get(r.id) ?? [], flags));
}
