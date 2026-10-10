/**
 * Background work: Cron Triggers enqueue jobs, the queue consumer runs them.
 * Opus (tasks 1.1, 1.7, 2.3, 3.4).
 */
import { z } from "zod";
import { HttpError } from "../core/errors";
import { enqueueStatsRefresh, runRepoIngest } from "./refresh";

export const JobMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("discovery.run") }),
  z.object({ type: z.literal("stats.refresh") }),
  z.object({ type: z.literal("chat.snapshot") }),
  z.object({ type: z.literal("repo.ingest"), repoFullName: z.string(), candidateId: z.string().nullable() }),
]);
export type JobMessage = z.infer<typeof JobMessage>;

/** Cron expressions from wrangler.jsonc → jobs to enqueue. */
const SCHEDULE: Record<string, JobMessage[]> = {
  "0 */6 * * *": [{ type: "discovery.run" }],
  "30 3 * * *": [{ type: "stats.refresh" }, { type: "chat.snapshot" }],
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
        case "discovery.run": // task 1.7
        case "chat.snapshot": // task 3.4
          console.log(`[jobs] ${job.type}: not built yet`);
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
