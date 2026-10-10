/**
 * Task 1.7: automated GitHub discovery (no Reddit scraping, ever).
 *
 * Every 6 hours: GitHub Search for recent repos with vibe-coding topics, plus a
 * diff of curated awesome-lists. New repos are queued as `candidate.discover`
 * jobs, which ingest them and add them to the review queue.
 */
import { github } from "../github/client";
import { parseRepoUrl } from "../github/repo-url";

const TOPICS = ["vibe-coding", "vibecoding", "built-with-claude", "claude-code", "ai-generated"];
const SEARCH_WINDOW_DAYS = 90;
const MIN_STARS = 3;
/** Cap per run so ingestion stays well inside the API budget. */
export const MAX_NEW_PER_RUN = 25;

/** Showcase lists diffed for new entries (links only; their text is never copied). */
export const WATCHLIST = ["0xWelt/Awesome-Vibe-Coding"];

export interface Discovered {
  fullName: string;
  foundVia: { kind: "github_search" | "watchlist"; url: string | null };
}

interface SearchResponse {
  items: { full_name: string; stargazers_count: number; archived: boolean; private: boolean }[];
}

export async function searchCandidates(env: Env, now = Date.now()): Promise<Discovered[]> {
  const since = new Date(now - SEARCH_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const found = new Map<string, Discovered>();
  for (const topic of TOPICS) {
    const q = encodeURIComponent(`topic:${topic} created:>${since} stars:>=${MIN_STARS} archived:false`);
    const res = await github<SearchResponse>(env, `/search/repositories?q=${q}&sort=stars&order=desc&per_page=30`, { freshFor: 60 * 60 * 5 });
    for (const item of res?.data.items ?? []) {
      if (item.private || item.archived) continue;
      found.set(item.full_name.toLowerCase(), {
        fullName: item.full_name,
        foundVia: { kind: "github_search", url: `https://github.com/topics/${topic}` },
      });
    }
  }
  return [...found.values()];
}

/** GitHub repo links in a Markdown document. */
export function extractRepoLinks(markdown: string): string[] {
  const out = new Set<string>();
  for (const match of markdown.matchAll(/https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+/g)) {
    const ref = parseRepoUrl(match[0]);
    if (ref) out.add(ref.fullName);
  }
  return [...out];
}

export async function watchlistCandidates(env: Env): Promise<Discovered[]> {
  const found: Discovered[] = [];
  for (const list of WATCHLIST) {
    const res = await github<string>(env, `/repos/${list}/readme`, { accept: "application/vnd.github.raw+json", allow404: true, freshFor: 60 * 60 * 5 });
    if (typeof res?.data !== "string") continue;
    for (const fullName of extractRepoLinks(res.data)) {
      if (fullName.toLowerCase() === list.toLowerCase()) continue;
      found.push({ fullName, foundVia: { kind: "watchlist", url: `https://github.com/${list}` } });
    }
  }
  return found;
}

/** Drop repos already queued, rejected or listed. */
export async function onlyNew(db: D1Database, items: Discovered[]): Promise<Discovered[]> {
  const fresh: Discovered[] = [];
  for (const item of items) {
    const known = await db
      .prepare(
        `SELECT 1 FROM candidates WHERE lower(repo_full_name) = lower(?1)
         UNION ALL SELECT 1 FROM projects WHERE lower(repo_full_name) = lower(?1) LIMIT 1`,
      )
      .bind(item.fullName)
      .first();
    if (!known) fresh.push(item);
    if (fresh.length >= MAX_NEW_PER_RUN) break;
  }
  return fresh;
}
