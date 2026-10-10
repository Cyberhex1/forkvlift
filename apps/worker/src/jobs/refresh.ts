/** Keeps listed projects' GitHub data current (stats.refresh cron → repo.ingest jobs). */
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb, schema } from "../core/db";
import { ingestRepo, type RepoSnapshot } from "../core/github/ingest";
import { computeHealth } from "../core/projects/health";
import { syncProjectSearch } from "../core/projects/search";
import type { JobMessage } from "./index";

/** Columns a project takes from its repo snapshot. */
export function projectFieldsFromSnapshot(s: RepoSnapshot) {
  const health = computeHealth({ stars: s.stars, forks: s.forks, contributors: s.contributors, lastCommitAt: s.pushedAt, createdAt: s.createdAt, archived: s.archived });
  return {
    health,
    healthScore: health.score,
    repoFullName: s.fullName,
    githubRepoId: s.githubRepoId,
    repoUrl: s.htmlUrl,
    stars: s.stars,
    forks: s.forks,
    openIssues: s.openIssues,
    contributors: s.contributors,
    lastCommitAt: s.pushedAt ? new Date(s.pushedAt) : null,
    repoCreatedAt: new Date(s.createdAt),
    licenseSpdx: s.license?.spdx ?? null,
    licenseName: s.license?.name ?? null,
    readmeHtml: s.readmeHtml,
    updatedAt: new Date(),
  };
}

export async function enqueueStatsRefresh(env: Env): Promise<number> {
  const rows = await getDb(env)
    .select({ fullName: schema.projects.repoFullName })
    .from(schema.projects)
    .where(and(isNotNull(schema.projects.repoFullName), isNull(schema.projects.deletedAt)));
  const jobs: { body: JobMessage }[] = rows.map((r) => ({ body: { type: "repo.ingest", repoFullName: r.fullName!, candidateId: null } }));
  // sendBatch takes up to 100 messages per call.
  for (let i = 0; i < jobs.length; i += 100) await env.JOBS.sendBatch(jobs.slice(i, i + 100));
  return jobs.length;
}

export async function runRepoIngest(env: Env, job: Extract<JobMessage, { type: "repo.ingest" }>): Promise<void> {
  const snapshot = await ingestRepo(env, job.repoFullName, { freshFor: 60 * 30 });
  const db = getDb(env);
  const updated = await db
    .update(schema.projects)
    .set(projectFieldsFromSnapshot(snapshot))
    .where(eq(schema.projects.repoFullName, job.repoFullName))
    .returning({ id: schema.projects.id });
  for (const p of updated) await syncProjectSearch(env.DB, p.id);
  if (job.candidateId) {
    await db.update(schema.candidates).set({ data: snapshot as unknown as Record<string, unknown>, updatedAt: new Date() }).where(eq(schema.candidates.id, job.candidateId));
  }
}
