/**
 * Minimal GitHub REST client with ETag caching in D1 (github_cache), so repeated
 * ingestion of the same repo costs no rate limit (304s are free). D1 rather than KV
 * because the scheduled jobs alone would use most of KV's 1,000 free writes a day.
 * Set the GITHUB_TOKEN secret to raise the limit from 60 to 5,000 requests/hour.
 */
import { HttpError } from "../errors";

const API = "https://api.github.com";
export const GITHUB_UA = "ForkLift (+https://forklift.stream)";

export class GithubNotFound extends Error {}

/** GitHub rejected GITHUB_TOKEN. Every call will fail the same way until the secret is replaced. */
export class GithubAuthError extends HttpError {
  constructor() {
    super("unavailable", "GitHub rejected the site's GitHub token (401): it's invalid or expired. Set a new GITHUB_TOKEN secret.");
  }
}

interface CacheEntry {
  etag: string | null;
  status: number;
  body: string;
  link: string | null;
  fetchedAt: number;
}

export interface GithubResponse<T> {
  data: T;
  link: string | null;
}

export interface GithubRequest {
  /** Accept header (e.g. the html variant for READMEs). */
  accept?: string;
  /** Serve from cache without revalidating when younger than this (seconds). */
  freshFor?: number;
  /** Return null instead of throwing on 404. */
  allow404?: boolean;
  /** Skip the cache entirely, for responses that differ every call (searches). */
  noCache?: boolean;
}

export async function github<T>(env: Env, path: string, req: GithubRequest = {}): Promise<GithubResponse<T> | null> {
  const accept = req.accept ?? "application/vnd.github+json";
  const key = `gh:${accept === "application/vnd.github+json" ? "" : accept + ":"}${path}`;
  const cached = req.noCache ? null : await readCache(env, key);

  if (cached && req.freshFor && Date.now() - cached.fetchedAt < req.freshFor * 1000) {
    return fromEntry<T>(cached, req.allow404);
  }

  const headers: Record<string, string> = {
    accept,
    "user-agent": GITHUB_UA,
    "x-github-api-version": "2022-11-28",
  };
  if (env.GITHUB_TOKEN) headers.authorization = `Bearer ${env.GITHUB_TOKEN}`;
  if (cached?.etag) headers["if-none-match"] = cached.etag;

  const res = await fetch(`${API}${path}`, { headers });

  if (res.status === 304 && cached) {
    // Nothing changed: only bump the timestamp, so freshFor keeps working without rewriting the body.
    await touchCache(env, key);
    return fromEntry<T>(cached, req.allow404);
  }

  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0" || res.status === 429) {
      if (cached) return fromEntry<T>(cached, req.allow404);
      throw new HttpError("unavailable", "GitHub rate limit reached. Try again in a few minutes.");
    }
  }

  if (res.status === 401) throw new GithubAuthError();
  const body = await res.text();
  if (res.status !== 404 && !res.ok) {
    throw new HttpError("unavailable", `GitHub returned ${res.status} for ${path}`);
  }
  const entry: CacheEntry = { etag: res.headers.get("etag"), status: res.status, body, link: res.headers.get("link"), fetchedAt: Date.now() };
  if (!req.noCache) await writeCache(env, key, entry);
  return fromEntry<T>(entry, req.allow404);
}

function fromEntry<T>(entry: CacheEntry, allow404 = false): GithubResponse<T> | null {
  if (entry.status === 404) {
    if (allow404) return null;
    throw new GithubNotFound("Not found on GitHub");
  }
  const isJson = entry.body.startsWith("{") || entry.body.startsWith("[");
  return { data: (isJson ? JSON.parse(entry.body) : entry.body) as T, link: entry.link };
}

interface CacheRow {
  etag: string | null;
  status: number;
  body: string;
  link: string | null;
  fetched_at: number;
}

/** Entries untouched for this long are dropped by pruneGithubCache. */
const CACHE_TTL_MS = 14 * 86_400_000;
/** D1 rows top out around 2 MB; huge responses (recursive trees of big repos) just aren't cached. */
const MAX_CACHED_BODY = 1_000_000;

// The cache is best-effort: a D1 hiccup costs a full fetch, never the request.
async function readCache(env: Env, key: string): Promise<CacheEntry | null> {
  try {
    const row = await env.DB.prepare(`SELECT etag, status, body, link, fetched_at FROM github_cache WHERE key = ?`).bind(key).first<CacheRow>();
    if (!row || Date.now() - row.fetched_at > CACHE_TTL_MS) return null;
    return { etag: row.etag, status: row.status, body: row.body, link: row.link, fetchedAt: row.fetched_at };
  } catch {
    return null;
  }
}

async function writeCache(env: Env, key: string, entry: CacheEntry): Promise<void> {
  if (entry.body.length > MAX_CACHED_BODY) return;
  await env.DB.prepare(
    `INSERT INTO github_cache (key, etag, status, body, link, fetched_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET etag = excluded.etag, status = excluded.status, body = excluded.body, link = excluded.link, fetched_at = excluded.fetched_at`,
  )
    .bind(key, entry.etag, entry.status, entry.body, entry.link, entry.fetchedAt)
    .run()
    .catch((error: unknown) => console.warn(`[github] cache write failed for ${key}`, error));
}

async function touchCache(env: Env, key: string): Promise<void> {
  await env.DB.prepare(`UPDATE github_cache SET fetched_at = ? WHERE key = ?`)
    .bind(Date.now(), key)
    .run()
    .catch((error: unknown) => console.warn(`[github] cache touch failed for ${key}`, error));
}

/** Drops entries nobody has asked for in two weeks (KV did this with expirationTtl). Runs with the daily stats refresh. */
export async function pruneGithubCache(env: Env, now = Date.now()): Promise<number> {
  const res = await env.DB.prepare(`DELETE FROM github_cache WHERE fetched_at < ?`).bind(now - CACHE_TTL_MS).run();
  return res.meta.changes ?? 0;
}

/** Total count from a per_page=1 list, using the Link header's last page. */
export function countFromLink(link: string | null, itemsOnFirstPage: number): number {
  const last = link?.match(/[?&]page=(\d+)>;\s*rel="last"/);
  return last ? Number(last[1]) : itemsOnFirstPage;
}
