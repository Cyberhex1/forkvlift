/**
 * Showcases (Phase 5, task 5.1): what people built with AI, with or without
 * public code. Never forkable. A showcase may link paid or commercial apps
 * (plain links; there is no paid placement), upload short videos (the media
 * upload kind, size-capped) or embed YouTube/Vimeo.
 */
import type { ShowcaseCard, ShowcaseComment, ShowcaseDetail, ShowcaseInput, SessionUser } from "@forkvlift/shared";
import { HttpError, notFound } from "./errors";
import { newId, slugify } from "./ids";
import { notify } from "./notify";
import { decodeCursor, encodeCursor } from "./projects/list";
import { LISTED, parseJson } from "./projects/rows";
import { assertOwnedUploads, mediaKindOf, mediaUrl } from "./uploads";

const DAY_MS = 86_400_000;
const MAX_NEW_PER_DAY = 10;

/** Published, not removed, by a live account. */
export const VISIBLE = `s.published_at IS NOT NULL AND s.hidden_at IS NULL AND s.deleted_at IS NULL AND u.deleted_at IS NULL AND u.banned_at IS NULL`;

export interface ShowcaseRow {
  id: string;
  slug: string;
  owner_id: string;
  title: string;
  tagline: string;
  body_md: string;
  build_story_md: string;
  category_slug: string;
  kind: ShowcaseCard["kind"];
  stage: ShowcaseCard["stage"];
  cover_key: string | null;
  repo_url: string | null;
  catalog_project_id: string | null;
  ai_tools: string | null;
  build_time: string | null;
  tags: string | null;
  upvotes: number;
  comment_count: number;
  staff_pick: number;
  published_at: number | null;
  updated_at: number;
  hidden_at: number | null;
  deleted_at: number | null;
  u_username: string;
  u_display_name: string;
  u_avatar_url: string | null;
  u_avatar: string | null;
  cat_name: string | null;
  cat_icon: string | null;
  cp_slug: string | null;
  cp_name: string | null;
  preview_video: string | null;
  preview_embed: string | null;
}

export const SHOWCASE_SELECT = `SELECT s.*, u.username AS u_username, u.display_name AS u_display_name, u.avatar_url AS u_avatar_url, av.config AS u_avatar,
    c.name AS cat_name, c.icon_key AS cat_icon,
    cp.slug AS cp_slug, cp.name AS cp_name,
    (SELECT m.key FROM showcase_media m WHERE m.showcase_id = s.id AND m.kind = 'video' ORDER BY m.position LIMIT 1) AS preview_video,
    (SELECT m.embed_url FROM showcase_media m WHERE m.showcase_id = s.id AND m.kind = 'embed' ORDER BY m.position LIMIT 1) AS preview_embed
  FROM showcases s
  JOIN users u ON u.id = s.owner_id
  LEFT JOIN avatars av ON av.user_id = u.id
  LEFT JOIN categories c ON c.slug = s.category_slug
  LEFT JOIN projects cp ON cp.id = s.catalog_project_id AND cp.is_public = 1 AND cp.deleted_at IS NULL AND cp.hidden_at IS NULL`;

/** Turn a YouTube or Vimeo link into a privacy-friendly player URL; anything else is refused. */
export function normalizeEmbed(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new HttpError("invalid_request", "That video link isn't a URL.");
  }
  const host = u.hostname.replace(/^(www\.|m\.)/, "");
  const id = (s: string | null | undefined) => (s && /^[\w-]{6,20}$/.test(s) ? s : null);
  let yt: string | null = null;
  if (host === "youtu.be") yt = id(u.pathname.slice(1));
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    yt = id(u.searchParams.get("v")) ?? id(u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/)?.[1]);
  }
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt}`;
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const v = u.pathname.match(/(?:^|\/)(\d{6,12})(?:$|\/)/)?.[1];
    if (v) return `https://player.vimeo.com/video/${v}`;
  }
  throw new HttpError("invalid_request", "Videos can be uploaded, or embedded from YouTube or Vimeo.");
}

function toCard(r: ShowcaseRow, viewer: { id: string; upvoted: Set<string>; saved: Set<string> } | null): ShowcaseCard {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    tagline: r.tagline,
    maker: { id: r.owner_id, username: r.u_username, displayName: r.u_display_name, avatarUrl: r.u_avatar_url, avatar: parseJson(r.u_avatar, null) },
    category: { slug: r.category_slug, name: r.cat_name ?? r.category_slug, iconKey: r.cat_icon },
    kind: r.kind,
    stage: r.stage,
    coverUrl: r.cover_key ? mediaUrl(r.cover_key) : null,
    previewVideoUrl: r.preview_video ? mediaUrl(r.preview_video) : r.preview_embed,
    hasPublicCode: Boolean(r.repo_url),
    catalogProject: r.catalog_project_id && r.cp_slug ? { id: r.catalog_project_id, slug: r.cp_slug, name: r.cp_name ?? r.cp_slug, author: null } : null,
    aiTools: parseJson<string[]>(r.ai_tools, []),
    tags: parseJson<string[]>(r.tags, []),
    upvotes: r.upvotes,
    commentCount: r.comment_count,
    staffPick: r.staff_pick === 1,
    status: r.published_at ? "published" : "draft",
    publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
    updatedAt: new Date(r.updated_at).toISOString(),
    viewer: viewer ? { upvoted: viewer.upvoted.has(r.id), saved: viewer.saved.has(r.id), isMaker: viewer.id === r.owner_id } : null,
  };
}

async function viewerFlags(db: D1Database, viewerId: string | null, ids: string[]) {
  if (!viewerId) return null;
  if (!ids.length) return { id: viewerId, upvoted: new Set<string>(), saved: new Set<string>() };
  const marks = ids.map(() => "?").join(",");
  const [v, s] = await db.batch<{ showcase_id: string }>([
    db.prepare(`SELECT showcase_id FROM showcase_votes WHERE user_id = ? AND showcase_id IN (${marks})`).bind(viewerId, ...ids),
    db.prepare(`SELECT showcase_id FROM showcase_saves WHERE user_id = ? AND showcase_id IN (${marks})`).bind(viewerId, ...ids),
  ]);
  return { id: viewerId, upvoted: new Set(v!.results.map((x) => x.showcase_id)), saved: new Set(s!.results.map((x) => x.showcase_id)) };
}

export async function toCards(db: D1Database, rows: ShowcaseRow[], viewerId: string | null) {
  const flags = await viewerFlags(db, viewerId, rows.map((r) => r.id));
  return rows.map((r) => toCard(r, flags));
}

async function rowBySlug(db: D1Database, slug: string, viewer: SessionUser | null): Promise<ShowcaseRow> {
  const r = await db.prepare(`${SHOWCASE_SELECT} WHERE s.slug = ? AND s.deleted_at IS NULL`).bind(slug).first<ShowcaseRow>();
  const isMaker = r && viewer?.id === r.owner_id;
  const isAdmin = viewer?.role === "admin";
  if (!r || (!isMaker && !isAdmin && (!r.published_at || r.hidden_at))) throw notFound("Showcase not found");
  return r;
}

export async function getShowcase(db: D1Database, slug: string, viewer: SessionUser | null): Promise<ShowcaseDetail> {
  const r = await rowBySlug(db, slug, viewer);
  const [media, links, creditedProjects, creditedResources] = await db.batch<Record<string, unknown>>([
    db.prepare(`SELECT * FROM showcase_media WHERE showcase_id = ? ORDER BY position`).bind(r.id),
    db.prepare(`SELECT kind, label, url FROM showcase_links WHERE showcase_id = ? ORDER BY position`).bind(r.id),
    db
      .prepare(`SELECT p.id, p.slug, p.name FROM showcase_credits sc JOIN projects p ON p.id = sc.project_id WHERE sc.showcase_id = ? AND ${LISTED} ORDER BY sc.position`)
      .bind(r.id),
    db
      .prepare(`SELECT r.id, r.slug, r.title FROM showcase_credits sc JOIN resources r ON r.id = sc.resource_id WHERE sc.showcase_id = ? AND r.deleted_at IS NULL ORDER BY sc.position`)
      .bind(r.id),
  ]);
  const [card] = await toCards(db, [r], viewer?.id ?? null);
  return {
    ...card!,
    bodyMd: r.body_md,
    buildStoryMd: r.build_story_md,
    buildTime: r.build_time,
    repoUrl: r.repo_url,
    media: media!.results.map((m) => ({
      id: m.id as string,
      kind: m.kind as ShowcaseDetail["media"][number]["kind"],
      url: m.kind === "embed" ? (m.embed_url as string) : mediaUrl(m.key as string),
      alt: m.alt as string,
    })),
    links: links!.results as ShowcaseDetail["links"],
    builtWith: {
      projects: creditedProjects!.results.map((p) => ({ id: p.id as string, slug: p.slug as string, name: p.name as string, author: null })),
      resources: creditedResources!.results as ShowcaseDetail["builtWith"]["resources"],
    },
  };
}

export type ListQuery = { cursor?: string; limit?: number; sort?: "trending" | "new" | "top"; category?: string; kind?: ShowcaseCard["kind"]; tool?: string; q?: string; staffPicks?: boolean };

export async function listShowcases(
  db: D1Database,
  q: ListQuery,
  viewerId: string | null,
  extra: {
    ownerId?: string;
    includeDrafts?: boolean;
    savedBy?: string;
    onlyIds?: string[];
    excludeIds?: string[];
    offset?: number;
    creditsProject?: string;
    creditsResource?: string;
  } = {},
) {
  const limit = Math.min(q.limit ?? 24, 60);
  const cursor = extra.offset !== undefined ? { o: extra.offset } : decodeCursor(q.cursor);
  const where: string[] = [extra.includeDrafts ? `s.deleted_at IS NULL` : VISIBLE];
  const binds: unknown[] = [];
  if (extra.onlyIds) {
    if (!extra.onlyIds.length) return { items: [], nextCursor: null };
    where.push(`s.id IN (${extra.onlyIds.map(() => "?").join(",")})`);
    binds.push(...extra.onlyIds);
  }
  if (extra.excludeIds?.length) {
    where.push(`s.id NOT IN (${extra.excludeIds.map(() => "?").join(",")})`);
    binds.push(...extra.excludeIds);
  }
  if (extra.ownerId) {
    where.push(`s.owner_id = ?`);
    binds.push(extra.ownerId);
  }
  if (extra.creditsProject) {
    where.push(`EXISTS (SELECT 1 FROM showcase_credits sc WHERE sc.showcase_id = s.id AND sc.project_id = ?)`);
    binds.push(extra.creditsProject);
  }
  if (extra.creditsResource) {
    where.push(`EXISTS (SELECT 1 FROM showcase_credits sc WHERE sc.showcase_id = s.id AND sc.resource_id = ?)`);
    binds.push(extra.creditsResource);
  }
  if (extra.savedBy) {
    where.push(`EXISTS (SELECT 1 FROM showcase_saves sv WHERE sv.showcase_id = s.id AND sv.user_id = ?)`);
    binds.push(extra.savedBy);
  }
  if (q.category) {
    where.push(`(s.category_slug = ? OR s.category_slug IN (SELECT slug FROM categories WHERE parent_slug = ?))`);
    binds.push(q.category, q.category);
  }
  if (q.kind) {
    where.push(`s.kind = ?`);
    binds.push(q.kind);
  }
  if (q.tool) {
    where.push(`EXISTS (SELECT 1 FROM json_each(coalesce(s.ai_tools, '[]')) j WHERE lower(j.value) = lower(?))`);
    binds.push(q.tool);
  }
  if (q.staffPicks) where.push(`s.staff_pick = 1`);
  if (q.q?.trim()) {
    const like = `%${q.q.trim().replace(/[%_]/g, "")}%`;
    where.push(`(s.title LIKE ? OR s.tagline LIKE ? OR s.body_md LIKE ? OR s.tags LIKE ?)`);
    binds.push(like, like, like, like);
  }
  const now = Date.now();
  const order =
    extra.includeDrafts || extra.savedBy
      ? `s.updated_at DESC`
      : q.sort === "new"
        ? `s.published_at DESC`
        : q.sort === "top"
          ? `s.upvotes DESC, s.published_at DESC`
          : // Same recency-weighted formula as the catalog: (votes + 1) / (age in days + 2)^1.5.
            `(s.upvotes + 1.0) / (((${now} - s.published_at) / ${DAY_MS}.0 + 2) * sqrt((${now} - s.published_at) / ${DAY_MS}.0 + 2)) DESC`;
  const { results } = await db
    .prepare(`${SHOWCASE_SELECT} WHERE ${where.join(" AND ")} ORDER BY ${order}, s.id LIMIT ? OFFSET ?`)
    .bind(...binds, limit + 1, cursor.o)
    .all<ShowcaseRow>();
  return { items: await toCards(db, results.slice(0, limit), viewerId), nextCursor: results.length > limit ? encodeCursor({ o: cursor.o + limit }) : null };
}

// ── Writing ───────────────────────────────────────────────────────────────

async function checkInput(env: Env, userId: string, input: Partial<ShowcaseInput>) {
  if (input.categorySlug !== undefined) {
    const cat = await env.DB.prepare(`SELECT 1 FROM categories WHERE slug = ? AND status = 'active'`).bind(input.categorySlug).first();
    if (!cat) throw new HttpError("invalid_request", `Unknown category "${input.categorySlug}"`);
  }
  const keys = [...(input.coverKey ? [input.coverKey] : []), ...(input.media ?? []).flatMap((m) => ("key" in m ? [m.key] : []))];
  if (keys.length) await assertOwnedUploads(env, userId, keys, ["media", "thumbnail"]);
  if (input.coverKey && mediaKindOf(input.coverKey) === "video") throw new HttpError("invalid_request", "The cover must be an image.");
}

type Credits = { projectIds: string[]; resourceIds: string[] };

/** Turn "Built with" slugs into ids; unknown, hidden or removed ones are refused. */
async function resolveCredits(db: D1Database, builtWith: ShowcaseInput["builtWith"]): Promise<Credits | undefined> {
  if (!builtWith) return undefined;
  const lookup = async (sql: string, slugs: string[], what: string) => {
    const unique = [...new Set(slugs)];
    if (!unique.length) return [];
    const { results } = await db.prepare(sql.replace("?", unique.map(() => "?").join(","))).bind(...unique).all<{ id: string; slug: string }>();
    const bySlug = new Map(results.map((r) => [r.slug, r.id]));
    const missing = unique.filter((s) => !bySlug.has(s));
    if (missing.length) throw new HttpError("invalid_request", `No ${what} "${missing[0]}" to credit.`);
    return unique.map((s) => bySlug.get(s)!);
  };
  return {
    projectIds: await lookup(`SELECT p.id, p.slug FROM projects p WHERE p.slug IN (?) AND ${LISTED}`, builtWith.projects, "project"),
    resourceIds: await lookup(`SELECT id, slug FROM resources WHERE slug IN (?) AND deleted_at IS NULL`, builtWith.resources, "resource"),
  };
}

/** Link to the catalog when the repo is already listed there. */
async function catalogMatch(db: D1Database, repoUrl: string | null | undefined): Promise<string | null> {
  if (!repoUrl) return null;
  const m = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/i.exec(repoUrl);
  if (!m) return null;
  const p = await db.prepare(`SELECT p.id FROM projects p WHERE lower(p.repo_full_name) = lower(?) AND ${LISTED}`).bind(m[1]).first<{ id: string }>();
  return p?.id ?? null;
}

function childStatements(db: D1Database, id: string, input: Partial<ShowcaseInput>, credits?: Credits): D1PreparedStatement[] {
  const out: D1PreparedStatement[] = [];
  if (credits) {
    out.push(db.prepare(`DELETE FROM showcase_credits WHERE showcase_id = ?`).bind(id));
    let position = 0;
    for (const pid of credits.projectIds) out.push(db.prepare(`INSERT INTO showcase_credits (showcase_id, project_id, position) VALUES (?, ?, ?)`).bind(id, pid, position++));
    for (const rid of credits.resourceIds) out.push(db.prepare(`INSERT INTO showcase_credits (showcase_id, resource_id, position) VALUES (?, ?, ?)`).bind(id, rid, position++));
  }
  if (input.media) {
    out.push(db.prepare(`DELETE FROM showcase_media WHERE showcase_id = ?`).bind(id));
    input.media.forEach((m, i) => {
      if ("key" in m) {
        out.push(db.prepare(`INSERT INTO showcase_media (id, showcase_id, kind, key, alt, position) VALUES (?, ?, ?, ?, ?, ?)`).bind(newId("smed"), id, mediaKindOf(m.key), m.key, m.alt, i));
      } else {
        out.push(db.prepare(`INSERT INTO showcase_media (id, showcase_id, kind, embed_url, alt, position) VALUES (?, ?, 'embed', ?, ?, ?)`).bind(newId("smed"), id, normalizeEmbed(m.embedUrl), m.alt, i));
      }
    });
  }
  if (input.links) {
    out.push(db.prepare(`DELETE FROM showcase_links WHERE showcase_id = ?`).bind(id));
    input.links.forEach((l, i) => out.push(db.prepare(`INSERT INTO showcase_links (id, showcase_id, kind, label, url, position) VALUES (?, ?, ?, ?, ?, ?)`).bind(newId("slnk"), id, l.kind, l.label.trim(), l.url, i)));
  }
  return out;
}

export async function createShowcase(env: Env, user: SessionUser, input: ShowcaseInput & { publish: boolean }): Promise<ShowcaseDetail> {
  const db = env.DB;
  const recent = await db.prepare(`SELECT count(*) AS n FROM showcases WHERE owner_id = ? AND created_at > ?`).bind(user.id, Date.now() - DAY_MS).first<{ n: number }>();
  if ((recent?.n ?? 0) >= MAX_NEW_PER_DAY) throw new HttpError("rate_limited", `You can create up to ${MAX_NEW_PER_DAY} showcases a day.`);
  await checkInput(env, user.id, input);
  const credits = await resolveCredits(db, input.builtWith);
  let slug = slugify(input.title) || "showcase";
  for (let i = 2; await db.prepare(`SELECT 1 FROM showcases WHERE slug = ?`).bind(slug).first(); i++) slug = `${(slugify(input.title) || "showcase").slice(0, 70)}-${i}`;
  const id = newId("show");
  const now = Date.now();
  await db.batch([
    db
      .prepare(
        `INSERT INTO showcases (id, slug, owner_id, title, tagline, body_md, build_story_md, category_slug, kind, stage, cover_key, repo_url, catalog_project_id, ai_tools, build_time, tags, published_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id, slug, user.id, input.title, input.tagline, input.bodyMd, input.buildStoryMd, input.categorySlug, input.kind, input.stage, input.coverKey,
        input.repoUrl, await catalogMatch(db, input.repoUrl), JSON.stringify(input.aiTools), input.buildTime, JSON.stringify(input.tags),
        input.publish ? now : null, now, now,
      ),
    ...childStatements(db, id, input, credits),
  ]);
  return getShowcase(db, slug, user);
}

export async function ownRow(db: D1Database, slug: string, user: SessionUser): Promise<ShowcaseRow> {
  const r = await db.prepare(`${SHOWCASE_SELECT} WHERE s.slug = ? AND s.deleted_at IS NULL`).bind(slug).first<ShowcaseRow>();
  if (!r || r.owner_id !== user.id) throw notFound("Showcase not found");
  return r;
}

export async function updateShowcase(env: Env, user: SessionUser, slug: string, input: Partial<ShowcaseInput> & { publish?: boolean }): Promise<ShowcaseDetail> {
  const db = env.DB;
  const r = await ownRow(db, slug, user);
  await checkInput(env, user.id, input);
  const credits = await resolveCredits(db, input.builtWith);
  const sets: string[] = [];
  const binds: unknown[] = [];
  const set = (col: string, v: unknown) => {
    sets.push(`${col} = ?`);
    binds.push(v);
  };
  if (input.title !== undefined) set("title", input.title);
  if (input.tagline !== undefined) set("tagline", input.tagline);
  if (input.bodyMd !== undefined) set("body_md", input.bodyMd);
  if (input.buildStoryMd !== undefined) set("build_story_md", input.buildStoryMd);
  if (input.categorySlug !== undefined) set("category_slug", input.categorySlug);
  if (input.kind !== undefined) set("kind", input.kind);
  if (input.stage !== undefined) set("stage", input.stage);
  if (input.coverKey !== undefined) set("cover_key", input.coverKey);
  if (input.repoUrl !== undefined) {
    set("repo_url", input.repoUrl);
    set("catalog_project_id", await catalogMatch(db, input.repoUrl));
  }
  if (input.aiTools !== undefined) set("ai_tools", JSON.stringify(input.aiTools));
  if (input.buildTime !== undefined) set("build_time", input.buildTime);
  if (input.tags !== undefined) set("tags", JSON.stringify(input.tags));
  if (input.publish === true && !r.published_at) set("published_at", Date.now());
  if (input.publish === false) set("published_at", null);
  set("updated_at", Date.now());
  await db.batch([db.prepare(`UPDATE showcases SET ${sets.join(", ")} WHERE id = ?`).bind(...binds, r.id), ...childStatements(db, r.id, input, credits)]);
  return getShowcase(db, slug, user);
}

export async function deleteShowcase(db: D1Database, user: SessionUser, slug: string): Promise<void> {
  const r = await ownRow(db, slug, user);
  await db.prepare(`UPDATE showcases SET deleted_at = ?, published_at = NULL WHERE id = ?`).bind(Date.now(), r.id).run();
}

export async function vote(db: D1Database, user: SessionUser, slug: string, value: 0 | 1) {
  const r = await rowBySlug(db, slug, null);
  if (r.owner_id === user.id) throw new HttpError("bad_request", "You can't upvote your own showcase.");
  await db.batch([
    value
      ? db.prepare(`INSERT OR IGNORE INTO showcase_votes (showcase_id, user_id, created_at) VALUES (?, ?, ?)`).bind(r.id, user.id, Date.now())
      : db.prepare(`DELETE FROM showcase_votes WHERE showcase_id = ? AND user_id = ?`).bind(r.id, user.id),
    db.prepare(`UPDATE showcases SET upvotes = (SELECT count(*) FROM showcase_votes WHERE showcase_id = ?1) WHERE id = ?1`).bind(r.id),
  ]);
  const n = await db.prepare(`SELECT upvotes FROM showcases WHERE id = ?`).bind(r.id).first<{ upvotes: number }>();
  return { upvotes: n?.upvotes ?? 0, upvoted: value === 1 };
}

export async function save(db: D1Database, user: SessionUser, slug: string, saved: boolean) {
  const r = await rowBySlug(db, slug, null);
  await (saved
    ? db.prepare(`INSERT OR IGNORE INTO showcase_saves (showcase_id, user_id, created_at) VALUES (?, ?, ?)`).bind(r.id, user.id, Date.now())
    : db.prepare(`DELETE FROM showcase_saves WHERE showcase_id = ? AND user_id = ?`).bind(r.id, user.id)
  ).run();
  return { saved };
}

// ── Comments ─────────────────────────────────────────────────────────────

interface CommentRow {
  id: string;
  showcase_id: string;
  parent_id: string | null;
  author_id: string;
  body: string;
  created_at: number;
  edited_at: number | null;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar: string | null;
}

const COMMENT_SELECT = `SELECT c.*, u.username, u.display_name, u.avatar_url, av.config AS avatar
  FROM showcase_comments c JOIN users u ON u.id = c.author_id LEFT JOIN avatars av ON av.user_id = u.id`;

const toComment = (c: CommentRow): ShowcaseComment => ({
  id: c.id,
  showcaseId: c.showcase_id,
  parentId: c.parent_id,
  author: { id: c.author_id, username: c.username, displayName: c.display_name, avatarUrl: c.avatar_url, avatar: parseJson(c.avatar, null) },
  body: c.body,
  createdAt: new Date(c.created_at).toISOString(),
  editedAt: c.edited_at ? new Date(c.edited_at).toISOString() : null,
});

export async function listComments(db: D1Database, slug: string, viewer: SessionUser | null, q: { cursor?: string; limit?: number }) {
  const r = await rowBySlug(db, slug, viewer);
  const limit = q.limit ?? 50;
  const cursor = decodeCursor(q.cursor);
  const { results } = await db
    .prepare(`${COMMENT_SELECT} WHERE c.showcase_id = ? AND c.deleted_at IS NULL AND u.deleted_at IS NULL AND u.banned_at IS NULL ORDER BY c.created_at ASC LIMIT ? OFFSET ?`)
    .bind(r.id, limit + 1, cursor.o)
    .all<CommentRow>();
  return { items: results.slice(0, limit).map(toComment), nextCursor: results.length > limit ? encodeCursor({ o: cursor.o + limit }) : null };
}

export async function createComment(db: D1Database, user: SessionUser, slug: string, body: string, parentId: string | null): Promise<ShowcaseComment> {
  const r = await rowBySlug(db, slug, null);
  if (parentId) {
    const parent = await db.prepare(`SELECT 1 FROM showcase_comments WHERE id = ? AND showcase_id = ? AND deleted_at IS NULL`).bind(parentId, r.id).first();
    if (!parent) throw new HttpError("invalid_request", "That comment is gone.");
  }
  const blocked = await db
    .prepare(`SELECT 1 FROM blocks WHERE kind = 'block' AND ((blocker_id = ?1 AND blocked_id = ?2) OR (blocker_id = ?2 AND blocked_id = ?1))`)
    .bind(user.id, r.owner_id)
    .first();
  if (blocked) throw new HttpError("forbidden", "You can't comment on this showcase.");
  const id = newId("scom");
  await db.batch([
    db.prepare(`INSERT INTO showcase_comments (id, showcase_id, author_id, parent_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, r.id, user.id, parentId, body, Date.now()),
    db.prepare(`UPDATE showcases SET comment_count = (SELECT count(*) FROM showcase_comments WHERE showcase_id = ?1 AND deleted_at IS NULL) WHERE id = ?1`).bind(r.id),
  ]);
  await notify(db, [{ userId: r.owner_id, type: "comment", actorId: user.id, title: `@${user.username} commented on ${r.title}`, href: `/showcase/${r.slug}#comment-${id}` }]);
  return toComment((await db.prepare(`${COMMENT_SELECT} WHERE c.id = ?`).bind(id).first<CommentRow>())!);
}

export async function deleteComment(db: D1Database, user: SessionUser, slug: string, id: string): Promise<void> {
  const r = await rowBySlug(db, slug, user);
  const c = await db.prepare(`SELECT author_id FROM showcase_comments WHERE id = ? AND showcase_id = ? AND deleted_at IS NULL`).bind(id, r.id).first<{ author_id: string }>();
  if (!c || (c.author_id !== user.id && r.owner_id !== user.id && user.role !== "admin")) throw notFound("Comment not found");
  await db.batch([
    db.prepare(`UPDATE showcase_comments SET deleted_at = ? WHERE id = ?`).bind(Date.now(), id),
    db.prepare(`UPDATE showcases SET comment_count = (SELECT count(*) FROM showcase_comments WHERE showcase_id = ?1 AND deleted_at IS NULL) WHERE id = ?1`).bind(r.id),
  ]);
}

export async function setStaffPick(db: D1Database, slug: string, staffPick: boolean): Promise<void> {
  const res = await db.prepare(`UPDATE showcases SET staff_pick = ? WHERE slug = ? AND deleted_at IS NULL`).bind(staffPick ? 1 : 0, slug).run();
  if (!res.meta.changes) throw notFound("Showcase not found");
}
