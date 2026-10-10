import type { HealthScore, Platform, ProjectDetail, ProjectMedia, ProjectRef, SessionUser } from "@forkvlift/shared";
import { notFound } from "../errors";
import { authorOf, parseJson, PROJECT_SELECT, rowsToCards, type ProjectRow } from "./rows";

const EMPTY_HEALTH: HealthScore = {
  score: 0,
  breakdown: {
    stars: { value: 0, points: 0 },
    forks: { value: 0, points: 0 },
    contributors: { value: 0, points: 0 },
    activity: { value: 0, points: 0 },
    age: { value: 0, points: 0 },
  },
};

const toRef = (r: ProjectRow): ProjectRef => ({ id: r.id, slug: r.slug, name: r.name, author: authorOf(r) });

/**
 * Focus-panel data. Unlicensed projects open by direct link (the panel shows the
 * disclaimer). Private or unpublished projects are visible to their owner only.
 */
export async function getProjectDetail(db: D1Database, slug: string, viewer: SessionUser | null): Promise<ProjectDetail> {
  const row = await db.prepare(`${PROJECT_SELECT} WHERE p.slug = ? AND p.deleted_at IS NULL`).bind(slug).first<ProjectRow>();
  if (!row) throw notFound("Project not found");
  const isOwner = viewer !== null && viewer.id === row.owner_id;
  const listed = row.is_public === 1 && row.published_at !== null && row.hidden_at === null && row.repo_url !== null;
  if (!listed && !isOwner && viewer?.role !== "admin") throw notFound("Project not found");

  const [[card], media, parent, children] = await Promise.all([
    rowsToCards(db, [row], viewer?.id ?? null),
    db
      .prepare(`SELECT id, kind, url, alt, width, height FROM project_media WHERE project_id = ? ORDER BY position`)
      .bind(row.id)
      .all<ProjectMedia>(),
    db
      .prepare(`${PROJECT_SELECT} WHERE p.id = (SELECT parent_id FROM forks WHERE child_id = ?) AND p.deleted_at IS NULL`)
      .bind(row.id)
      .first<ProjectRow>(),
    db
      .prepare(`${PROJECT_SELECT} WHERE p.id IN (SELECT child_id FROM forks WHERE parent_id = ?) AND p.is_public = 1 AND p.deleted_at IS NULL ORDER BY p.stars DESC, p.upvotes DESC LIMIT 6`)
      .bind(row.id)
      .all<ProjectRow>(),
  ]);

  const repoOwner = row.repo_full_name?.split("/")[0]?.toLowerCase();
  return {
    ...card!,
    readmeHtml: row.readme_html,
    media: media.results,
    stack: parseJson<string[]>(row.stack, []),
    platforms: parseJson<Platform[]>(row.platforms, []),
    difficulty: (row.difficulty as ProjectDetail["difficulty"]) ?? null,
    repoStats: {
      stars: row.stars,
      forks: row.forks,
      openIssues: row.open_issues,
      contributors: row.contributors,
      lastCommitAt: row.last_commit_at ? new Date(row.last_commit_at).toISOString() : null,
    },
    health: parseJson<HealthScore>(row.health, EMPTY_HEALTH),
    forkedFrom: parent ? toRef(parent) : null,
    notableForks: children.results.map(toRef),
    wipStatus: row.stage === "finished" ? null : { whatWorks: row.what_works ?? "", whatsMissing: row.whats_missing ?? "" },
    lookingForHelp: row.looking_for_help,
    starterPrompt: row.starter_prompt,
    safety: { flags: parseJson<string[]>(row.safety_flags, []) },
    // Verified: the GitHub account that owns the repo is the one that listed it.
    verifiedAuthor: Boolean(repoOwner && row.u_github_login && row.u_github_login.toLowerCase() === repoOwner),
    staffPick: row.staff_pick === 1,
    foundVia: row.found_via_url,
  };
}
