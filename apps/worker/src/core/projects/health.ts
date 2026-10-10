/**
 * Task 1.3: transparent health score (0–100). Every part and its points are
 * returned so the panel can show exactly why a project scored what it did.
 *
 *   stars         up to 30   log scale, 5,000★ = full marks
 *   forks         up to 20   log scale, 1,000 forks = full marks
 *   contributors  up to 15   log scale, 20 people = full marks
 *   activity      up to 25   days since the last commit
 *   age           up to 10   older repos have proven they stick around
 */
import type { HealthScore } from "@forkvlift/shared";

const DAY_MS = 86_400_000;

export const HEALTH_WEIGHTS = { stars: 30, forks: 20, contributors: 15, activity: 25, age: 10 } as const;

export interface HealthInput {
  stars: number;
  forks: number;
  contributors: number;
  lastCommitAt: Date | string | null;
  createdAt: Date | string | null;
  archived?: boolean;
  now?: number;
}

const logPoints = (value: number, fullAt: number, max: number) =>
  round1(Math.min(max, (max * Math.log1p(Math.max(0, value))) / Math.log1p(fullAt)));

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function daysSince(value: Date | string | null, now: number): number | null {
  if (!value) return null;
  const t = typeof value === "string" ? Date.parse(value) : value.getTime();
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / DAY_MS)) : null;
}

function activityPoints(days: number | null): number {
  if (days === null) return 0;
  if (days <= 7) return 25;
  if (days <= 30) return 20;
  if (days <= 90) return 14;
  if (days <= 180) return 9;
  if (days <= 365) return 5;
  return 0;
}

function agePoints(days: number | null): number {
  if (days === null) return 0;
  if (days >= 365) return 10;
  if (days >= 180) return 8;
  if (days >= 90) return 6;
  if (days >= 30) return 4;
  return 2;
}

export function computeHealth(input: HealthInput): HealthScore {
  const now = input.now ?? Date.now();
  const commitDays = daysSince(input.lastCommitAt, now);
  const ageDays = daysSince(input.createdAt, now);
  const breakdown = {
    stars: { value: input.stars, points: logPoints(input.stars, 5000, HEALTH_WEIGHTS.stars) },
    forks: { value: input.forks, points: logPoints(input.forks, 1000, HEALTH_WEIGHTS.forks) },
    contributors: { value: input.contributors, points: logPoints(input.contributors, 20, HEALTH_WEIGHTS.contributors) },
    // Archived repos get no activity points, however recent the last push.
    activity: { value: commitDays ?? -1, points: input.archived ? 0 : activityPoints(commitDays) },
    age: { value: ageDays ?? -1, points: agePoints(ageDays) },
  };
  const score = Math.round(Object.values(breakdown).reduce((sum, part) => sum + part.points, 0));
  return { score: Math.min(100, score), breakdown };
}
