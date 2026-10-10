/**
 * Task 1.4: submitting, editing and removing projects.
 *
 * Community submissions must come from the repo's owner (the user's own repo, or
 * an org they're a public member of). Anyone else's repo goes through curation.
 * Unlicensed repos are accepted; the author is told they'll be hidden by default.
 */
import type { ParsedInput, ProjectDetail, Routes, SessionUser, SubmissionPreview } from "@forkvlift/shared";
import { HttpError, notFound } from "../errors";
import { ingestRepo, type RepoSnapshot } from "../github/ingest";
import { viewerOwnsRepo } from "../github/ownership";
import { parseRepoUrl } from "../github/repo-url";
import { newId, slugify } from "../ids";
import { getProjectDetail } from "./detail";
import { computeHealth } from "./health";
import { authorOf, PROJECT_SELECT, type ProjectRow } from "./rows";
import { syncProjectSearch } from "./search";

type CreateBody = ParsedInput<Routes["createProject"]>["body"];
type UpdateBody = ParsedInput<Routes["updateProject"]>["body"];

export function submissionWarnings(s: RepoSnapshot): string[] {
  const w: string[] = [];
  if (!s.license) {
    w.push("No license found. This project will be hidden from most visitors by default. Add a license on GitHub to change that.");
  }
  if (!s.readmeHtml) w.push("No README found. Add one so people know how to run it.");
  if (s.archived) w.push("This repository is archived on GitHub.");
  if (s.isFork) w.push(`This repository is a fork of ${s.parentFullName ?? "another repo"}. If you list it, list the parent as "forked from".`);
  return w;
}

async function findListedByRepo(db: D1Database, fullName: string) {
  return db.prepare(`${PROJECT_SELECT} WHERE lower(p.repo_full_name) = lower(?) AND p.deleted_at IS NULL`).bind(fullName).first<ProjectRow>();
}

export async function previewSubmission(env: Env, user: SessionUser, repoUrl: string): Promise<SubmissionPreview> {
  const s = await ingestRepo(env, repoUrl);
  const [owned, existing] = await Promise.all([
    viewerOwnsRepo(env, user.githubLogin, s.owner, s.ownerType),
    findListedByRepo(env.DB, s.fullName),
  ]);
  const warnings = submissionWarnings(s);
  if (!owned) warnings.unshift(`You can only submit repositories you own. ${s.fullName} belongs to ${s.owner}.`);
  return {
    repoUrl: s.htmlUrl,
    repoFullName: s.fullName,
    name: s.name,
    description: s.description,
    license: s.license,
    stars: s.stars,
    language: s.language,
    socialPreviewUrl: s.socialPreviewUrl,
    readmeHtml: s.readmeHtml,
    ownedByViewer: owned,
    alreadyListed: existing ? { id: existing.id, slug: existing.slug, name: existing.name, author: authorOf(existing) } : null,
    warnings,
  };
}

/** A slug not used by any project (deleted ones included, so old links don't move). */
export async function uniqueSlug(db: D1Database, name: string): Promise<string> {
  const base = slugify(name) || "project";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base.slice(0, 74)}-${i + 1}`;
    const taken = await db.prepare(`SELECT 1 FROM projects WHERE slug = ?`).bind(candidate).first();
    if (!taken) return candidate;
  }
  return `${base.slice(0, 60)}-${crypto.randomUUID().slice(0, 8)}`;
}

async function assertCategory(db: D1Database, slug: string) {
  const ok = await db.prepare(`SELECT 1 FROM categories WHERE slug = ? AND status = 'active'`).bind(slug).first();
  if (!ok) throw new HttpError("invalid_request", `Unknown category "${slug}"`);
}

const normTags = (tags: string[]) => [...new Set(tags.map((t) => slugify(t).slice(0, 40)).filter(Boolean))].slice(0, 5);
const json = (v: unknown) => JSON.stringify(v);

export async function createProject(env: Env, user: SessionUser, body: CreateBody): Promise<ProjectDetail> {
  const db = env.DB;
  await assertCategory(db, body.categorySlug);

  let snapshot: RepoSnapshot | null = null;
  if (body.repoUrl) {
    if (!parseRepoUrl(body.repoUrl)) throw new HttpError("invalid_request", "That doesn't look like a GitHub repository URL.");
    snapshot = await ingestRepo(env, body.repoUrl);
    if (!(await viewerOwnsRepo(env, user.githubLogin, snapshot.owner, snapshot.ownerType))) {
      throw new HttpError("forbidden", `You can only submit repositories you own. ${snapshot.fullName} belongs to ${snapshot.owner}.`);
    }
    const existing = await findListedByRepo(db, snapshot.fullName);
    if (existing) {
      throw new HttpError(
        "conflict",
        existing.owner_id ? "This repository is already listed." : "This repository is already listed as a curated project. Claim it instead.",
        { slug: existing.slug, claimable: existing.owner_id === null },
      );
    }
  }

  let parentId: string | null = null;
  if (body.forkedFromSlug) {
    const parent = await db.prepare(`SELECT id FROM projects WHERE slug = ? AND deleted_at IS NULL`).bind(body.forkedFromSlug).first<{ id: string }>();
    if (!parent) throw new HttpError("invalid_request", `No project "${body.forkedFromSlug}" to fork from`);
    parentId = parent.id;
  }

  const id = newId("prj");
  const slug = await uniqueSlug(db, body.name);
  const now = Date.now();
  const health = snapshot
    ? computeHealth({ stars: snapshot.stars, forks: snapshot.forks, contributors: snapshot.contributors, lastCommitAt: snapshot.pushedAt, createdAt: snapshot.createdAt, archived: snapshot.archived })
    : null;
  // Only projects with a repo can be public; idea-only projects stay private for now.
  const isPublic = body.isPublic && snapshot !== null;

  const statements = [
    db
      .prepare(
        `INSERT INTO projects (id, slug, name, tagline, description, owner_id, source, category_slug, stage, is_public,
           repo_url, repo_full_name, github_repo_id, live_url, release_url, license_spdx, license_name,
           stars, forks, open_issues, contributors, last_commit_at, repo_created_at, readme_html,
           stack, platforms, difficulty, ai_tools, build_time, ai_involvement, is_template, replaces,
           what_works, whats_missing, looking_for_help, thumbnail_key, thumbnail_url, health_score, health,
           published_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'community', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id, slug, body.name.trim(), body.tagline.trim(), body.description.trim(), user.id, body.categorySlug, body.stage, isPublic ? 1 : 0,
        snapshot?.htmlUrl ?? null, snapshot?.fullName ?? null, snapshot?.githubRepoId ?? null,
        body.liveUrl ?? snapshot?.homepage ?? null, body.releaseUrl, snapshot?.license?.spdx ?? null, snapshot?.license?.name ?? null,
        snapshot?.stars ?? 0, snapshot?.forks ?? 0, snapshot?.openIssues ?? 0, snapshot?.contributors ?? 0,
        snapshot?.pushedAt ? Date.parse(snapshot.pushedAt) : null, snapshot ? Date.parse(snapshot.createdAt) : null, snapshot?.readmeHtml ?? null,
        json(body.stack), json(body.platforms), body.difficulty, json(body.aiTools), body.buildTime, body.aiInvolvement, body.isTemplate ? 1 : 0, json(body.replaces),
        body.whatWorks, body.whatsMissing, body.lookingForHelp,
        // Uploaded thumbnails are wired up with task 1.5; until then the repo's OG card is the thumbnail.
        body.thumbnailKey, snapshot?.socialPreviewUrl ?? null,
        health?.score ?? 0, health ? json(health) : null,
        isPublic ? now : null, now, now,
      ),
    ...normTags(body.tags).map((tag) => db.prepare(`INSERT INTO project_tags (project_id, tag) VALUES (?, ?)`).bind(id, tag)),
  ];
  if (parentId) statements.push(db.prepare(`INSERT INTO forks (child_id, parent_id) VALUES (?, ?)`).bind(id, parentId));
  await db.batch(statements);
  await syncProjectSearch(db, id);
  return getProjectDetail(db, slug, user);
}

async function loadOwned(db: D1Database, slug: string, user: SessionUser) {
  const row = await db.prepare(`SELECT id, owner_id, repo_url, published_at FROM projects WHERE slug = ? AND deleted_at IS NULL`).bind(slug).first<{
    id: string;
    owner_id: string | null;
    repo_url: string | null;
    published_at: number | null;
  }>();
  if (!row) throw notFound("Project not found");
  if (row.owner_id !== user.id && user.role !== "admin") throw new HttpError("forbidden", "Only the author can change this project.");
  return row;
}

const COLUMN: Record<string, string> = {
  name: "name", tagline: "tagline", description: "description", categorySlug: "category_slug", stage: "stage",
  liveUrl: "live_url", releaseUrl: "release_url", difficulty: "difficulty", buildTime: "build_time", aiInvolvement: "ai_involvement",
  whatWorks: "what_works", whatsMissing: "whats_missing", lookingForHelp: "looking_for_help", thumbnailKey: "thumbnail_key",
};
const JSON_COLUMN: Record<string, string> = { stack: "stack", platforms: "platforms", aiTools: "ai_tools", replaces: "replaces" };

export async function updateProject(env: Env, user: SessionUser, slug: string, body: UpdateBody): Promise<ProjectDetail> {
  const db = env.DB;
  const row = await loadOwned(db, slug, user);
  if (body.categorySlug) await assertCategory(db, body.categorySlug);

  const sets: string[] = [];
  const binds: unknown[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    if (COLUMN[key]) {
      sets.push(`${COLUMN[key]} = ?`);
      binds.push(typeof value === "string" ? value.trim() : value);
    } else if (JSON_COLUMN[key]) {
      sets.push(`${JSON_COLUMN[key]} = ?`);
      binds.push(json(value));
    }
  }
  if (body.isTemplate !== undefined) {
    sets.push(`is_template = ?`);
    binds.push(body.isTemplate ? 1 : 0);
  }
  if (body.isPublic !== undefined) {
    const isPublic = body.isPublic && row.repo_url !== null;
    sets.push(`is_public = ?`);
    binds.push(isPublic ? 1 : 0);
    if (isPublic && row.published_at === null) {
      sets.push(`published_at = ?`);
      binds.push(Date.now());
    }
  }
  sets.push(`updated_at = ?`);
  binds.push(Date.now());

  const statements = [db.prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`).bind(...binds, row.id)];
  if (body.tags) {
    statements.push(db.prepare(`DELETE FROM project_tags WHERE project_id = ?`).bind(row.id));
    for (const tag of normTags(body.tags)) statements.push(db.prepare(`INSERT INTO project_tags (project_id, tag) VALUES (?, ?)`).bind(row.id, tag));
  }
  await db.batch(statements);
  await syncProjectSearch(db, row.id);
  return getProjectDetail(db, slug, user);
}

export async function deleteProject(env: Env, user: SessionUser, slug: string): Promise<void> {
  const row = await loadOwned(env.DB, slug, user);
  await env.DB.prepare(`UPDATE projects SET deleted_at = ?, is_public = 0 WHERE id = ?`).bind(Date.now(), row.id).run();
  await syncProjectSearch(env.DB, row.id);
}
