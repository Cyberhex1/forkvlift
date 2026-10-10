/**
 * Minimal GitHub REST client with KV-backed ETag caching, so repeated ingestion
 * of the same repo costs no rate limit (304s are free).
 * Set the GITHUB_TOKEN secret to raise the limit from 60 to 5,000 requests/hour.
 */
import { HttpError } from "../errors";

const API = "https://api.github.com";
export const GITHUB_UA = "ForkLift (+https://forklift.stream)";

export class GithubNotFound extends Error {}

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
}

export async function github<T>(env: Env, path: string, req: GithubRequest = {}): Promise<GithubResponse<T> | null> {
  const accept = req.accept ?? "application/vnd.github+json";
  const key = `gh:${accept === "application/vnd.github+json" ? "" : accept + ":"}${path}`;
  const cached = await readCache(env, key);

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
    const refreshed = { ...cached, fetchedAt: Date.now() };
    await writeCache(env, key, refreshed);
    return fromEntry<T>(refreshed, req.allow404);
  }

  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0" || res.status === 429) {
      if (cached) return fromEntry<T>(cached, req.allow404);
      throw new HttpError("unavailable", "GitHub rate limit reached. Try again in a few minutes.");
    }
  }

  const body = await res.text();
  if (res.status !== 404 && !res.ok) {
    throw new HttpError("unavailable", `GitHub returned ${res.status} for ${path}`);
  }
  const entry: CacheEntry = { etag: res.headers.get("etag"), status: res.status, body, link: res.headers.get("link"), fetchedAt: Date.now() };
  await writeCache(env, key, entry);
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

async function readCache(env: Env, key: string): Promise<CacheEntry | null> {
  try {
    return await env.CACHE.get<CacheEntry>(key, "json");
  } catch {
    return null;
  }
}

async function writeCache(env: Env, key: string, entry: CacheEntry): Promise<void> {
  // KV values are capped at 25 MiB; READMEs are trimmed long before that.
  await env.CACHE.put(key, JSON.stringify(entry), { expirationTtl: 60 * 60 * 24 * 14 });
}

/** Total count from a per_page=1 list, using the Link header's last page. */
export function countFromLink(link: string | null, itemsOnFirstPage: number): number {
  const last = link?.match(/[?&]page=(\d+)>;\s*rel="last"/);
  return last ? Number(last[1]) : itemsOnFirstPage;
}
