/**
 * Task 5.3: links between showcases and the catalog.
 *
 * - "Built with": a showcase credits catalog projects and resources (stored by
 *   showcases.ts); those pages list it under "Used in these showcases".
 * - List in the catalog: a showcase whose public repo has an open license can
 *   become a catalog project in one step, through the normal submission rules
 *   (the maker must own the repo). The two stay linked ("See the code").
 * - Open-source it later: when a closed showcase (no repo yet) lists its newly
 *   published code, its upvotes and comments carry over to the new project.
 *   The showcase stays up, now pointing at the code.
 */
import { AiTool, LIMITS, type ProjectRef, type SessionUser, type ShowcaseDetail } from "@forkvlift/shared";
import { HttpError, notFound } from "./errors";
import { ingestRepo } from "./github/ingest";
import { newId } from "./ids";
import { createProject } from "./projects/submit";
import { LISTED } from "./projects/rows";
import { getShowcase, listShowcases, ownRow } from "./showcases";

const AI_TOOLS = new Set<string>(AiTool.options);

function plain(md: string, max: number): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export async function listInCatalog(
  env: Env,
  user: SessionUser,
  slug: string,
  body: { repoUrl: string | null; turnstileToken: string },
): Promise<{ showcase: ShowcaseDetail; project: ProjectRef; carriedOver: { upvotes: number; comments: number } }> {
  const db = env.DB;
  const r = await ownRow(db, slug, user);
  if (!r.published_at) throw new HttpError("conflict", "Publish the showcase first.");
  if (r.catalog_project_id && r.cp_slug) throw new HttpError("conflict", "This showcase is already listed in the catalog.", { slug: r.cp_slug });
  const repoUrl = body.repoUrl ?? r.repo_url;
  if (!repoUrl) throw new HttpError("invalid_request", "Add the link to your public GitHub repository.");

  const snapshot = await ingestRepo(env, repoUrl);
  if (!snapshot.license) {
    throw new HttpError("invalid_request", "The catalog only lists code you can reuse. Add an open-source license to the repository first.");
  }
  const openingCode = !r.repo_url;

  const [media, links] = await db.batch<{ key?: string | null; kind: string; url?: string }>([
    db.prepare(`SELECT key, kind FROM showcase_media WHERE showcase_id = ? AND kind IN ('image', 'gif') ORDER BY position`).bind(r.id),
    db.prepare(`SELECT kind, url FROM showcase_links WHERE showcase_id = ? ORDER BY position`).bind(r.id),
  ]);
  const linkOf = (kind: string) => links!.results.find((l) => l.kind === kind)?.url ?? null;
  const platform = ({ web: "web", mobile: "mobile", desktop: "desktop" } as const)[r.kind as "web" | "mobile" | "desktop"];

  const detail = await createProject(env, user, {
    repoUrl: snapshot.htmlUrl,
    forkedFromSlug: null,
    turnstileToken: body.turnstileToken,
    name: r.title.slice(0, 100),
    tagline: r.tagline.slice(0, LIMITS.taglineMax),
    description: plain(r.body_md, LIMITS.descriptionMax) || r.tagline.slice(0, LIMITS.descriptionMax),
    categorySlug: r.category_slug,
    tags: (JSON.parse(r.tags ?? "[]") as string[]).slice(0, LIMITS.maxTags),
    stage: r.stage,
    isPublic: true,
    liveUrl: linkOf("live"),
    releaseUrl: linkOf("download"),
    stack: [],
    platforms: platform ? [platform] : [],
    difficulty: null,
    aiTools: (JSON.parse(r.ai_tools ?? "[]") as string[]).map((t) => t.toLowerCase()).filter((t): t is AiTool => AI_TOOLS.has(t)),
    buildTime: r.build_time,
    aiInvolvement: null,
    replaces: [],
    isTemplate: false,
    whatWorks: null,
    whatsMissing: null,
    lookingForHelp: null,
    thumbnailKey: r.cover_key,
    mediaKeys: media!.results.map((m) => m.key!).filter(Boolean).slice(0, 12),
  });

  let carriedOver = { upvotes: 0, comments: 0 };
  if (openingCode) carriedOver = await carryOver(db, r.id, detail.id, user.id);

  await db
    .prepare(`UPDATE showcases SET repo_url = ?, catalog_project_id = ?, updated_at = ? WHERE id = ?`)
    .bind(snapshot.htmlUrl, detail.id, Date.now(), r.id)
    .run();
  return {
    showcase: await getShowcase(db, slug, user),
    project: { id: detail.id, slug: detail.slug, name: detail.name, author: detail.author },
    carriedOver,
  };
}

/** Copy a showcase's upvotes and comments onto the project it became. Replies keep their threads. */
async function carryOver(db: D1Database, showcaseId: string, projectId: string, ownerId: string) {
  await db
    .prepare(
      `INSERT OR IGNORE INTO votes (user_id, target_type, target_id, value, created_at)
       SELECT user_id, 'project', ?, 1, created_at FROM showcase_votes WHERE showcase_id = ? AND user_id != ?`,
    )
    .bind(projectId, showcaseId, ownerId)
    .run();

  const { results: comments } = await db
    .prepare(`SELECT id, parent_id, author_id, body, created_at, edited_at FROM showcase_comments WHERE showcase_id = ? AND deleted_at IS NULL ORDER BY created_at, id`)
    .bind(showcaseId)
    .all<{ id: string; parent_id: string | null; author_id: string; body: string; created_at: number; edited_at: number | null }>();
  const newIds = new Map(comments.map((c) => [c.id, newId("cmt")]));
  const inserts = comments.map((c) =>
    db
      .prepare(`INSERT INTO comments (id, project_id, author_id, parent_id, body, created_at, edited_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(newIds.get(c.id)!, projectId, c.author_id, c.parent_id ? (newIds.get(c.parent_id) ?? null) : null, c.body, c.created_at, c.edited_at),
  );
  const counts = await db.batch<{ upvotes: number; comment_count: number }>([
    ...inserts,
    db
      .prepare(
        `UPDATE projects SET upvotes = (SELECT count(*) FROM votes WHERE target_type = 'project' AND target_id = ?1 AND value > 0),
           comment_count = (SELECT count(*) FROM comments WHERE project_id = ?1 AND deleted_at IS NULL) WHERE id = ?1`,
      )
      .bind(projectId),
    db.prepare(`SELECT upvotes, comment_count FROM projects WHERE id = ?`).bind(projectId),
  ]);
  const row = counts.at(-1)!.results[0]!;
  return { upvotes: row.upvotes, comments: row.comment_count };
}

/** "Used in these showcases" on a project page. */
export async function projectShowcases(db: D1Database, slug: string, q: { cursor?: string; limit?: number }, viewerId: string | null) {
  const p = await db.prepare(`SELECT p.id FROM projects p WHERE p.slug = ? AND ${LISTED}`).bind(slug).first<{ id: string }>();
  if (!p) throw notFound("Project not found");
  return listShowcases(db, { ...q, sort: "top" }, viewerId, { creditsProject: p.id });
}

/** "Used in these showcases" on a resource page. */
export async function resourceShowcases(db: D1Database, slug: string, q: { cursor?: string; limit?: number }, viewerId: string | null) {
  const r = await db.prepare(`SELECT id FROM resources WHERE slug = ? AND deleted_at IS NULL`).bind(slug).first<{ id: string }>();
  if (!r) throw notFound("Resource not found");
  return listShowcases(db, { ...q, sort: "top" }, viewerId, { creditsResource: r.id });
}
