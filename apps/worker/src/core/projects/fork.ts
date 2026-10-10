/**
 * Task 2.2: "Continue this" / Fork to my GitHub.
 *
 * ForkvLift never holds a write-scoped GitHub token. The fork itself happens on
 * GitHub (its Fork button); this records it here once it exists:
 *   1. Not forked yet  → 409 { details.forkUrl } so the UI opens GitHub's fork page, then retries.
 *   2. Fork exists     → a private draft project for the fork (lineage to the
 *                        original), an Idea card in the viewer's Studio, and a
 *                        notification to the original author.
 * Unlicensed projects can't be continued; the UI offers "Request to build on this".
 */
import type { SessionUser } from "@forkvlift/shared";
import { HttpError, notFound } from "../errors";
import { github } from "../github/client";
import { ingestRepo } from "../github/ingest";
import { afterFork } from "../badges";
import { notify } from "../notify";
import { createCard, ensureBoard } from "../studio";
import { LISTED } from "./rows";
import { insertProject } from "./submit";

interface GhRepoLite {
  fork: boolean;
  html_url: string;
  parent?: { full_name: string };
  source?: { full_name: string };
}

export async function continueProject(env: Env, user: SessionUser, slug: string): Promise<{ forkRepoUrl: string; studioCardId: string }> {
  const db = env.DB;
  const original = await db
    .prepare(`SELECT p.id, p.name, p.slug, p.owner_id, p.repo_full_name, p.repo_url, p.license_spdx, p.category_slug, p.stack, p.platforms FROM projects p WHERE p.slug = ? AND ${LISTED}`)
    .bind(slug)
    .first<{ id: string; name: string; slug: string; owner_id: string | null; repo_full_name: string; repo_url: string; license_spdx: string | null; category_slug: string; stack: string | null; platforms: string | null }>();
  if (!original) throw notFound("Project not found");
  if (!original.license_spdx) throw new HttpError("forbidden", "This project has no license, so it can't be continued here. Ask the author for permission first.");
  if (original.owner_id === user.id) throw new HttpError("bad_request", "That's your own project.");
  if (!user.githubLogin) throw new HttpError("bad_request", "Sign in with GitHub to fork projects.");

  // Already continued? Return the existing card.
  const existing = await db
    .prepare(
      `SELECT c.id AS card_id, child.repo_url FROM forks f JOIN projects child ON child.id = f.child_id
       JOIN board_cards c ON c.project_id = child.id
       WHERE f.parent_id = ? AND child.owner_id = ? AND child.deleted_at IS NULL LIMIT 1`,
    )
    .bind(original.id, user.id)
    .first<{ card_id: string; repo_url: string }>();
  if (existing) return { forkRepoUrl: existing.repo_url, studioCardId: existing.card_id };

  const name = original.repo_full_name.split("/")[1]!;
  const forkUrl = `https://github.com/${original.repo_full_name}/fork`;
  const candidate = await github<GhRepoLite>(env, `/repos/${user.githubLogin}/${name}`, { allow404: true });
  const parentName = candidate?.data.parent?.full_name ?? candidate?.data.source?.full_name;
  if (!candidate || !candidate.data.fork || parentName?.toLowerCase() !== original.repo_full_name.toLowerCase()) {
    throw new HttpError("conflict", "Fork it on GitHub first, then press Continue again.", { forkUrl });
  }

  const snapshot = await ingestRepo(env, `${user.githubLogin}/${name}`);
  // Someone may already have listed this exact fork (e.g. submitted it by hand).
  const listed = await db.prepare(`SELECT id FROM projects WHERE lower(repo_full_name) = lower(?) AND deleted_at IS NULL`).bind(snapshot.fullName).first<{ id: string }>();
  if (listed) throw new HttpError("conflict", "Your fork is already listed. Find it in your Studio or profile.");

  const { id: projectId } = await insertProject(db, {
    ownerId: user.id,
    source: "community",
    snapshot,
    name: `${original.name} (fork)`.slice(0, 100),
    tagline: `A continuation of ${original.name}`.slice(0, 80),
    description: snapshot.description.slice(0, 300),
    categorySlug: original.category_slug,
    stage: "wip",
    // Private until the forker publishes it from Studio.
    isPublic: false,
    liveUrl: null,
    releaseUrl: null,
    stack: JSON.parse(original.stack ?? "[]") as string[],
    platforms: JSON.parse(original.platforms ?? "[]") as string[],
    difficulty: null,
    aiTools: [],
    buildTime: null,
    aiInvolvement: null,
    isTemplate: false,
    replaces: [],
    whatWorks: null,
    whatsMissing: null,
    lookingForHelp: null,
    thumbnailKey: null,
    tags: [],
    forkedFromId: original.id,
    foundViaUrl: null,
  });

  const boardId = await ensureBoard(db, user.id);
  const ideaColumn = await db.prepare(`SELECT id FROM board_columns WHERE board_id = ? ORDER BY position LIMIT 1`).bind(boardId).first<{ id: string }>();
  // A fresh "Continue this" always lands in the first column, even if it's at its WIP limit.
  const card = await createCard(
    db,
    user.id,
    { columnId: ideaColumn!.id, title: `${original.name} (fork)`.slice(0, 100), idea: `Continuing ${original.name}`, projectId },
    { ignoreWipLimit: true },
  );
  await afterFork(db, user.id, original.id);
  if (original.owner_id) {
    await notify(db, [
      { userId: original.owner_id, type: "fork", actorId: user.id, title: `${user.displayName} forked ${original.name}`, href: `/p/${original.slug}` },
    ]);
  }
  return { forkRepoUrl: snapshot.htmlUrl, studioCardId: card.id };
}
