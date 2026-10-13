/**
 * Background work: Cron Triggers enqueue jobs, the queue consumer runs them.
 * Opus (tasks 1.1, 1.7, 2.3, 3.4).
 */
import { z } from "zod";
import { HttpError } from "../core/errors";
import { upsertCandidate } from "../core/curation/candidates";
import { backfillCandidateCategories } from "../core/curation/categorize";
import { MAX_INTEREST_PER_RUN, MAX_NEW_PER_RUN, capTooling, interestCandidates, onlyNew, searchCandidates, watchlistCandidates } from "../core/curation/discovery";
import { ingestRepo } from "../core/github/ingest";
import { flushNotificationEmails, sendWeeklyDigests } from "../email/deliver";
import { snapshotChat } from "../core/moderation";
import { syncVectors } from "../core/projects/semantic";
import { syncShowcaseVectors } from "../core/showcase-search";
import { exportCatalog } from "../core/mirror";
import { enqueueStatsRefresh, runRepoIngest } from "./refresh";

export const JobMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("discovery.run") }),
  z.object({ type: z.literal("stats.refresh") }),
  z.object({ type: z.literal("chat.snapshot") }),
  z.object({ type: z.literal("email.flush") }),
  z.object({ type: z.literal("email.digest") }),
  z.object({ type: z.literal("vectors.sync") }),
  z.object({ type: z.literal("catalog.export") }),
  z.object({ type: z.literal("repo.ingest"), repoFullName: z.string(), candidateId: z.string().nullable() }),
  z.object({
    type: z.literal("candidate.discover"),
    repoFullName: z.string(),
    foundVia: z.object({ kind: z.enum(["github_search", "watchlist"]), url: z.string().nullable() }),
  }),
]);
export type JobMessage = z.infer<typeof JobMessage>;

/** Cron expressions from wrangler.jsonc → jobs to enqueue. */
const SCHEDULE: Record<string, JobMessage[]> = {
  "0 */6 * * *": [{ type: "discovery.run" }],
  "30 3 * * *": [{ type: "stats.refresh" }, { type: "chat.snapshot" }, { type: "catalog.export" }],
  "*/15 * * * *": [{ type: "email.flush" }, { type: "vectors.sync" }],
  "0 15 * * 1": [{ type: "email.digest" }],
};

export async function handleScheduled(controller: ScheduledController, env: Env): Promise<void> {
  const jobs = SCHEDULE[controller.cron] ?? [];
  if (jobs.length) await env.JOBS.sendBatch(jobs.map((body) => ({ body })));
}

export async function handleQueue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    const parsed = JobMessage.safeParse(message.body);
    if (!parsed.success) {
      console.error("[jobs] dropping malformed message", parsed.error.issues);
      message.ack();
      continue;
    }
    const job = parsed.data;
    try {
      switch (job.type) {
        case "repo.ingest":
          await runRepoIngest(env, job);
          break;
        case "stats.refresh":
          await enqueueStatsRefresh(env);
          break;
        case "discovery.run":
          await runDiscovery(env);
          await backfillCandidateCategories(env, 50);
          break;
        case "candidate.discover":
          await upsertCandidate(env, await ingestRepo(env, job.repoFullName), job.foundVia);
          break;
        case "email.flush":
          await flushNotificationEmails(env);
          break;
        case "email.digest":
          await sendWeeklyDigests(env);
          break;
        case "catalog.export": {
          const r = await exportCatalog(env);
          if (r.commit) console.log(`[jobs] catalog.export: ${r.projects} projects → ${r.commit}`);
          break;
        }
        case "vectors.sync": {
          const r = await syncVectors(env);
          if (r.upserted || r.removed) console.log(`[jobs] vectors.sync: ${r.upserted} embedded, ${r.removed} removed`);
          const s = await syncShowcaseVectors(env);
          if (s.upserted || s.removed) console.log(`[jobs] vectors.sync: ${s.upserted} showcases embedded, ${s.removed} removed`);
          break;
        }
        case "chat.snapshot":
          await snapshotChat(env);
          break;
      }
      message.ack();
    } catch (err) {
      console.error(`[jobs] ${job.type} failed`, err);
      // Not-found / bad repos won't fix themselves; anything else is retried with backoff.
      if (err instanceof HttpError && (err.code === "not_found" || err.code === "bad_request" || err.code === "invalid_request")) message.ack();
      else message.retry({ delaySeconds: Math.min(60 * 2 ** message.attempts, 3600) });
    }
  }
}

/** Find new repos and queue them for ingestion. Needs GITHUB_TOKEN (search is too rate-limited without it). */
export async function runDiscovery(env: Env): Promise<number> {
  if (!env.GITHUB_TOKEN && env.ENVIRONMENT !== "local") {
    console.warn("[jobs] discovery skipped: set the GITHUB_TOKEN secret to enable it");
    return 0;
  }
  // Interesting non-AI projects get a fixed share; vibe-coded ones fill the rest.
  const interest = await onlyNew(env.DB, await interestCandidates(env), MAX_INTEREST_PER_RUN);
  const taken = new Set(interest.map((d) => d.fullName.toLowerCase()));
  // Look past the cap so skipped tooling repos leave room for apps and games.
  const vibe = (await onlyNew(env.DB, [...(await searchCandidates(env)), ...(await watchlistCandidates(env))], MAX_NEW_PER_RUN * 4)).filter((d) => !taken.has(d.fullName.toLowerCase()));
  const found = [...capTooling(vibe, MAX_NEW_PER_RUN - interest.length), ...interest];
  if (found.length) {
    await env.JOBS.sendBatch(found.map((d) => ({ body: { type: "candidate.discover", repoFullName: d.fullName, foundVia: d.foundVia } satisfies JobMessage })));
  }
  return found.length;
}