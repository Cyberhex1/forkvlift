import type { Hono } from "hono";
import type { Comment } from "@forkvlift/shared";
import type { AppEnv } from "../env";
import { mount } from "../core/http";
import { HttpError, notFound } from "../core/errors";
import { audit } from "../core/curation/candidates";
import { ingestRepo } from "../core/github/ingest";
import { viewerOwnsRepo } from "../core/github/ownership";
import { getProjectDetail } from "../core/projects/detail";
import { decodeCursor, encodeCursor, listProjects } from "../core/projects/list";
import { LISTED, parseJson } from "../core/projects/rows";
import { createProject, deleteProject, previewSubmission, updateProject } from "../core/projects/submit";
import { clientIp, verifyTurnstile } from "../core/security";
import { todo } from "./_stubs";

/** Categories, projects, uploads. Opus (tasks 1.1–1.7, 2.2). */
export function registerCatalog(app: Hono<AppEnv>) {
  mount(app, "listCategories", async (_, c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT c.slug, c.name, c.parent_slug, c.icon_key, c.description,
         (SELECT count(*) FROM projects p WHERE p.category_slug = c.slug AND ${LISTED} AND p.license_spdx IS NOT NULL) AS project_count
       FROM categories c WHERE c.status = 'active' ORDER BY c.position, c.name`,
    ).all<{ slug: string; name: string; parent_slug: string | null; icon_key: string | null; description: string | null; project_count: number }>();
    return {
      items: results.map((r) => ({
        slug: r.slug,
        name: r.name,
        parentSlug: r.parent_slug,
        iconKey: r.icon_key,
        description: r.description,
        projectCount: r.project_count,
      })),
    };
  });
  mount(app, "suggestCategory", () => todo("1.15"));

  mount(app, "listProjects", ({ query }, c) => listProjects(c.env.DB, query, c.get("user")?.id ?? null));

  // Keyword version of "Has this been built?"; semantic search replaces it in task 4.1.
  mount(app, "similarProjects", async ({ query }, c) => {
    const { items } = await listProjects(c.env.DB, { q: query.q, limit: query.limit ?? 6 }, c.get("user")?.id ?? null);
    return { items };
  });

  mount(app, "getProject", ({ params }, c) => getProjectDetail(c.env.DB, params.slug, c.get("user")));

  mount(app, "previewSubmission", ({ body }, c) => previewSubmission(c.env, c.get("user")!, body.repoUrl));
  mount(app, "createProject", async ({ body }, c) => {
    await verifyTurnstile(c.env, body.turnstileToken, clientIp(c.req.raw));
    return createProject(c.env, c.get("user")!, body);
  });
  mount(app, "updateProject", ({ params, body }, c) => updateProject(c.env, c.get("user")!, params.slug, body));
  mount(app, "deleteProject", async ({ params }, c) => {
    await deleteProject(c.env, c.get("user")!, params.slug);
    return { ok: true as const };
  });

  mount(app, "voteProject", async ({ params, body }, c) => {
    const user = c.get("user")!;
    const db = c.env.DB;
    const project = await db.prepare(`SELECT p.id FROM projects p WHERE p.slug = ? AND ${LISTED}`).bind(params.slug).first<{ id: string }>();
    if (!project) throw notFound("Project not found");
    const change =
      body.value === 1
        ? db.prepare(`INSERT OR IGNORE INTO votes (user_id, target_type, target_id, value) VALUES (?, 'project', ?, 1)`).bind(user.id, project.id)
        : db.prepare(`DELETE FROM votes WHERE user_id = ? AND target_type = 'project' AND target_id = ?`).bind(user.id, project.id);
    const results = await db.batch<{ upvotes: number }>([
      change,
      db
        .prepare(`UPDATE projects SET upvotes = (SELECT count(*) FROM votes WHERE target_type = 'project' AND target_id = ?1 AND value > 0) WHERE id = ?1`)
        .bind(project.id),
      db.prepare(`SELECT upvotes FROM projects WHERE id = ?`).bind(project.id),
    ]);
    return { upvotes: results[2]?.results[0]?.upvotes ?? 0, viewerUpvoted: body.value === 1 };
  });

  mount(app, "listComments", async ({ params, query }, c) => {
    const limit = query.limit ?? 50;
    const cursor = decodeCursor(query.cursor);
    const { results } = await c.env.DB.prepare(
      `SELECT cm.id, cm.project_id, cm.parent_id, cm.body, cm.upvotes, cm.created_at, cm.edited_at,
         u.id AS u_id, u.username, u.display_name, u.avatar_url, av.config AS avatar
       FROM comments cm
       JOIN projects p ON p.id = cm.project_id
       JOIN users u ON u.id = cm.author_id
       LEFT JOIN avatars av ON av.user_id = u.id
       WHERE p.slug = ? AND p.deleted_at IS NULL AND cm.deleted_at IS NULL AND u.deleted_at IS NULL
       ORDER BY cm.created_at ASC, cm.id LIMIT ? OFFSET ?`,
    )
      .bind(params.slug, limit + 1, cursor.o)
      .all<CommentRow>();
    const items: Comment[] = results.slice(0, limit).map((r) => ({
      id: r.id,
      projectId: r.project_id,
      parentId: r.parent_id,
      author: { id: r.u_id, username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url, avatar: parseJson(r.avatar, null) },
      body: r.body,
      upvotes: r.upvotes,
      createdAt: new Date(r.created_at).toISOString(),
      editedAt: r.edited_at ? new Date(r.edited_at).toISOString() : null,
    }));
    return { items, nextCursor: results.length > limit ? encodeCursor({ o: cursor.o + limit }) : null };
  });

  mount(app, "createComment", () => todo("1.9"));
  mount(app, "getForkTree", () => todo("3.6"));
  mount(app, "forkProject", () => todo("2.2"));
  mount(app, "claimProject", async ({ params }, c) => {
    const user = c.get("user")!;
    const db = c.env.DB;
    const row = await db.prepare(`SELECT id, owner_id, repo_full_name FROM projects WHERE slug = ? AND deleted_at IS NULL`).bind(params.slug).first<{
      id: string; owner_id: string | null; repo_full_name: string | null;
    }>();
    if (!row) throw notFound("Project not found");
    if (row.owner_id) throw new HttpError("conflict", "This project already has an author.");
    if (!row.repo_full_name) throw new HttpError("bad_request", "This project has no repository to verify.");
    const repo = await ingestRepo(c.env, row.repo_full_name, { freshFor: 600 });
    if (!(await viewerOwnsRepo(c.env, user.githubLogin, repo.owner, repo.ownerType))) {
      throw new HttpError("forbidden", `Only the owner of ${repo.fullName} on GitHub can claim it. Sign in with that GitHub account.`);
    }
    await db.prepare(`UPDATE projects SET owner_id = ?, claimed_at = ?, updated_at = ? WHERE id = ? AND owner_id IS NULL`).bind(user.id, Date.now(), Date.now(), row.id).run();
    await audit(db, user.id, "project.claim", "project", params.slug, { repo: repo.fullName });
    return getProjectDetail(db, params.slug, user);
  });
  mount(app, "voteRoadmapItem", () => todo("2.7"));

  mount(app, "createUpload", () => todo("1.5"));
  mount(app, "putUpload", () => todo("1.5"));
}

interface CommentRow {
  id: string;
  project_id: string;
  parent_id: string | null;
  body: string;
  upvotes: number;
  created_at: number;
  edited_at: number | null;
  u_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar: string | null;
}
