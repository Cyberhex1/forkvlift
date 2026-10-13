/**
 * Task 1.7: automated GitHub discovery (no Reddit scraping, ever).
 *
 * Every 6 hours: GitHub Search for recent repos with vibe-coding topics, plus a
 * diff of curated awesome-lists. New repos are queued as `candidate.discover`
 * jobs, which ingest them and add them to the review queue.
 *
 * Each topic is searched twice: by stars (the best ones) and by last update (so
 * every run sees fresh repos, not the same top results it has already queued).
 *
 * A second, smaller track looks for interesting open projects that aren't tagged as
 * AI-built: free alternatives to big paid apps, game decompilations and the like.
 * Unlicensed repos are skipped everywhere, since curated imports must be licensed, and so
 * are repos tagged as AI-coding tooling (MCP servers, skills, prompt packs): the owner
 * wants apps, games and creative projects, not tools for building them.
 */
import { github } from "../github/client";
import { parseRepoUrl } from "../github/repo-url";

/** Topics authors use to say a project was built with AI, not topics for AI tools themselves. */
export const TOPICS = [
  "vibe-coding",
  "vibecoding",
  "vibe-coded",
  "built-with-claude",
  "made-with-claude",
  "built-with-cursor",
  "made-with-cursor",
  "built-with-ai",
  "ai-built",
  "ai-generated",
];
/**
 * Repos tagged with any of these are tooling for AI coding (MCP servers, skills, prompt packs),
 * not the apps, games and creative projects the owner wants in the queue.
 */
export const TOOLING_TOPICS = new Set([
  "mcp", "mcp-server", "mcp-servers", "model-context-protocol", "claude-code-plugin", "claude-code-plugins", "claude-skills", "claude-skill",
  "agent-skills", "skills", "subagents", "claude-code-agents", "cursor-rules", "cursorrules", "prompt", "prompts", "prompt-engineering",
  "system-prompt", "ai-agent-framework", "agent-framework", "llm-tools", "coding-agent", "ai-coding-assistant", "claude-code-hooks",
]);
const SORTS = ["stars", "updated"] as const;
const PER_PAGE = 50;
const SEARCH_WINDOW_DAYS = 180;
const MIN_STARS = 3;
/** Cap per run so ingestion stays well inside the API budget. */
export const MAX_NEW_PER_RUN = 25;

/** Interest track: what a project does, not how it was built. A few topics per run, rotating. */
export const INTEREST_TOPICS = [
  "photoshop-alternative",
  "figma-alternative",
  "notion-alternative",
  "open-source-alternative",
  "foss-alternative",
  "self-hosted",
  "local-first",
  "decompilation",
  "decomp",
  "game-decompilation",
  "game-preservation",
  "retro-games",
  "browser-game",
  "creative-coding",
  "image-editor",
  "audio-editor",
  "video-editor",
  "pixel-art",
];
const INTEREST_PER_RUN = 4;
const INTEREST_MIN_STARS = 25;
/** Recently active, not recently created: good decomps and alternatives are often years old. */
const INTEREST_ACTIVE_DAYS = 120;
/** Most of each run still goes to vibe-coded projects. */
export const MAX_INTEREST_PER_RUN = 8;

/** Showcase lists diffed for new entries (links only; their text is never copied). */
export const WATCHLIST = ["0xWelt/Awesome-Vibe-Coding"];

export interface Discovered {
  fullName: string;
  foundVia: { kind: "github_search" | "watchlist"; url: string | null };
}

interface SearchResponse {
  items: { full_name: string; stargazers_count: number; archived: boolean; private: boolean; license: { spdx_id: string | null } | null; topics?: string[] }[];
}

async function searchTopic(env: Env, topic: string, query: string, sort: string, found: Map<string, Discovered>) {
  const q = encodeURIComponent(`topic:${topic} ${query} archived:false`);
  // One failed search (rate limit, GitHub hiccup) shouldn't cost the whole run.
  const res = await github<SearchResponse>(env, `/search/repositories?q=${q}&sort=${sort}&order=desc&per_page=${PER_PAGE}`, { freshFor: 60 * 60 * 5 }).catch((error: unknown) => {
    console.warn(`[discovery] search failed for ${topic} by ${sort}`, error);
    return null;
  });
  for (const item of res?.data.items ?? []) {
    if (item.private || item.archived || !item.license) continue;
    if ((item.topics ?? []).some((t) => TOOLING_TOPICS.has(t.toLowerCase()))) continue;
    const key = item.full_name.toLowerCase();
    if (!found.has(key)) found.set(key, { fullName: item.full_name, foundVia: { kind: "github_search", url: `https://github.com/topics/${topic}` } });
  }
}

export async function searchCandidates(env: Env, now = Date.now()): Promise<Discovered[]> {
  const since = new Date(now - SEARCH_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const found = new Map<string, Discovered>();
  for (const sort of SORTS) for (const topic of TOPICS) await searchTopic(env, topic, `created:>${since} stars:>=${MIN_STARS}`, sort, found);
  return [...found.values()];
}

/** The interest topics this run covers: a different slice every 6 hours, all of them every day or so. */
export function interestTopicsFor(now: number): string[] {
  const slot = Math.floor(now / (6 * 3_600_000));
  const start = (slot * INTEREST_PER_RUN) % INTEREST_TOPICS.length;
  return Array.from({ length: INTEREST_PER_RUN }, (_, i) => INTEREST_TOPICS[(start + i) % INTEREST_TOPICS.length]!);
}

export async function interestCandidates(env: Env, now = Date.now()): Promise<Discovered[]> {
  const since = new Date(now - INTEREST_ACTIVE_DAYS * 86_400_000).toISOString().slice(0, 10);
  const found = new Map<string, Discovered>();
  for (const topic of interestTopicsFor(now)) await searchTopic(env, topic, `pushed:>${since} stars:>=${INTEREST_MIN_STARS}`, "stars", found);
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

/** Drop repos already queued, rejected or listed. Checks in chunks of 40 (D1 allows 100 bound values per query); a run can find over a thousand repos. */
export async function onlyNew(db: D1Database, items: Discovered[], cap = MAX_NEW_PER_RUN): Promise<Discovered[]> {
  const fresh: Discovered[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < items.length && fresh.length < cap; i += 40) {
    const chunk = items.slice(i, i + 40);
    const names = chunk.map((d) => d.fullName.toLowerCase());
    const marks = names.map(() => "?").join(", ");
    const { results } = await db
      .prepare(
        `SELECT lower(repo_full_name) AS name FROM candidates WHERE lower(repo_full_name) IN (${marks})
         UNION SELECT lower(repo_full_name) FROM projects WHERE lower(repo_full_name) IN (${marks})`,
      )
      .bind(...names, ...names)
      .all<{ name: string }>();
    const known = new Set(results.map((r) => r.name));
    for (const item of chunk) {
      const name = item.fullName.toLowerCase();
      if (known.has(name) || seen.has(name)) continue;
      seen.add(name);
      fresh.push(item);
      if (fresh.length >= cap) break;
    }
  }
  return fresh;
}
