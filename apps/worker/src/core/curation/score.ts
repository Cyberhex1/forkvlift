/**
 * Candidate quality score (0–100) and the pass/fail chips shown in the review
 * queue. License is shown, never required: it adds a little, its absence
 * subtracts nothing.
 */
import type { CandidateCheck } from "@forkvlift/shared";
import type { RepoSnapshot } from "../github/ingest";

const WEEK_MS = 7 * 86_400_000;

/** Stars per week since the repo was created (first-seen growth isn't tracked yet). */
export function starVelocity(s: Pick<RepoSnapshot, "stars" | "createdAt">, now = Date.now()): number {
  const weeks = Math.max(1, (now - Date.parse(s.createdAt)) / WEEK_MS);
  return Math.round((s.stars / weeks) * 10) / 10;
}

export function candidateChecks(s: RepoSnapshot): CandidateCheck[] {
  return [
    { key: "license", label: "License detected", pass: s.license !== null, detail: s.license ? s.license.name : "No license (shown, not required)" },
    { key: "readme", label: "README exists", pass: s.readmeHtml !== null, detail: null },
    {
      key: "not_empty_fork",
      label: "Not an unchanged fork",
      pass: s.isFork ? null : true,
      detail: s.isFork ? `Fork of ${s.parentFullName ?? "unknown"}; compare manually` : null,
    },
    { key: "not_archived", label: "Not archived", pass: !s.archived, detail: null },
    // Secret and malware scans arrive with task 1.6.
    { key: "no_secrets", label: "No committed secrets", pass: null, detail: "Scan not run yet" },
    { key: "not_malware", label: "Not malware-flagged", pass: null, detail: "Scan not run yet" },
  ];
}

export function candidateScore(s: RepoSnapshot, now = Date.now()): number {
  const velocity = starVelocity(s, now);
  const daysSincePush = s.pushedAt ? (now - Date.parse(s.pushedAt)) / 86_400_000 : Infinity;
  let score = 0;
  score += Math.min(25, (25 * Math.log1p(velocity)) / Math.log1p(100)); // 100★/week = full
  score += Math.min(15, (15 * Math.log1p(s.stars)) / Math.log1p(2000));
  score += s.readmeHtml ? 15 : 0;
  score += s.homepage ? 10 : 0;
  score += s.hasScreenshots ? 10 : 0;
  score += s.license ? 10 : 0;
  score += daysSincePush <= 30 ? 15 : daysSincePush <= 90 ? 8 : 0;
  if (s.archived) score -= 40;
  if (s.isFork) score -= 20;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** First draft of the card the admin can edit before publishing. */
export function proposedCard(s: RepoSnapshot) {
  const tagline = s.description.length > 80 ? `${s.description.slice(0, 77).trimEnd()}…` : s.description;
  return {
    name: s.name.replace(/[-_]+/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase()),
    tagline,
    categorySlug: null as string | null,
    tags: s.topics.filter((t) => !["vibe-coding", "vibecoding", "ai-generated", "built-with-claude"].includes(t)).slice(0, 5),
    thumbnailUrl: s.socialPreviewUrl as string | null,
  };
}
